import express from 'express';
import { Exam } from '../models/Exam.js';
import { Question, QUESTION_TYPES } from '../models/Question.js';
import { Submission } from '../models/Submission.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncRoute, badRequest, conflict, notFound } from '../middleware/errors.js';
import { respondentIdFor } from '../utils/respondent.js';
import { emitSubmissionReceived } from '../realtime/emit.js';
import { livePreview } from '../services/consensusService.js';

const router = express.Router();

router.post(
  '/exams/:examId/submissions',
  requireAuth,
  asyncRoute(async (req, res) => {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) throw notFound('Exam not found');
    if (!exam.isAcceptingSubmissions()) {
      throw badRequest(
        exam.status !== 'OPEN'
          ? `This exam is ${exam.status.toLowerCase()} — submissions are no longer accepted`
          : 'The submission window for this exam is not open'
      );
    }

    const { answers } = req.body || {};
    if (!Array.isArray(answers) || answers.length === 0) {
      throw badRequest('Provide at least one answer');
    }

    const questions = await Question.find({ examId: exam._id }).lean();
    const byNumber = new Map(questions.map((q) => [q.number, q]));
    const cleaned = [];
    const seen = new Set();

    for (const raw of answers) {
      const questionNumber = Number(raw?.questionNumber);
      if (!Number.isInteger(questionNumber) || questionNumber < 1 || questionNumber > exam.questionCount) {
        throw badRequest(`Question ${raw?.questionNumber} is not part of this exam`);
      }
      if (seen.has(questionNumber)) throw badRequest(`Question ${questionNumber} was answered twice`);
      seen.add(questionNumber);

      const answer = `${raw.answer ?? ''}`.trim();
      if (!answer) continue;

      const question = byNumber.get(questionNumber);
      if (question?.type === QUESTION_TYPES.MCQ && question.options?.length) {
        if (!question.options.includes(answer)) {
          throw badRequest(`"${answer}" is not an option for question ${questionNumber}`);
        }
      }

      const entry = { questionNumber, answer };

      if (exam.collectPredictions && raw.predictedMajority !== undefined && raw.predictedMajority !== null) {
        const predicted = `${raw.predictedMajority}`.trim();
        if (predicted) {
          if (question?.type === QUESTION_TYPES.MCQ && question.options?.length && !question.options.includes(predicted)) {
            throw badRequest(`"${predicted}" is not an option for question ${questionNumber}`);
          }
          entry.predictedMajority = predicted;
        }
      }

      const confidence = Number(raw.confidence);
      if (Number.isFinite(confidence) && confidence >= 1 && confidence <= 5) {
        entry.confidence = Math.round(confidence);
      }

      cleaned.push(entry);
    }

    if (cleaned.length === 0) throw badRequest('Every answer was blank — nothing to submit');

    const respondentId = respondentIdFor(req.user._id.toString(), exam._id.toString());
    let submission;
    try {
      submission = await Submission.create({
        examId: exam._id,
        userId: req.user._id,
        respondentId,
        answers: cleaned,
        submittedAt: new Date()
      });
    } catch (error) {
      if (error.code === 11000) throw conflict('You have already submitted for this exam');
      throw error;
    }

    try {
      const preview = await livePreview(exam._id);
      emitSubmissionReceived(req.io, exam._id.toString(), {
        respondentId,
        submittedAt: submission.submittedAt,
        answered: cleaned.length,
        ...preview
      });
    } catch (error) {
      console.warn('[submissions] live preview failed:', error.message);
    }

    res.status(201).json({
      submitted: true,
      respondentId,
      submittedAt: submission.submittedAt,
      answered: cleaned.length,
      skipped: seen.size - cleaned.length
    });
  })
);

router.get(
  '/exams/:examId/submissions/me',
  requireAuth,
  asyncRoute(async (req, res) => {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) throw notFound('Exam not found');
    const submission = await Submission.findOne({ examId: exam._id, userId: req.user._id }).lean();
    res.json({
      hasSubmitted: Boolean(submission),
      acceptingSubmissions: exam.isAcceptingSubmissions(),
      respondentId: submission?.respondentId ?? respondentIdFor(req.user._id.toString(), exam._id.toString()),
      submittedAt: submission?.submittedAt ?? null,
      answers: submission?.answers ?? []
    });
  })
);

router.get(
  '/exams/:examId/submissions/count',
  requireAuth,
  asyncRoute(async (req, res) => {
    const count = await Submission.countDocuments({ examId: req.params.examId });
    res.json({ examId: req.params.examId, submissionCount: count });
  })
);

export default router;
