import express from 'express';
import { Exam } from '../models/Exam.js';
import { Question } from '../models/Question.js';
import { DisputeThread } from '../models/DisputeThread.js';
import { Submission } from '../models/Submission.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncRoute, badRequest, notFound } from '../middleware/errors.js';
import { respondentIdFor, respondentLabel } from '../utils/respondent.js';
import { rankedDisputes } from '../services/consensusService.js';

const router = express.Router();

router.get(
  '/exams/:examId/disputes',
  requireAuth,
  asyncRoute(async (req, res) => {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) throw notFound('Exam not found');

    const limit = clampInt(req.query.limit, 10, 1, 100);
    const onlyFlagged = req.query.onlyFlagged === 'true';
    const method = req.query.method ? `${req.query.method}`.toUpperCase() : 'MAJORITY';

    const { questions, computedAt, method: usedMethod } = await rankedDisputes(exam._id, {
      method,
      limit,
      onlyFlagged
    });

    const numbers = questions.map((q) => q.questionNumber);
    const [questionRows, threads] = await Promise.all([
      Question.find({ examId: exam._id, number: { $in: numbers } }).lean(),
      DisputeThread.find({ examId: exam._id, questionNumber: { $in: numbers } }).lean()
    ]);
    const textByNumber = new Map(questionRows.map((q) => [q.number, q]));
    const postsByNumber = new Map(threads.map((t) => [t.questionNumber, t.posts.length]));

    res.json({
      exam: exam.toPublic(),
      method: usedMethod,
      computedAt,
      disputes: questions.map((q) => ({
        ...q,
        text: textByNumber.get(q.questionNumber)?.text || '',
        topic: q.topic || textByNumber.get(q.questionNumber)?.topic || 'General',
        options: textByNumber.get(q.questionNumber)?.options || [],
        postCount: postsByNumber.get(q.questionNumber) || 0
      }))
    });
  })
);

router.get(
  '/exams/:examId/disputes/:number/thread',
  requireAuth,
  asyncRoute(async (req, res) => {
    const { exam, questionNumber } = await resolveQuestion(req);
    const viewer = respondentIdFor(req.user._id.toString(), exam._id.toString());
    const thread = await DisputeThread.findOne({ examId: exam._id, questionNumber });
    const payload = thread
      ? thread.toPublic(viewer)
      : { id: null, examId: exam._id.toString(), questionNumber, posts: [] };

    res.json({
      ...payload,
      posts: payload.posts
        .map((post) => ({ ...post, label: respondentLabel(post.respondentId) }))
        .sort((a, b) => b.votes - a.votes || new Date(a.createdAt) - new Date(b.createdAt))
    });
  })
);

router.post(
  '/exams/:examId/disputes/:number/posts',
  requireAuth,
  asyncRoute(async (req, res) => {
    const { exam, questionNumber } = await resolveQuestion(req);
    const body = `${req.body?.body ?? ''}`.trim();
    if (!body) throw badRequest('A post needs a body');
    if (body.length > 2000) throw badRequest('Posts are limited to 2000 characters');

    const submission = await Submission.findOne({ examId: exam._id, userId: req.user._id }).lean();
    if (!submission) throw badRequest('Only respondents who submitted answers for this exam can post');

    const thread = await DisputeThread.findOneAndUpdate(
      { examId: exam._id, questionNumber },
      {
        $setOnInsert: { examId: exam._id, questionNumber },
        $push: { posts: { respondentId: submission.respondentId, body, votes: 0, voters: [], createdAt: new Date() } }
      },
      { upsert: true, new: true }
    );

    const post = thread.posts.at(-1);
    req.io?.to(`exam:${exam._id}`).emit('dispute:posted', {
      examId: exam._id.toString(),
      questionNumber,
      postCount: thread.posts.length
    });

    res.status(201).json({
      post: {
        id: post._id.toString(),
        respondentId: post.respondentId,
        label: respondentLabel(post.respondentId),
        body: post.body,
        votes: post.votes,
        createdAt: post.createdAt,
        isMine: true,
        hasVoted: false
      }
    });
  })
);

router.post(
  '/exams/:examId/disputes/:number/posts/:postId/vote',
  requireAuth,
  asyncRoute(async (req, res) => {
    const { exam, questionNumber } = await resolveQuestion(req);
    const voter = respondentIdFor(req.user._id.toString(), exam._id.toString());
    const direction = req.body?.direction === 'down' ? -1 : 1;

    const thread = await DisputeThread.findOne({ examId: exam._id, questionNumber });
    if (!thread) throw notFound('No thread for this question yet');
    const post = thread.posts.id(req.params.postId);
    if (!post) throw notFound('Post not found');

    const alreadyVoted = post.voters.includes(voter);
    if (alreadyVoted) {
      post.voters = post.voters.filter((v) => v !== voter);
      post.votes -= direction;
    } else {
      post.voters.push(voter);
      post.votes += direction;
    }
    await thread.save();

    res.json({ postId: post._id.toString(), votes: post.votes, hasVoted: !alreadyVoted });
  })
);

async function resolveQuestion(req) {
  const exam = await Exam.findById(req.params.examId);
  if (!exam) throw notFound('Exam not found');
  const questionNumber = Number(req.params.number);
  if (!Number.isInteger(questionNumber) || questionNumber < 1 || questionNumber > exam.questionCount) {
    throw badRequest(`Question ${req.params.number} is not part of this exam`);
  }
  return { exam, questionNumber };
}

function clampInt(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export default router;
