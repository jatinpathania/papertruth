import { Submission } from '../models/index.js';

const MAX_ENTRIES = 32;
const cache = new Map();

export async function examDataVersion(examId) {
  const [count, latest] = await Promise.all([
    Submission.countDocuments({ examId }),
    Submission.findOne({ examId }).sort({ updatedAt: -1 }).select('updatedAt').lean()
  ]);
  return `${count}:${latest?.updatedAt?.getTime() ?? 0}`;
}

export async function cached(examId, namespace, params, compute) {
  const version = await examDataVersion(examId);
  const key = `${examId}|${namespace}|${version}|${JSON.stringify(params)}`;

  if (cache.has(key)) {
    const hit = cache.get(key);
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }

  const value = await compute();
  cache.set(key, value);
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
  return value;
}

export function invalidateExam(examId) {
  const prefix = `${examId}|`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export function clearComputeCache() {
  cache.clear();
}
