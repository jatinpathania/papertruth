import express from 'express';
import { Exam } from '../models/Exam.js';
import { Question } from '../models/Question.js';
import { Submission } from '../models/Submission.js';
import { CONSENSUS_METHODS } from '../models/ConsensusResult.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ROLES } from '../models/User.js';
import { asyncRoute, badRequest, notFound } from '../middleware/errors.js';
import { getStoredResult, getStoredResults } from '../services/consensusService.js';
import { scoreSubmission } from '../services/consensus/scoring.js';

const router = express.Router();

router.get(
  '/exams/:examId/results/me',
  requireAuth,
  asyncRoute(async (req, res) => {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) throw notFound('Exam not found');

    const requested = req.query.method ? `${req.query.method}`.toUpperCase() : CONSENSUS_METHODS.WEIGHTED_EM;
    if (!Object.values(CONSENSUS_METHODS).includes(requested)) {
      throw badRequest(`Unknown method. Use one of ${Object.values(CONSENSUS_METHODS).join(', ')}`);
    }

    const [submission, questions] = await Promise.all([
      Submission.findOne({ examId: exam._id, userId: req.user._id }).lean(),
      Question.find({ examId: exam._id }).sort({ number: 1 }).lean()
    ]);
    if (!submission) throw badRequest('You have not submitted answers for this exam');

    const consensus =
      (await getStoredResult(exam._id, requested)) ||
      (await getStoredResult(exam._id, CONSENSUS_METHODS.MAJORITY));
    if (!consensus) throw notFound('Consensus has not been computed for this exam yet');

    const scored = scoreSubmission({
      answers: submission.answers,
      perQuestion: consensus.perQuestion,
      markingScheme: exam.markingScheme,
      questions,
      scoreDisputed: req.query.scoreDisputed === 'true'
    });

    res.json({
      exam: exam.toPublic(),
      method: consensus.method,
      computedAt: consensus.computedAt,
      respondentCount: consensus.respondentCount,
      respondentId: submission.respondentId,
      submittedAt: submission.submittedAt,
      myWeight:
        (consensus.respondentWeights || []).find((w) => w.respondentId === submission.respondentId)?.weight ??
        null,
      ...scored
    });
  })
);

router.get(
  '/exams/:examId/results/me/compare',
  requireAuth,
  asyncRoute(async (req, res) => {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) throw notFound('Exam not found');
    const [submission, questions, results] = await Promise.all([
      Submission.findOne({ examId: exam._id, userId: req.user._id }).lean(),
      Question.find({ examId: exam._id }).sort({ number: 1 }).lean(),
      getStoredResults(exam._id)
    ]);
    if (!submission) throw badRequest('You have not submitted answers for this exam');
    if (Object.keys(results).length === 0) throw notFound('Consensus has not been computed for this exam yet');

    const byMethod = {};
    for (const [method, document] of Object.entries(results)) {
      const scored = scoreSubmission({
        answers: submission.answers,
        perQuestion: document.perQuestion,
        markingScheme: exam.markingScheme,
        questions
      });
      byMethod[method] = {
        score: scored.score,
        scoredMax: scored.scoredMax,
        bestCase: scored.bestCase,
        worstCase: scored.worstCase,
        correct: scored.correct,
        incorrect: scored.incorrect,
        disputed: scored.disputed,
        percentage: scored.percentage
      };
    }
    res.json({ exam: exam.toPublic(), methods: byMethod });
  })
);

router.get(
  '/exams/:examId/results/distribution',
  [requireAuth, requireRole(ROLES.ADMIN)],
  asyncRoute(async (req, res) => {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) throw notFound('Exam not found');
    const method = req.query.method ? `${req.query.method}`.toUpperCase() : CONSENSUS_METHODS.WEIGHTED_EM;
    const consensus =
      (await getStoredResult(exam._id, method)) ||
      (await getStoredResult(exam._id, CONSENSUS_METHODS.MAJORITY));
    if (!consensus) throw notFound('Consensus has not been computed for this exam yet');

    const [submissions, questions] = await Promise.all([
      Submission.find({ examId: exam._id }).lean(),
      Question.find({ examId: exam._id }).lean()
    ]);

    const scores = submissions.map((submission) => {
      const scored = scoreSubmission({
        answers: submission.answers,
        perQuestion: consensus.perQuestion,
        markingScheme: exam.markingScheme,
        questions
      });
      return { respondentId: submission.respondentId, score: scored.score, scoredMax: scored.scoredMax };
    });

    const values = scores.map((s) => s.score).sort((a, b) => a - b);
    const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    res.json({
      method: consensus.method,
      count: values.length,
      mean,
      median: values.length ? values[Math.floor(values.length / 2)] : 0,
      min: values.length ? values[0] : 0,
      max: values.length ? values.at(-1) : 0,
      scores
    });
  })
);

export default router;
