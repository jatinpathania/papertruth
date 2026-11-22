// Plain majority vote — the unweighted baseline the other methods are compared against.
import {
  answersByQuestion,
  countDistribution,
  optionDomain,
  questionIndex,
  questionNumbers
} from './matrix.js';
import { annotateDisputes, rankedOptions } from './entropy.js';

export const METHOD = 'MAJORITY';

export function majorityConsensus(matrix, { disputeThreshold, marginThreshold } = {}) {
  const byQuestion = answersByQuestion(matrix);
  const meta = questionIndex(matrix);
  const optionCounts = {};

  const perQuestion = questionNumbers(matrix).map((qn) => {
    const entries = byQuestion.get(qn) || [];
    const distribution = countDistribution(entries);
    const total = entries.length;
    const domain = optionDomain(matrix, qn);
    optionCounts[qn] = domain.length;

    const ranked = rankedOptions(distribution);
    const [topOption, topCount] = ranked[0] || [null, 0];

    return {
      questionNumber: qn,
      topic: meta.get(qn)?.topic || 'General',
      consensusAnswer: total > 0 ? topOption : null,
      confidence: total > 0 ? topCount / total : 0,
      rawAgreement: total > 0 ? topCount / total : 0,
      totalResponses: total,
      distribution,
      optionScores: Object.fromEntries(ranked.map(([o, c]) => [o, total > 0 ? c / total : 0]))
    };
  });

  return {
    method: METHOD,
    iterations: 1,
    converged: true,
    perQuestion: annotateDisputes(perQuestion, { optionCounts, disputeThreshold, marginThreshold }),
    respondentWeights: (matrix.responses || []).map((r) => ({
      respondentId: r.respondentId,
      weight: 1,
      answered: Object.keys(r.answers || {}).length
    }))
  };
}

export default majorityConsensus;
