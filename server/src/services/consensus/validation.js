// Validates the consensus key against the official key and measures divergence.
import { mulberry32, sample } from '../../utils/rng.js';
import { majorityConsensus } from './majority.js';
import { weightedEMConsensus } from './weightedEM.js';
import { surprisinglyPopularConsensus } from './surprisinglyPopular.js';
import { subsetMatrix, hasPredictions } from './matrix.js';

export const METHODS = {
  MAJORITY: 'MAJORITY',
  WEIGHTED_EM: 'WEIGHTED_EM',
  SURPRISINGLY_POPULAR: 'SURPRISINGLY_POPULAR'
};

export const METHOD_LABELS = {
  MAJORITY: 'Majority vote',
  WEIGHTED_EM: 'Weighted EM',
  SURPRISINGLY_POPULAR: 'Surprisingly popular'
};

const RUNNERS = {
  [METHODS.MAJORITY]: majorityConsensus,
  [METHODS.WEIGHTED_EM]: weightedEMConsensus,
  [METHODS.SURPRISINGLY_POPULAR]: surprisinglyPopularConsensus
};

export function applicableMethods(matrix, { collectPredictions } = {}) {
  const methods = [METHODS.MAJORITY, METHODS.WEIGHTED_EM];
  if (collectPredictions ?? hasPredictions(matrix)) methods.push(METHODS.SURPRISINGLY_POPULAR);
  return methods;
}

export function runMethod(method, matrix, options = {}) {
  const runner = RUNNERS[method];
  if (!runner) throw new Error(`Unknown consensus method: ${method}`);
  return runner(matrix, options);
}

export function runAllMethods(matrix, options = {}) {
  const methods = applicableMethods(matrix, options);
  const out = {};
  for (const method of methods) out[method] = runMethod(method, matrix, options);
  return out;
}

export function keyToMap(officialAnswers = []) {
  const map = new Map();
  for (const entry of officialAnswers) {
    if (!entry) continue;
    const qn = Number(entry.questionNumber);
    if (!Number.isFinite(qn)) continue;
    if (entry.answer === undefined || entry.answer === null) continue;
    map.set(qn, `${entry.answer}`);
  }
  return map;
}

export function methodAccuracy(perQuestion = [], officialAnswers = []) {
  const key = officialAnswers instanceof Map ? officialAnswers : keyToMap(officialAnswers);
  let comparable = 0;
  let matched = 0;
  let disputedComparable = 0;
  let disputedMatched = 0;
  let confidentComparable = 0;
  let confidentMatched = 0;
  const mismatches = [];

  for (const q of perQuestion) {
    const truth = key.get(Number(q.questionNumber));
    if (truth === undefined) continue;
    if (q.consensusAnswer === null || q.consensusAnswer === undefined) continue;
    comparable += 1;
    const hit = q.consensusAnswer === truth;
    if (hit) matched += 1;
    else {
      mismatches.push({
        questionNumber: q.questionNumber,
        consensusAnswer: q.consensusAnswer,
        officialAnswer: truth,
        confidence: q.confidence ?? 0,
        disputed: Boolean(q.disputed),
        normalisedEntropy: q.normalisedEntropy ?? 0
      });
    }
    if (q.disputed) {
      disputedComparable += 1;
      if (hit) disputedMatched += 1;
    } else {
      confidentComparable += 1;
      if (hit) confidentMatched += 1;
    }
  }

  return {
    accuracy: comparable > 0 ? matched / comparable : 0,
    matched,
    comparable,
    disputedAccuracy: disputedComparable > 0 ? disputedMatched / disputedComparable : null,
    disputedComparable,
    undisputedAccuracy: confidentComparable > 0 ? confidentMatched / confidentComparable : null,
    undisputedComparable: confidentComparable,
    mismatches: mismatches.sort((a, b) => a.questionNumber - b.questionNumber)
  };
}

export function compareMethods(matrix, officialAnswers, options = {}) {
  const key = officialAnswers instanceof Map ? officialAnswers : keyToMap(officialAnswers);
  const results = options.results || runAllMethods(matrix, options);
  const majorityByQuestion = new Map(
    (results[METHODS.MAJORITY]?.perQuestion || []).map((q) => [q.questionNumber, q.consensusAnswer])
  );

  const methods = Object.entries(results).map(([method, result]) => {
    const accuracy = methodAccuracy(result.perQuestion, key);
    return {
      method,
      label: METHOD_LABELS[method] || method,
      ...accuracy,
      iterations: result.iterations,
      converged: result.converged
    };
  });

  const em = results[METHODS.WEIGHTED_EM];
  const overturned = (em?.perQuestion || [])
    .filter((q) => q.overturnsMajority && key.has(Number(q.questionNumber)))
    .map((q) => {
      const truth = key.get(Number(q.questionNumber));
      const majorityAnswer = majorityByQuestion.get(q.questionNumber) ?? null;
      return {
        questionNumber: q.questionNumber,
        majorityAnswer,
        weightedAnswer: q.consensusAnswer,
        officialAnswer: truth,
        weightedCorrect: q.consensusAnswer === truth,
        majorityCorrect: majorityAnswer === truth,
        confidence: q.confidence ?? 0
      };
    })
    .sort((a, b) => a.questionNumber - b.questionNumber);

  return {
    methods: methods.sort((a, b) => b.accuracy - a.accuracy),
    keyedQuestions: key.size,
    respondents: (matrix.responses || []).length,
    overturnedQuestions: overturned,
    overturnedWonByWeighting: overturned.filter((o) => o.weightedCorrect).length,
    overturnedLostByWeighting: overturned.filter((o) => o.majorityCorrect).length
  };
}

export function accuracyVsCohortSize(matrix, officialAnswers, {
  step = 10,
  trials = 5,
  minSize = 10,
  maxSize,
  seed = 20240,
  methods,
  ...consensusOptions
} = {}) {
  const key = officialAnswers instanceof Map ? officialAnswers : keyToMap(officialAnswers);
  const respondentIds = (matrix.responses || []).map((r) => r.respondentId);
  const total = respondentIds.length;
  const methodList = methods || applicableMethods(matrix, consensusOptions);
  const rng = mulberry32(seed);

  const sizes = [];
  for (let n = Math.max(2, minSize); n < Math.min(total, maxSize ?? total); n += step) sizes.push(n);
  if (total >= 2) sizes.push(Math.min(total, maxSize ?? total));

  const curve = sizes.map((cohortSize) => {
    const perMethod = Object.fromEntries(methodList.map((m) => [m, []]));
    const effectiveTrials = cohortSize >= total ? 1 : trials;
    for (let trial = 0; trial < effectiveTrials; trial += 1) {
      const subset = subsetMatrix(matrix, sample(rng, respondentIds, cohortSize));
      for (const method of methodList) {
        perMethod[method].push(methodAccuracy(runMethod(method, subset, consensusOptions).perQuestion, key).accuracy);
      }
    }
    const row = { cohortSize, trials: effectiveTrials };
    for (const method of methodList) {
      const values = perMethod[method];
      row[method] = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      row[`${method}_min`] = values.length ? Math.min(...values) : 0;
      row[`${method}_max`] = values.length ? Math.max(...values) : 0;
    }
    return row;
  });

  return { curve, methods: methodList, trials, seed, respondents: total };
}

export default compareMethods;
