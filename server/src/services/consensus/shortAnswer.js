// Short-answer consensus: normalises and clusters free-text answers before voting.
import { connectedComponents } from './groups.js';

export const SHORT_ANSWER_DEFAULTS = {
  maxAbsoluteDistance: 2,
  maxRelativeDistance: 0.2,
  similarityThreshold: 0.85
};

export function normaliseAnswer(raw) {
  if (raw === null || raw === undefined) return '';
  return `${raw}`
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

let scratchA = new Array(64);
let scratchB = new Array(64);

export function levenshtein(a = '', b = '', maxDistance = Infinity) {
  const s = `${a}`;
  const t = `${b}`;
  if (s === t) return 0;
  if (s.length === 0) return t.length;
  if (t.length === 0) return s.length;

  const [short, long] = s.length <= t.length ? [s, t] : [t, s];
  if (long.length - short.length > maxDistance) return maxDistance + 1;

  if (scratchA.length < short.length + 1) {
    scratchA = new Array(short.length + 1);
    scratchB = new Array(short.length + 1);
  }
  let previous = scratchA;
  let current = scratchB;
  for (let j = 0; j <= short.length; j += 1) previous[j] = j;

  for (let i = 1; i <= long.length; i += 1) {
    current[0] = i;
    const longChar = long.charCodeAt(i - 1);
    let rowBest = i;
    for (let j = 1; j <= short.length; j += 1) {
      const substitutionCost = longChar === short.charCodeAt(j - 1) ? 0 : 1;
      const value = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + substitutionCost
      );
      current[j] = value;
      if (value < rowBest) rowBest = value;
    }
    if (rowBest > maxDistance) return maxDistance + 1;
    const swap = previous;
    previous = current;
    current = swap;
  }
  scratchA = previous;
  scratchB = current;
  return previous[short.length];
}

export function nearDuplicateLimit(a, b, maxAbsoluteDistance, maxRelativeDistance) {
  const longest = Math.max(a.length, b.length);
  return Math.max(maxAbsoluteDistance, Math.floor(maxRelativeDistance * longest));
}

export function isNearDuplicate(a, b, {
  maxAbsoluteDistance = SHORT_ANSWER_DEFAULTS.maxAbsoluteDistance,
  maxRelativeDistance = SHORT_ANSWER_DEFAULTS.maxRelativeDistance
} = {}) {
  if (a === b) return true;
  if (!a || !b) return false;
  const limit = nearDuplicateLimit(a, b, maxAbsoluteDistance, maxRelativeDistance);
  if (Math.abs(a.length - b.length) > limit) return false;
  return levenshtein(a, b, limit) <= limit;
}

export function groupShortAnswers(answers = [], options = {}) {
  const entries = answers.map((a) =>
    typeof a === 'string' ? { respondentId: undefined, answer: a } : a
  );

  const distinct = new Map();
  for (const { respondentId, answer } of entries) {
    const normalised = normaliseAnswer(answer);
    if (!normalised) continue;
    if (!distinct.has(normalised)) {
      distinct.set(normalised, { count: 0, variants: new Map(), respondentIds: [] });
    }
    const record = distinct.get(normalised);
    record.count += 1;
    record.variants.set(`${answer}`.trim(), (record.variants.get(`${answer}`.trim()) || 0) + 1);
    if (respondentId !== undefined) record.respondentIds.push(respondentId);
  }

  const keys = [...distinct.keys()];
  const maxAbsoluteDistance = options.maxAbsoluteDistance ?? SHORT_ANSWER_DEFAULTS.maxAbsoluteDistance;
  const maxRelativeDistance = options.maxRelativeDistance ?? SHORT_ANSWER_DEFAULTS.maxRelativeDistance;
  const canStopEarly = maxRelativeDistance < 1;
  const byLength = [...keys].sort((x, y) => x.length - y.length);

  const edges = [];
  for (let i = 0; i < byLength.length; i += 1) {
    const a = byLength[i];
    for (let j = i + 1; j < byLength.length; j += 1) {
      const b = byLength[j];
      const gap = b.length - a.length;
      if (canStopEarly && gap > nearDuplicateLimit(a, b, maxAbsoluteDistance, maxRelativeDistance)) break;
      if (isNearDuplicate(a, b, options)) edges.push([a, b]);
    }
  }

  const groups = buildGroups(connectedComponents(keys, edges), distinct);
  return finaliseGroups(groups);
}

