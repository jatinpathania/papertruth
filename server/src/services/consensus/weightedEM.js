// Core consensus engine: single-parameter Dawid-Skene EM that infers a reliability
// weight per respondent, so a reliable minority can overturn a shared misconception.
import {
  answersByQuestion,
  compareOptions,
  countDistribution,
  optionDomain,
  questionIndex,
  questionNumbers
} from './matrix.js';
import { annotateDisputes } from './entropy.js';

export const METHOD = 'WEIGHTED_EM';

export const EM_DEFAULTS = {
  maxIterations: 100,
  tolerance: 1e-4,
  weightFloor: 0.01,
  weightCeiling: 0.99,
  smoothingPseudoCount: 5
};

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));

export function weightedEMConsensus(matrix, options = {}) {
  const cfg = { ...EM_DEFAULTS, ...options };
  const {
    weightFloor,
    weightCeiling,
    smoothingPseudoCount,
    tolerance,
    maxIterations
  } = cfg;

  const qNumbers = questionNumbers(matrix);
  const meta = questionIndex(matrix);
  const byQuestion = answersByQuestion(matrix);
  const responses = matrix.responses || [];

  const optionCounts = {};
  const questions = qNumbers.map((qn) => {
    const entries = byQuestion.get(qn) || [];
    const chosen = [...new Set(entries.map((e) => e.answer))].sort(compareOptions);
    const offered = optionDomain(matrix, qn).length;
    optionCounts[qn] = offered;
    const k = Math.max(offered, chosen.length, 2);
    return {
      number: qn,
      options: chosen,
      k,
      voteBonus: Math.log(k - 1),
      optionIndex: new Map(chosen.map((o, i) => [o, i])),
      chosenBy: chosen.map(() => []),
      distribution: countDistribution(entries),
      totalResponses: entries.length
    };
  });
  const questionPosition = new Map(questions.map((q, i) => [q.number, i]));

  const respondentAnswers = responses.map((r) => {
    const picks = [];
    for (const [qnRaw, answer] of Object.entries(r.answers || {})) {
      const qi = questionPosition.get(Number(qnRaw));
      if (qi === undefined) continue;
      const oi = questions[qi].optionIndex.get(answer);
      if (oi === undefined) continue;
      picks.push({ q: qi, o: oi });
    }
    return picks;
  });
  respondentAnswers.forEach((picks, ri) => {
    for (const { q, o } of picks) questions[q].chosenBy[o].push(ri);
  });

  let posterior = questions.map((q) => {
    const total = q.totalResponses || 1;
    return Float64Array.from(q.options, (o) => (q.distribution[o] || 0) / total);
  });
  let next = questions.map((q) => new Float64Array(q.options.length));

  const respondentCount = responses.length;
  const rawWeights = new Float64Array(respondentCount);
  const hasAnswers = respondentAnswers.map((picks) => picks.length > 0);
  const logits = new Float64Array(respondentCount);
  let weights = new Float64Array(respondentCount).fill(0.5);
  let iterations = 0;
  let converged = false;
  let maxDelta = Infinity;

  for (let iter = 1; iter <= maxIterations; iter += 1) {
    iterations = iter;

    let sumForMean = 0;
    let countForMean = 0;
    for (let ri = 0; ri < respondentCount; ri += 1) {
      if (!hasAnswers[ri]) continue;
      const picks = respondentAnswers[ri];
      let agreement = 0;
      for (let k = 0; k < picks.length; k += 1) agreement += posterior[picks[k].q][picks[k].o];
      const w = clamp(agreement / picks.length, weightFloor, weightCeiling);
      rawWeights[ri] = w;
      sumForMean += w;
      countForMean += 1;
    }
    const cohortMean = countForMean > 0 ? sumForMean / countForMean : 0.5;

    for (let ri = 0; ri < respondentCount; ri += 1) {
      let w;
      if (!hasAnswers[ri]) {
        w = cohortMean;
      } else {
        const n = respondentAnswers[ri].length;
        w = clamp(
          (n * rawWeights[ri] + smoothingPseudoCount * cohortMean) / (n + smoothingPseudoCount),
          weightFloor,
          weightCeiling
        );
      }
      weights[ri] = w;
      logits[ri] = Math.log(w / (1 - w));
    }

    for (let qi = 0; qi < questions.length; qi += 1) {
      const q = questions[qi];
      const scores = next[qi];
      if (scores.length === 0) continue;
      for (let oi = 0; oi < scores.length; oi += 1) {
        const voters = q.chosenBy[oi];
        let total = 0;
        for (let v = 0; v < voters.length; v += 1) total += logits[voters[v]] + q.voteBonus;
        scores[oi] = total;
      }
      softmaxInPlace(scores);
    }

    maxDelta = 0;
    for (let qi = 0; qi < next.length; qi += 1) {
      const a = next[qi];
      const b = posterior[qi];
      for (let oi = 0; oi < a.length; oi += 1) {
        const delta = Math.abs(a[oi] - b[oi]);
        if (delta > maxDelta) maxDelta = delta;
      }
    }
    const swap = posterior;
    posterior = next;
    next = swap;
    if (maxDelta < tolerance) {
      converged = true;
      break;
    }
  }

  const perQuestion = questions.map((q, qi) => {
    let bestIdx = -1;
    for (let oi = 0; oi < q.options.length; oi += 1) {
      if (bestIdx === -1) {
        bestIdx = oi;
        continue;
      }
      const better = posterior[qi][oi] > posterior[qi][bestIdx];
      const tie =
        Math.abs(posterior[qi][oi] - posterior[qi][bestIdx]) < 1e-12 &&
        compareOptions(q.options[oi], q.options[bestIdx]) < 0;
      if (better || tie) bestIdx = oi;
    }
    const consensusAnswer = bestIdx === -1 ? null : q.options[bestIdx];
    const topCount = consensusAnswer ? q.distribution[consensusAnswer] || 0 : 0;

    const weightByOption = q.options.map((_, oi) =>
      q.chosenBy[oi].reduce((sum, ri) => sum + weights[ri], 0)
    );
    const weightTotal = weightByOption.reduce((a, b) => a + b, 0);
    const weightedSupport = weightTotal > 0 ? weightByOption.map((w) => w / weightTotal) : weightByOption.map(() => 0);

    return {
      questionNumber: q.number,
      topic: meta.get(q.number)?.topic || 'General',
      consensusAnswer,
      confidence: bestIdx === -1 ? 0 : weightedSupport[bestIdx],
      posterior: bestIdx === -1 ? 0 : posterior[qi][bestIdx],
      rawAgreement: q.totalResponses > 0 ? topCount / q.totalResponses : 0,
      totalResponses: q.totalResponses,
      distribution: q.distribution,
      optionScores: Object.fromEntries(q.options.map((o, oi) => [o, weightedSupport[oi]])),
      optionPosteriors: Object.fromEntries(q.options.map((o, oi) => [o, posterior[qi][oi]])),
      overturnsMajority: consensusAnswer !== null && consensusAnswer !== pluralityOf(q.distribution)
    };
  });

  const respondentWeights = responses.map((r, ri) => ({
    respondentId: r.respondentId,
    weight: weights[ri],
    answered: respondentAnswers[ri].length
  }));

  const allWeights = respondentWeights.map((w) => w.weight);
  return {
    method: METHOD,
    iterations,
    converged,
    maxDelta,
    perQuestion: annotateDisputes(perQuestion, {
      optionCounts,
      disputeThreshold: options.disputeThreshold,
      marginThreshold: options.marginThreshold
    }),
    respondentWeights,
    weightStats: {
      mean: allWeights.length ? allWeights.reduce((a, b) => a + b, 0) / allWeights.length : 0,
      min: allWeights.length ? Math.min(...allWeights) : 0,
      max: allWeights.length ? Math.max(...allWeights) : 0
    }
  };
}

function softmaxInPlace(scores) {
  let max = -Infinity;
  for (let i = 0; i < scores.length; i += 1) if (scores[i] > max) max = scores[i];
  let sum = 0;
  for (let i = 0; i < scores.length; i += 1) {
    const value = Math.exp(scores[i] - max);
    scores[i] = value;
    sum += value;
  }
  if (!(sum > 0) || !Number.isFinite(sum)) {
    scores.fill(1 / scores.length);
    return scores;
  }
  for (let i = 0; i < scores.length; i += 1) scores[i] /= sum;
  return scores;
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

export default weightedEMConsensus;
