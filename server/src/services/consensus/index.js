export * from './matrix.js';
export * from './entropy.js';
export * from './majority.js';
export * from './weightedEM.js';
export * from './surprisinglyPopular.js';
export * from './integrity.js';
export * from './ranking.js';
export * from './shortAnswer.js';
export * from './scoring.js';
export * from './validation.js';

import { canonicaliseShortAnswers } from './shortAnswer.js';
import { summariseConsensus } from './scoring.js';
import { applicableMethods, runMethod } from './validation.js';

export function computeConsensus(matrix, options = {}) {
  const { matrix: prepared, groupsByQuestion } = canonicaliseShortAnswers(
    matrix,
    options.embeddingsByQuestion || {},
    options
  );

  const methods = applicableMethods(prepared, options);
  const results = {};
  const summaries = {};
  for (const method of methods) {
    const result = runMethod(method, prepared, options);
    results[method] = result;
    summaries[method] = summariseConsensus(result.perQuestion);
  }

  return { results, summaries, groupsByQuestion, methods, matrix: prepared };
}
