import express from 'express';
import { Exam } from '../models/Exam.js';
import { Question } from '../models/Question.js';
import { CONSENSUS_METHODS } from '../models/ConsensusResult.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ROLES } from '../models/User.js';
import { asyncRoute, badRequest, notFound } from '../middleware/errors.js';
import {
  computeAndStoreConsensus,
  getStoredResult,
  getStoredResults,
  livePreview
} from '../services/consensusService.js';
import { respondentLabel } from '../utils/respondent.js';

const router = express.Router();
const adminOnly = [requireAuth, requireRole(ROLES.ADMIN)];

router.post(
  '/exams/:examId/consensus/compute',
  adminOnly,
  asyncRoute(async (req, res) => {
    const { methods, summaries, saved } = await computeAndStoreConsensus(req.params.examId, {
      io: req.io
    });
    res.json({
      computed: true,
      methods,
      summaries,
      results: saved.map((document) => ({
        method: document.method,
        computedAt: document.computedAt,
        respondentCount: document.respondentCount,
        iterations: document.iterations,
        converged: document.converged
      }))
    });
  })
);

router.get(
  '/exams/:examId/consensus',
  requireAuth,
  asyncRoute(async (req, res) => {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) throw notFound('Exam not found');
    const results = await getStoredResults(exam._id);
    if (Object.keys(results).length === 0) {
      return res.json({ exam: exam.toPublic(), computed: false, methods: [], results: {} });
    }

    return res.json({
      exam: exam.toPublic(),
      computed: true,
      methods: Object.keys(results),
      results: Object.fromEntries(
        Object.entries(results).map(([method, document]) => [
          method,
          {
            method,
            computedAt: document.computedAt,
            respondentCount: document.respondentCount,
            iterations: document.iterations,
            converged: document.converged,
            summary: document.summary,
            perQuestion: document.perQuestion
          }
        ])
      )
    });
  })
);

router.get(
  '/exams/:examId/consensus/:method',
  requireAuth,
  asyncRoute(async (req, res) => {
    const method = `${req.params.method}`.toUpperCase();
    if (!Object.values(CONSENSUS_METHODS).includes(method)) {
      throw badRequest(`Unknown method. Use one of ${Object.values(CONSENSUS_METHODS).join(', ')}`);
    }
    const document = await getStoredResult(req.params.examId, method);
    if (!document) throw notFound(`No ${method} result stored for this exam yet`);

    const weights = [...(document.respondentWeights || [])]
      .sort((a, b) => b.weight - a.weight)
      .map((w) => ({ ...w, label: respondentLabel(w.respondentId) }));

    res.json({
      method,
      computedAt: document.computedAt,
      respondentCount: document.respondentCount,
      iterations: document.iterations,
      converged: document.converged,
      summary: document.summary,
      perQuestion: document.perQuestion,
      respondentWeights: weights
    });
  })
);

router.get(
  '/exams/:examId/consensus/question/:number',
  requireAuth,
  asyncRoute(async (req, res) => {
    const questionNumber = Number(req.params.number);
    if (!Number.isInteger(questionNumber)) throw badRequest('Question number must be an integer');

    const [exam, question, results] = await Promise.all([
      Exam.findById(req.params.examId),
      Question.findOne({ examId: req.params.examId, number: questionNumber }).lean(),
      getStoredResults(req.params.examId)
    ]);
    if (!exam) throw notFound('Exam not found');
    if (Object.keys(results).length === 0) throw notFound('Consensus has not been computed for this exam');

    const perMethod = {};
    for (const [method, document] of Object.entries(results)) {
      const row = (document.perQuestion || []).find((q) => q.questionNumber === questionNumber);
      if (row) perMethod[method] = row;
    }
    if (Object.keys(perMethod).length === 0) throw notFound(`Question ${questionNumber} has no computed result`);

    const majority = perMethod[CONSENSUS_METHODS.MAJORITY] || Object.values(perMethod)[0];
    res.json({
      questionNumber,
      question: question
        ? { number: question.number, text: question.text, type: question.type, options: question.options || [], topic: question.topic }
        : { number: questionNumber, text: '', type: 'MCQ', options: [], topic: 'General' },
      distribution: majority.distribution || {},
      totalResponses: majority.totalResponses || 0,
      entropy: majority.entropy || 0,
      normalisedEntropy: majority.normalisedEntropy || 0,
      margin: majority.margin || 0,
      disputed: Boolean(majority.disputed),
      disputeReasons: majority.disputeReasons || [],
      methods: perMethod,
      agreement: new Set(Object.values(perMethod).map((m) => m.consensusAnswer)).size === 1
    });
  })
);

router.get(
  '/exams/:examId/consensus-live',
  adminOnly,
  asyncRoute(async (req, res) => {
    res.json(await livePreview(req.params.examId));
  })
);

export default router;
