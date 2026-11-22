// Integrity checks: flags collusion, copying and anomalous answer patterns in a cohort.
import { connectedComponents } from './groups.js';

export const INTEGRITY_DEFAULTS = {
  rareAnswerThreshold: 0.2,
  rareMatchThreshold: null,
  minRareMatches: 5,
  sigmaMultiplier: 6,
  minClusterSize: 2
};

export function answerSignature(response, questionNumbers) {
  return questionNumbers.map((qn) => `${qn}:${response.answers?.[qn] ?? '-'}`).join('|');
}

export function detectCollusion(matrix, options = {}) {
  const cfg = { ...INTEGRITY_DEFAULTS, ...options };
  const responses = matrix.responses || [];
  const questionNumbers = (matrix.questions || []).length
    ? matrix.questions.map((q) => q.number)
    : [...new Set(responses.flatMap((r) => Object.keys(r.answers || {}).map(Number)))].sort((a, b) => a - b);

  const emptyResult = {
    params: cfg,
    calibration: {
      rareMatchThreshold: cfg.rareMatchThreshold ?? cfg.minRareMatches,
      isDefault: !Number.isFinite(cfg.rareMatchThreshold),
      expectedRareMatches: 0,
      rareMatchStdDev: 0,
      comparedPairs: 0
    },
    totalRespondents: responses.length,
    identicalGroups: [],
    suspiciousPairs: [],
    clusters: [],
    rareAnswerCount: 0
  };
  if (responses.length < 2) return emptyResult;

  const bySignature = new Map();
  for (const r of responses) {
    const signature = answerSignature(r, questionNumbers);
    if (!bySignature.has(signature)) bySignature.set(signature, []);
    bySignature.get(signature).push(r.respondentId);
  }
  const identicalGroups = [...bySignature.entries()]
    .filter(([, ids]) => ids.length >= 2)
    .map(([signature, respondentIds]) => ({
      respondentIds,
      size: respondentIds.length,
      fingerprint: hashSignature(signature)
    }));

  const rareKeys = new Set();
  const chanceOverlap = [];
  for (const qn of questionNumbers) {
    const counts = new Map();
    let total = 0;
    for (const r of responses) {
      const a = r.answers?.[qn];
      if (a === undefined) continue;
      counts.set(a, (counts.get(a) || 0) + 1);
      total += 1;
    }
    if (total === 0) continue;
    let chance = 0;
    for (const [answer, count] of counts) {
      const p = count / total;
      if (p < cfg.rareAnswerThreshold) {
        rareKeys.add(`${qn}:${answer}`);
        chance += p * p;
      }
    }
    chanceOverlap.push(chance);
  }

  const expectedRareMatches = chanceOverlap.reduce((a, b) => a + b, 0);
  const rareMatchStdDev = Math.sqrt(chanceOverlap.reduce((sum, v) => sum + v * (1 - v), 0));
  const comparedPairs = (responses.length * (responses.length - 1)) / 2;
  const rareMatchThreshold = Number.isFinite(cfg.rareMatchThreshold)
    ? cfg.rareMatchThreshold
    : Math.max(cfg.minRareMatches, Math.ceil(expectedRareMatches + cfg.sigmaMultiplier * rareMatchStdDev));

  const rareSets = responses.map((r) => {
    const set = new Set();
    for (const qn of questionNumbers) {
      const a = r.answers?.[qn];
      if (a === undefined) continue;
      const key = `${qn}:${a}`;
      if (rareKeys.has(key)) set.add(key);
    }
    return set;
  });

  const suspiciousPairs = [];
  const edges = [];
  for (let i = 0; i < responses.length; i += 1) {
    if (rareSets[i].size <= rareMatchThreshold) continue;
    for (let j = i + 1; j < responses.length; j += 1) {
      if (rareSets[j].size <= rareMatchThreshold) continue;
      const [small, large] = rareSets[i].size <= rareSets[j].size
        ? [rareSets[i], rareSets[j]]
        : [rareSets[j], rareSets[i]];
      let rareMatches = 0;
      let remaining = small.size;
      for (const key of small) {
        if (large.has(key)) rareMatches += 1;
        remaining -= 1;
        if (rareMatches + remaining <= rareMatchThreshold) break;
      }
      if (rareMatches > rareMatchThreshold) {
        suspiciousPairs.push({
          a: responses[i].respondentId,
          b: responses[j].respondentId,
          rareMatches,
          sharedAnswers: countSharedAnswers(responses[i], responses[j], questionNumbers)
        });
        edges.push([responses[i].respondentId, responses[j].respondentId]);
      }
    }
  }

  for (const group of identicalGroups) {
    for (let i = 1; i < group.respondentIds.length; i += 1) {
      edges.push([group.respondentIds[0], group.respondentIds[i]]);
    }
  }

  const identicalMembers = new Set(identicalGroups.flatMap((g) => g.respondentIds));
  const clusters = connectedComponents(responses.map((r) => r.respondentId), edges)
    .filter((members) => members.length >= cfg.minClusterSize)
    .map((respondentIds) => {
      const members = new Set(respondentIds);
      const pairs = suspiciousPairs.filter((p) => members.has(p.a) && members.has(p.b));
      const rareCounts = pairs.map((p) => p.rareMatches);
      return {
        respondentIds: [...respondentIds].sort(),
        size: respondentIds.length,
        containsIdenticalSubmissions: respondentIds.some((id) => identicalMembers.has(id)),
        pairs,
        maxRareMatches: rareCounts.length ? Math.max(...rareCounts) : 0,
        avgRareMatches: rareCounts.length
          ? rareCounts.reduce((a, b) => a + b, 0) / rareCounts.length
          : 0
      };
    })
    .sort((a, b) => b.size - a.size || b.maxRareMatches - a.maxRareMatches);

  return {
    params: { ...cfg, rareMatchThreshold },
    calibration: {
      rareMatchThreshold,
      isDefault: !Number.isFinite(cfg.rareMatchThreshold),
      expectedRareMatches,
      rareMatchStdDev,
      sigmaMultiplier: cfg.sigmaMultiplier,
      comparedPairs
    },
    totalRespondents: responses.length,
    identicalGroups,
    suspiciousPairs: suspiciousPairs.sort((a, b) => b.rareMatches - a.rareMatches),
    clusters,
    rareAnswerCount: rareKeys.size
  };
}

function countSharedAnswers(a, b, questionNumbers) {
  let shared = 0;
  for (const qn of questionNumbers) {
    const x = a.answers?.[qn];
    const y = b.answers?.[qn];
    if (x !== undefined && x === y) shared += 1;
  }
  return shared;
}

function hashSignature(signature) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < signature.length; i += 1) {
    hash ^= signature.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export default detectCollusion;
