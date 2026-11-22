import express from 'express';
import { Exam } from '../models/Exam.js';
import { OfficialKey } from '../models/OfficialKey.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ROLES } from '../models/User.js';
import { asyncRoute, badRequest, notFound } from '../middleware/errors.js';
import { consensusOptionsFor, getStoredResults, loadExamData, toMatrix } from '../services/consensusService.js';
import { cached } from '../services/computeCache.js';
import {
  accuracyVsCohortSize,
  compareMethods,
  keyToMap,
  methodAccuracy,
  METHOD_LABELS
} from '../services/consensus/validation.js';

const router = express.Router();
const adminOnly = [requireAuth, requireRole(ROLES.ADMIN)];

router.put(
  '/exams/:examId/official-key',
  adminOnly,
  asyncRoute(async (req, res) => {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) throw notFound('Exam not found');

    const answers = normaliseKey(req.body?.answers ?? req.body?.key ?? req.body);
    if (answers.length === 0) {
      throw badRequest('Provide answers as [{ questionNumber, answer }] or { "1": "A", "2": "C" }');
    }
    const outOfRange = answers.filter((a) => a.questionNumber < 1 || a.questionNumber > exam.questionCount);
    if (outOfRange.length > 0) {
      throw badRequest(
        `These question numbers are not part of the exam: ${outOfRange.map((a) => a.questionNumber).join(', ')}`
      );
    }

    const key = await OfficialKey.findOneAndUpdate(
      { examId: exam._id },
      { examId: exam._id, answers, uploadedBy: req.user._id, uploadedAt: new Date(), source: req.body?.source || 'MANUAL_UPLOAD' },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    req.io?.to(`exam:${exam._id}`).emit('official-key:uploaded', {
      examId: exam._id.toString(),
      answerCount: key.answers.length
    });
    res.json({ examId: exam._id.toString(), answerCount: key.answers.length, uploadedAt: key.uploadedAt });
  })
);

router.get(
  '/exams/:examId/official-key',
  requireAuth,
  asyncRoute(async (req, res) => {
    const key = await OfficialKey.findOne({ examId: req.params.examId }).lean();
    res.json({
      hasKey: Boolean(key),
      answerCount: key?.answers.length ?? 0,
      uploadedAt: key?.uploadedAt ?? null,
      answers: key?.answers ?? []
    });
  })
);

router.get(
  '/exams/:examId/validation',
  requireAuth,
  asyncRoute(async (req, res) => {
    const { exam, questions, submissions } = await loadExamData(req.params.examId);
    const [key, stored] = await Promise.all([
      OfficialKey.findOne({ examId: exam._id }).lean(),
      getStoredResults(exam._id)
    ]);
    if (!key) throw badRequest('No official key has been uploaded for this exam yet');
    if (Object.keys(stored).length === 0) throw badRequest('Consensus has not been computed for this exam yet');

    const matrix = toMatrix({ exam, questions, submissions });
    const results = Object.fromEntries(
      Object.entries(stored).map(([method, document]) => [method, { perQuestion: document.perQuestion, iterations: document.iterations, converged: document.converged }])
    );
    const comparison = compareMethods(matrix, key.answers, {
      ...consensusOptionsFor(exam),
      results
    });

    res.json({
      exam: exam.toPublic(),
      uploadedAt: key.uploadedAt,
      labels: METHOD_LABELS,
      ...comparison
    });
  })
);

router.get(
  '/exams/:examId/validation/curve',
  requireAuth,
  asyncRoute(async (req, res) => {
    const { exam, questions, submissions } = await loadExamData(req.params.examId);
    const key = await OfficialKey.findOne({ examId: exam._id }).lean();
    if (!key) throw badRequest('No official key has been uploaded for this exam yet');
    if (submissions.length < 4) throw badRequest('Too few submissions to draw a learning curve');

    const step = clampInt(req.query.step, 10, 2, 100);
    const trials = clampInt(req.query.trials, 5, 1, 20);
    const seed = clampInt(req.query.seed, 20240, 1, 2 ** 31 - 1);

    const cacheParams = {
      step,
      trials,
      seed,
      keyAt: key.uploadedAt?.getTime?.() ?? 0,
      examAt: exam.updatedAt?.getTime?.() ?? 0
    };
    const curve = await cached(req.params.examId, 'curve', cacheParams, () => {
      const matrix = toMatrix({ exam, questions, submissions });
      return accuracyVsCohortSize(matrix, keyToMap(key.answers), {
        ...consensusOptionsFor(exam),
        step,
        trials,
        seed
      });
    });

    res.json({ exam: exam.toPublic(), labels: METHOD_LABELS, ...curve });
  })
);

router.get(
  '/exams/:examId/validation/mismatches',
  requireAuth,
  asyncRoute(async (req, res) => {
    const key = await OfficialKey.findOne({ examId: req.params.examId }).lean();
    if (!key) throw badRequest('No official key has been uploaded for this exam yet');
    const stored = await getStoredResults(req.params.examId);
    if (Object.keys(stored).length === 0) throw badRequest('Consensus has not been computed for this exam yet');

    const byMethod = {};
    for (const [method, document] of Object.entries(stored)) {
      byMethod[method] = methodAccuracy(document.perQuestion, key.answers);
    }
    res.json({ labels: METHOD_LABELS, methods: byMethod });
  })
);

function normaliseKey(input) {
  if (Array.isArray(input)) {
    if (input.length === 0) return [];
    if (typeof input[0] === 'string') {
      return input
        .map((answer, index) => ({ questionNumber: index + 1, answer: `${answer}`.trim() }))
        .filter((a) => a.answer);
    }
    return input
      .map((entry) => ({
        questionNumber: Number(entry?.questionNumber),
        answer: `${entry?.answer ?? ''}`.trim()
      }))
      .filter((a) => Number.isInteger(a.questionNumber) && a.answer);
  }
  if (input && typeof input === 'object') {
    return Object.entries(input)
      .map(([number, answer]) => ({ questionNumber: Number(number), answer: `${answer ?? ''}`.trim() }))
      .filter((a) => Number.isInteger(a.questionNumber) && a.answer);
  }
  return [];
}

function clampInt(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export default router;
