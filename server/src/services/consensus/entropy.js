// Entropy and agreement measures used to score how contested each question is.
import { compareOptions } from './matrix.js';

export const DEFAULT_DISPUTE_THRESHOLD = 0.85;
export const DEFAULT_MARGIN_THRESHOLD = 0.1;

export function distributionTotal(distribution) {
  return Object.values(distribution || {}).reduce((sum, c) => sum + (Number(c) || 0), 0);
}

export function shannonEntropy(distribution) {
  const total = distributionTotal(distribution);
  if (total <= 0) return 0;
  let h = 0;
  for (const count of Object.values(distribution)) {
    const c = Number(count) || 0;
    if (c <= 0) continue;
    const p = c / total;
    h -= p * Math.log2(p);
  }
  return h <= 0 ? 0 : h;
}

export function normalisedEntropy(distribution, k) {
  const optionCount = Number.isFinite(k) && k > 0 ? k : Object.keys(distribution || {}).length;
  if (optionCount <= 1) return 0;
  const normalised = shannonEntropy(distribution) / Math.log2(optionCount);
  if (!Number.isFinite(normalised)) return 0;
  return Math.min(1, Math.max(0, normalised));
}

export function rankedOptions(distribution) {
  return Object.entries(distribution || {})
    .map(([option, count]) => [option, Number(count) || 0])
    .sort((a, b) => b[1] - a[1] || compareOptions(a[0], b[0]));
}

export function topTwoMargin(distribution) {
  const total = distributionTotal(distribution);
  if (total <= 0) return 0;
  const ranked = rankedOptions(distribution);
  const top = ranked[0]?.[1] || 0;
  const second = ranked[1]?.[1] || 0;
  return (top - second) / total;
}

export function assessDispute(distribution, {
  optionCount,
  disputeThreshold = DEFAULT_DISPUTE_THRESHOLD,
  marginThreshold = DEFAULT_MARGIN_THRESHOLD
} = {}) {
  const total = distributionTotal(distribution);
  const entropy = shannonEntropy(distribution);
  const normalised = normalisedEntropy(distribution, optionCount);
  const margin = topTwoMargin(distribution);
  const highEntropy = normalised > disputeThreshold;
  const narrowMargin = total > 0 && margin < marginThreshold;
  return {
    entropy,
    normalisedEntropy: normalised,
    margin,
    disputed: Boolean(highEntropy || narrowMargin),
    disputeReasons: [highEntropy && 'HIGH_ENTROPY', narrowMargin && 'NARROW_MARGIN'].filter(Boolean)
  };
}

export function annotateDisputes(perQuestion, {
  optionCounts = {},
  disputeThreshold = DEFAULT_DISPUTE_THRESHOLD,
  marginThreshold = DEFAULT_MARGIN_THRESHOLD
} = {}) {
  return perQuestion.map((q) => ({
    ...q,
    ...assessDispute(q.distribution, {
      optionCount: optionCounts[q.questionNumber],
      disputeThreshold,
      marginThreshold
    })
  }));
}
