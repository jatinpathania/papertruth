import express from 'express';
import { Exam, EXAM_STATUS } from '../models/Exam.js';
import { Question, QUESTION_TYPES } from '../models/Question.js';
import { Submission } from '../models/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ROLES } from '../models/User.js';
import { asyncRoute, badRequest, notFound } from '../middleware/errors.js';
import { respondentIdFor } from '../utils/respondent.js';

const router = express.Router();
const adminOnly = [requireAuth, requireRole(ROLES.ADMIN)];

const DEFAULT_OPTIONS = ['A', 'B', 'C', 'D'];

router.get(
  '/',
  requireAuth,
  asyncRoute(async (req, res) => {
    const exams = await Exam.find().sort({ createdAt: -1 });
    const submitted = new Set(
      (await Submission.find({ userId: req.user._id }).select('examId').lean()).map((s) =>
        s.examId.toString()
      )
    );
    const counts = await Submission.aggregate([{ $group: { _id: '$examId', count: { $sum: 1 } } }]);
    const countByExam = new Map(counts.map((c) => [c._id.toString(), c.count]));

    res.json({
      exams: exams.map((exam) => ({
        ...exam.toPublic(),
        submissionCount: countByExam.get(exam._id.toString()) || 0,
        hasSubmitted: submitted.has(exam._id.toString())
      }))
    });
  })
);

router.get(
  '/:id',
  requireAuth,
  asyncRoute(async (req, res) => {
    const exam = await Exam.findById(req.params.id);
    if (!exam) throw notFound('Exam not found');
    const [questions, submissionCount, mine] = await Promise.all([
      Question.find({ examId: exam._id }).sort({ number: 1 }).lean(),
      Submission.countDocuments({ examId: exam._id }),
      Submission.findOne({ examId: exam._id, userId: req.user._id }).lean()
    ]);

    res.json({
      exam: exam.toPublic(),
      questions: questions.map(publicQuestion),
      submissionCount,
      hasSubmitted: Boolean(mine),
      mySubmission: mine
        ? { respondentId: mine.respondentId, submittedAt: mine.submittedAt, answers: mine.answers }
        : null
    });
  })
);

router.post(
  '/',
  adminOnly,
  asyncRoute(async (req, res) => {
    const {
      title,
      subject,
      courseCode,
      questionCount,
      opensAt,
      closesAt,
      markingScheme,
      disputeThreshold,
      collectPredictions,
      questions
    } = req.body || {};

    if (!title || !subject || !courseCode) throw badRequest('Title, subject and course code are required');
    const count = Number(questionCount);
    if (!Number.isInteger(count) || count < 1 || count > 500) {
      throw badRequest('questionCount must be a whole number between 1 and 500');
    }

    const opens = opensAt ? new Date(opensAt) : new Date();
    const closes = closesAt ? new Date(closesAt) : new Date(Date.now() + 7 * 24 * 3600 * 1000);
    if (Number.isNaN(opens.getTime()) || Number.isNaN(closes.getTime())) {
      throw badRequest('opensAt / closesAt must be valid dates');
    }
    if (closes <= opens) throw badRequest('The submission window must close after it opens');

    const exam = await Exam.create({
      title: `${title}`.trim(),
      subject: `${subject}`.trim(),
      courseCode: `${courseCode}`.trim(),
      createdBy: req.user._id,
      questionCount: count,
      opensAt: opens,
      closesAt: closes,
      markingScheme: {
        correctMarks: Number(markingScheme?.correctMarks ?? 1),
        negativeMarks: Math.abs(Number(markingScheme?.negativeMarks ?? 0))
      },
      disputeThreshold: clamp01(Number(disputeThreshold ?? 0.85)),
      collectPredictions: collectPredictions !== false
    });

    const rows = Array.isArray(questions) && questions.length ? questions : defaultQuestions(count);
    const created = await Question.insertMany(
      rows.slice(0, count).map((q, index) => buildQuestion(exam._id, q, index)),
      { ordered: true }
    );

    res.status(201).json({ exam: exam.toPublic(), questions: created.map(publicQuestion) });
  })
);

router.put(
  '/:id/questions',
  adminOnly,
  asyncRoute(async (req, res) => {
    const exam = await Exam.findById(req.params.id);
    if (!exam) throw notFound('Exam not found');
    const { questions } = req.body || {};
    if (!Array.isArray(questions) || questions.length === 0) {
      throw badRequest('Provide a non-empty questions array');
    }
    if (await Submission.exists({ examId: exam._id })) {
      throw badRequest('Submissions already exist for this exam — questions can no longer be replaced');
    }

    await Question.deleteMany({ examId: exam._id });
    const created = await Question.insertMany(
      questions.map((q, index) => buildQuestion(exam._id, q, index))
    );
    exam.questionCount = created.length;
    await exam.save();

    res.json({ exam: exam.toPublic(), questions: created.map(publicQuestion) });
  })
);

