// Surprisingly Popular: picks the option chosen more often than respondents predicted
// it would be, recovering the truth when the majority is confidently wrong.
import {
  answersByQuestion,
  compareOptions,
  countDistribution,
  optionDomain,
  predictionsByQuestion,
  questionIndex,
  questionNumbers
} from './matrix.js';
import { annotateDisputes } from './entropy.js';

export const METHOD = 'SURPRISINGLY_POPULAR';

export const SP_DEFAULTS = {
  minShareRatio: 0.5
};

export function surprisinglyPopularConsensus(matrix, options = {}) {
  const minShareRatio = Number.isFinite(options.minShareRatio)
    ? options.minShareRatio
    : SP_DEFAULTS.minShareRatio;
  const qNumbers = questionNumbers(matrix);
  const meta = questionIndex(matrix);
  const answers = answersByQuestion(matrix);
  const predictions = predictionsByQuestion(matrix);
  const optionCounts = {};

  let questionsWithPredictions = 0;

  const perQuestion = qNumbers.map((qn) => {
    const answerEntries = answers.get(qn) || [];
    const predictionEntries = predictions.get(qn) || [];
    const answerCounts = countDistribution(answerEntries, 'answer');
    const predictionCounts = countDistribution(predictionEntries, 'prediction');
    const answerTotal = answerEntries.length;
    const predictionTotal = predictionEntries.length;
    if (predictionTotal > 0) questionsWithPredictions += 1;

    optionCounts[qn] = optionDomain(matrix, qn).length;
    const domain = [...new Set([...Object.keys(answerCounts), ...Object.keys(predictionCounts)])].sort(
      compareOptions
    );

    const actual = {};
    const predicted = {};
    const spScores = {};
    for (const option of domain) {
      actual[option] = answerTotal > 0 ? (answerCounts[option] || 0) / answerTotal : 0;
      predicted[option] = predictionTotal > 0 ? (predictionCounts[option] || 0) / predictionTotal : 0;
      spScores[option] = actual[option] - predicted[option];
    }

    const applicable = predictionTotal > 0;
    const modeOption = pluralityOf(answerCounts);
    const modeShare = modeOption ? actual[modeOption] || 0 : 0;

    const pureConsensusAnswer = argmaxBy(domain, (o) => spScores[o]);

    const eligibleOptions = domain.filter(
      (o) => o === modeOption || (actual[o] || 0) >= minShareRatio * modeShare
    );
    let consensusAnswer = argmaxBy(eligibleOptions, (o) => spScores[o]);
    if (!applicable) consensusAnswer = modeOption;
    if (answerTotal === 0) consensusAnswer = null;

    const confidence = normaliseScores(domain, spScores)[consensusAnswer] ?? 0;

    return {
      questionNumber: qn,
      topic: meta.get(qn)?.topic || 'General',
      consensusAnswer,
      confidence: answerTotal > 0 ? confidence : 0,
      rawAgreement: consensusAnswer ? actual[consensusAnswer] || 0 : 0,
      totalResponses: answerTotal,
      predictionResponses: predictionTotal,
      distribution: answerCounts,
      predictionDistribution: predictionCounts,
      actual,
      predicted,
      spScores,
      optionScores: normaliseScores(domain, spScores),
      applicable,
      eligibleOptions,
      pureConsensusAnswer,
      guardApplied: pureConsensusAnswer !== null && pureConsensusAnswer !== consensusAnswer,
      overturnsMajority:
        consensusAnswer !== null && consensusAnswer !== pluralityOf(answerCounts)
    };
  });

  return {
    method: METHOD,
    iterations: 1,
    converged: true,
    applicable: questionsWithPredictions > 0,
    questionsWithPredictions,
    minShareRatio,
    perQuestion: annotateDisputes(perQuestion, {
      optionCounts,
      disputeThreshold: options.disputeThreshold,
      marginThreshold: options.marginThreshold
    }),
    respondentWeights: (matrix.responses || []).map((r) => ({
      respondentId: r.respondentId,
      weight: 1,
      answered: Object.keys(r.answers || {}).length
    }))
  };
}

function argmaxBy(items, scoreOf) {
  let best = null;
  for (const item of items) {
    if (best === null || scoreOf(item) > scoreOf(best)) best = item;
  }
  return best;
}

function normaliseScores(domain, scores) {
  if (domain.length === 0) return {};
  const values = domain.map((o) => scores[o]);
  const min = Math.min(...values);
  const shifted = values.map((v) => v - min);
  const sum = shifted.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) return Object.fromEntries(domain.map((o) => [o, 1 / domain.length]));
  return Object.fromEntries(domain.map((o, i) => [o, shifted[i] / sum]));
}

function pluralityOf(distribution) {
  let best = null;
  let bestCount = -1;
  for (const [option, count] of Object.entries(distribution || {})) {
    if (count > bestCount || (count === bestCount && compareOptions(option, best) < 0)) {
      best = option;
      bestCount = count;
    }
  }
  return best;
}

export default surprisinglyPopularConsensus;
