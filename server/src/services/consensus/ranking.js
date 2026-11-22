// Ranks questions by how contested they are, most disputed first.
export function compareDisputed(a, b) {
  const entropyDelta = (b.normalisedEntropy || 0) - (a.normalisedEntropy || 0);
  if (Math.abs(entropyDelta) > 1e-12) return entropyDelta;
  const marginDelta = (a.margin ?? 1) - (b.margin ?? 1);
  if (Math.abs(marginDelta) > 1e-12) return marginDelta;
  return (a.questionNumber || 0) - (b.questionNumber || 0);
}

export function topKDisputed(perQuestion, k = 10, { onlyFlagged = false } = {}) {
  if (!Number.isFinite(k) || k <= 0) return [];
  return (perQuestion || [])
    .filter((q) => (q.totalResponses || 0) > 0 && (!onlyFlagged || q.disputed))
    .sort(compareDisputed)
    .slice(0, k);
}

export default topKDisputed;