function buildGroups(components, distinct) {
  return components.map((members) => {
    const variants = new Map();
    const respondentIds = [];
    const normalisedForms = [];
    let count = 0;
    for (const normalised of [...members].sort()) {
      const record = distinct.get(normalised);
      if (!record) continue;
      normalisedForms.push(normalised);
      count += record.count;
      respondentIds.push(...record.respondentIds);
      for (const [raw, n] of record.variants) variants.set(raw, (variants.get(raw) || 0) + n);
    }
    return { normalisedForms, count, respondentIds, variants };
  });
}

function finaliseGroups(rawGroups) {
  const groups = rawGroups
    .map((group) => {
      const label = [...group.variants.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].length - b[0].length || a[0].localeCompare(b[0])
      )[0][0];
      return {
        label,
        count: group.count,
        respondentIds: group.respondentIds,
        normalisedForms: [...group.normalisedForms].sort(),
        variants: Object.fromEntries(
          [...group.variants.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        )
      };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const labelOf = new Map();
  for (const group of groups) {
    for (const normalised of group.normalisedForms) labelOf.set(normalised, group.label);
  }
  return { groups, labelOf };
}

export function cosineSimilarity(a = [], b = []) {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < n; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function mergeGroupsBySimilarity(grouped, embeddings = {}, {
  similarityThreshold = SHORT_ANSWER_DEFAULTS.similarityThreshold
} = {}) {
  const groups = grouped.groups || [];
  if (groups.length < 2) return grouped;

  const edges = [];
  const merges = [];
  for (let i = 0; i < groups.length; i += 1) {
    for (let j = i + 1; j < groups.length; j += 1) {
      const vecA = embeddings[groups[i].label];
      const vecB = embeddings[groups[j].label];
      if (!Array.isArray(vecA) || !Array.isArray(vecB)) continue;
      const similarity = cosineSimilarity(vecA, vecB);
      if (similarity >= similarityThreshold) {
        edges.push([groups[i].label, groups[j].label]);
        merges.push({ a: groups[i].label, b: groups[j].label, similarity });
      }
    }
  }
  if (merges.length === 0) return { ...grouped, semanticMerges: [] };

  const byLabel = new Map(groups.map((g) => [g.label, g]));
  const components = connectedComponents(groups.map((g) => g.label), edges);
  const rebuilt = components.map((labels) => {
    const members = labels.map((label) => byLabel.get(label)).filter(Boolean);
    const variants = new Map();
    const respondentIds = [];
    const normalisedForms = [];
    let count = 0;
    for (const member of members) {
      count += member.count;
      respondentIds.push(...member.respondentIds);
      normalisedForms.push(...member.normalisedForms);
      for (const [raw, n] of Object.entries(member.variants)) {
        variants.set(raw, (variants.get(raw) || 0) + n);
      }
    }
    return { normalisedForms, count, respondentIds, variants };
  });

  return { ...finaliseGroups(rebuilt), semanticMerges: merges };
}

export function canonicaliseShortAnswers(matrix, embeddingsByQuestion = {}, options = {}) {
  const shortQuestions = (matrix.questions || []).filter((q) => q.type === 'SHORT');
  if (shortQuestions.length === 0) return { matrix, groupsByQuestion: {} };

  const groupsByQuestion = {};
  const labelLookup = new Map();

  for (const question of shortQuestions) {
    const answers = [];
    for (const r of matrix.responses || []) {
      const answer = r.answers?.[question.number];
      if (answer !== undefined) answers.push({ respondentId: r.respondentId, answer });
    }
    let grouped = groupShortAnswers(answers, options);
    const embeddings = embeddingsByQuestion[question.number];
    if (embeddings && Object.keys(embeddings).length > 1) {
      grouped = mergeGroupsBySimilarity(grouped, embeddings, options);
    }
    groupsByQuestion[question.number] = grouped.groups;
    labelLookup.set(question.number, grouped.labelOf);
  }

  const responses = (matrix.responses || []).map((r) => {
    const answers = { ...r.answers };
    for (const question of shortQuestions) {
      const raw = answers[question.number];
      if (raw === undefined) continue;
      const label = labelLookup.get(question.number)?.get(normaliseAnswer(raw));
      if (label) answers[question.number] = label;
    }
    return { ...r, answers };
  });

  const questions = (matrix.questions || []).map((q) =>
    q.type === 'SHORT' && groupsByQuestion[q.number]
      ? { ...q, options: groupsByQuestion[q.number].map((g) => g.label) }
      : q
  );

  return { matrix: { questions, responses }, groupsByQuestion };
}

export default groupShortAnswers;
