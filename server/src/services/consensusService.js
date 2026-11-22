// Orchestrates the consensus pipeline: matrix -> methods -> integrity -> persisted result.
import { ConsensusResult, Exam, OfficialKey, Question, Submission } from '../models/index.js';
import { EXAM_STATUS } from '../models/Exam.js';
import { buildMatrix } from './consensus/matrix.js';
import { computeConsensus } from './consensus/index.js';
import { summariseConsensus } from './consensus/scoring.js';
import { detectCollusion } from './consensus/integrity.js';
import { topKDisputed } from './consensus/ranking.js';
import { embeddingsForShortAnswers } from './gemini.js';
import { notFound } from '../middleware/errors.js';
import { cached, invalidateExam } from './computeCache.js';

export async function loadExamData(examId) {
  const exam = await Exam.findById(examId);
  if (!exam) throw notFound('Exam not found');
  const [questions, submissions] = await Promise.all([
    Question.find({ examId }).sort({ number: 1 }).lean(),
    Submission.find({ examId }).lean()
  ]);
  return { exam, questions, submissions };
}

export function toMatrix({ exam, questions, submissions }) {
  const declaredQuestions = questions.length
    ? questions
    :
      Array.from({ length: exam.questionCount }, (_, i) => ({ number: i + 1, type: 'MCQ', options: [] }));

  return buildMatrix({
    questions: declaredQuestions,
    submissions: submissions.map((s) => ({ respondentId: s.respondentId, answers: s.answers }))
  });
}

export function consensusOptionsFor(exam) {
  return {
    disputeThreshold: exam.disputeThreshold ?? 0.85,
    collectPredictions: Boolean(exam.collectPredictions)
  };
}

export async function computeAndStoreConsensus(examId, { io, logger = console } = {}) {
  invalidateExam(examId);
  const { exam, questions, submissions } = await loadExamData(examId);
  const matrix = toMatrix({ exam, questions, submissions });

  if (matrix.responses.length === 0) {
    throw Object.assign(new Error('No submissions yet — nothing to compute'), { status: 400 });
  }

  const embeddingsByQuestion = await embeddingsForShortAnswers(questions, submissions, { logger });

  const { results, summaries, groupsByQuestion, methods } = computeConsensus(matrix, {
    ...consensusOptionsFor(exam),
    embeddingsByQuestion
  });

  const saved = [];
  for (const method of methods) {
    const result = results[method];
    const document = await ConsensusResult.findOneAndUpdate(
      { examId: exam._id, method },
      {
        examId: exam._id,
        method,
        computedAt: new Date(),
        respondentCount: matrix.responses.length,
        iterations: result.iterations,
        converged: result.converged,
        perQuestion: result.perQuestion,
        respondentWeights: result.respondentWeights,
        summary: {
          ...summaries[method],
          shortAnswerGroups: groupsByQuestion,
          semanticGrouping: Object.keys(embeddingsByQuestion).length > 0
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    saved.push(document);
  }

  await ConsensusResult.deleteMany({ examId: exam._id, method: { $nin: methods } });

  const windowOver = exam.status === EXAM_STATUS.CLOSED || (exam.closesAt && new Date() > exam.closesAt);
  if (windowOver) {
    exam.status = EXAM_STATUS.COMPUTED;
    await exam.save();
  }

  const payload = {
    examId: exam._id.toString(),
    methods,
    computedAt: new Date().toISOString(),
    respondentCount: matrix.responses.length,
    summaries
  };
  io?.to(`exam:${exam._id}`).emit('consensus:computed', payload);
  logger.log(
    `[consensus] exam ${exam._id} computed for ${methods.join(', ')} over ${matrix.responses.length} respondents`
  );

  return { exam, results, summaries, methods, saved };
}

export async function getStoredResult(examId, method) {
  return ConsensusResult.findOne({ examId, method }).lean();
}

export async function getStoredResults(examId) {
  const documents = await ConsensusResult.find({ examId }).lean();
  return Object.fromEntries(documents.map((d) => [d.method, d]));
}

export async function livePreview(examId) {
  const { exam, questions, submissions } = await loadExamData(examId);
  const matrix = toMatrix({ exam, questions, submissions });
  if (matrix.responses.length === 0) {
    return { respondentCount: 0, methods: {}, disputedCount: 0 };
  }
  const { results } = computeConsensus(matrix, consensusOptionsFor(exam));
  const methods = {};
  for (const [method, result] of Object.entries(results)) {
    methods[method] = summariseConsensus(result.perQuestion);
  }
  return {
    respondentCount: matrix.responses.length,
    methods,
    disputedCount: methods.MAJORITY?.disputedQuestions ?? 0
  };
}

export async function collusionReport(examId, options = {}) {
  return cached(examId, 'collusion', options, async () => {
    const { exam, questions, submissions } = await loadExamData(examId);
    const matrix = toMatrix({ exam, questions, submissions });
    return detectCollusion(matrix, options);
  });
}

export async function rankedDisputes(examId, { method = 'MAJORITY', limit = 10, onlyFlagged = false } = {}) {
  const stored = (await getStoredResult(examId, method)) || (await getStoredResult(examId, 'MAJORITY'));
  if (!stored) return { method: null, questions: [], computedAt: null };
  return {
    method: stored.method,
    computedAt: stored.computedAt,
    questions: topKDisputed(stored.perQuestion, limit, { onlyFlagged })
  };
}

export async function loadOfficialKey(examId) {
  const key = await OfficialKey.findOne({ examId }).lean();
  return key ? key.answers : null;
}