router.patch(
  '/:id/questions/:number',
  adminOnly,
  asyncRoute(async (req, res) => {
    const exam = await Exam.findById(req.params.id);
    if (!exam) throw notFound('Exam not found');
    const number = Number(req.params.number);
    const question = await Question.findOne({ examId: exam._id, number });
    if (!question) throw notFound(`Question ${number} not found on this exam`);

    const { text, topic, type, options } = req.body || {};
    if (text !== undefined) question.text = `${text}`.trim();
    if (topic !== undefined) question.topic = `${topic}`.trim() || 'General';
    if (type !== undefined) {
      if (!Object.values(QUESTION_TYPES).includes(type)) throw badRequest('type must be MCQ or SHORT');
      if (await Submission.exists({ examId: exam._id })) {
        throw badRequest('Question type cannot change once submissions exist');
      }
      question.type = type;
    }
    if (options !== undefined) {
      const cleaned = (Array.isArray(options) ? options : []).map((o) => `${o}`.trim()).filter(Boolean);
      question.options = question.type === QUESTION_TYPES.MCQ ? cleaned : undefined;
    }
    await question.save();

    res.json({ question: publicQuestion(question.toObject()) });
  })
);

router.patch(
  '/:id/status',
  adminOnly,
  asyncRoute(async (req, res) => {
    const { status, closesAt } = req.body || {};
    const exam = await Exam.findById(req.params.id);
    if (!exam) throw notFound('Exam not found');

    if (status !== undefined) {
      if (!Object.values(EXAM_STATUS).includes(status)) {
        throw badRequest(`status must be one of ${Object.values(EXAM_STATUS).join(', ')}`);
      }
      exam.status = status;
    }
    if (closesAt !== undefined) {
      const closes = new Date(closesAt);
      if (Number.isNaN(closes.getTime())) throw badRequest('closesAt must be a valid date');
      exam.closesAt = closes;
    }
    await exam.save();

    req.io?.to(`exam:${exam._id}`).emit('exam:status', {
      examId: exam._id.toString(),
      status: exam.status,
      acceptingSubmissions: exam.isAcceptingSubmissions()
    });
    res.json({ exam: exam.toPublic() });
  })
);

router.get(
  '/:id/monitor',
  adminOnly,
  asyncRoute(async (req, res) => {
    const exam = await Exam.findById(req.params.id);
    if (!exam) throw notFound('Exam not found');
    const submissions = await Submission.find({ examId: exam._id })
      .select('respondentId submittedAt answers')
      .sort({ submittedAt: 1 })
      .lean();

    res.json({
      exam: exam.toPublic(),
      submissionCount: submissions.length,
      timeline: submissions.map((s) => ({
        respondentId: s.respondentId,
        submittedAt: s.submittedAt,
        answered: s.answers.length
      }))
    });
  })
);

router.delete(
  '/:id',
  adminOnly,
  asyncRoute(async (req, res) => {
    const exam = await Exam.findById(req.params.id);
    if (!exam) throw notFound('Exam not found');
    const { ConsensusResult, DisputeThread, OfficialKey } = await import('../models/index.js');
    await Promise.all([
      Question.deleteMany({ examId: exam._id }),
      Submission.deleteMany({ examId: exam._id }),
      ConsensusResult.deleteMany({ examId: exam._id }),
      DisputeThread.deleteMany({ examId: exam._id }),
      OfficialKey.deleteMany({ examId: exam._id })
    ]);
    await exam.deleteOne();
    res.json({ deleted: true, examId: req.params.id });
  })
);

router.get(
  '/:id/respondent-id',
  requireAuth,
  asyncRoute(async (req, res) => {
    res.json({ respondentId: respondentIdFor(req.user._id.toString(), req.params.id) });
  })
);

function buildQuestion(examId, raw, index) {
  const type = raw?.type === QUESTION_TYPES.SHORT ? QUESTION_TYPES.SHORT : QUESTION_TYPES.MCQ;
  const options =
    type === QUESTION_TYPES.MCQ
      ? (Array.isArray(raw?.options) && raw.options.length
          ? raw.options.map((o) => `${o}`.trim()).filter(Boolean)
          : DEFAULT_OPTIONS)
      : undefined;
  return {
    examId,
    number: Number(raw?.number) || index + 1,
    text: `${raw?.text ?? ''}`.trim(),
    type,
    options,
    topic: `${raw?.topic ?? 'General'}`.trim() || 'General'
  };
}

function defaultQuestions(count) {
  return Array.from({ length: count }, (_, i) => ({ number: i + 1, type: QUESTION_TYPES.MCQ }));
}

function publicQuestion(q) {
  return {
    number: q.number,
    text: q.text || '',
    type: q.type,
    options: q.options || [],
    topic: q.topic || 'General'
  };
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0.85;
  return Math.min(1, Math.max(0, value));
}

export default router;
