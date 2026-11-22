// Scores submissions against the consensus key and reports per-question confidence.
export const DEFAULT_MARKING_SCHEME = { correctMarks: 1, negativeMarks: 0 };

export const OUTCOME = {
  CORRECT: 'CORRECT',
  INCORRECT: 'INCORRECT',
  DISPUTED: 'DISPUTED',
  UNATTEMPTED: 'UNATTEMPTED',
  NO_CONSENSUS: 'NO_CONSENSUS'
};

export function scoreSubmission({
  answers = [],
  perQuestion = [],
  markingScheme = DEFAULT_MARKING_SCHEME,
  questions = [],
  scoreDisputed = false
} = {}) {
  const correctMarks = Number(markingScheme?.correctMarks ?? 1);
  const negativeMarks = Math.abs(Number(markingScheme?.negativeMarks ?? 0));

  const answerByQuestion = new Map(
    answers
      .filter((a) => a && a.answer !== undefined && a.answer !== null && `${a.answer}`.trim() !== '')
      .map((a) => [Number(a.questionNumber), `${a.answer}`])
  );
  const topicByQuestion = new Map(questions.map((q) => [Number(q.number), q.topic || 'General']));

  const breakdown = [];
  const topics = new Map();
  let correct = 0;
  let incorrect = 0;
  let unattempted = 0;
  let disputedCount = 0;
  let score = 0;
  let scoredQuestions = 0;

  for (const q of perQuestion) {
    const questionNumber = Number(q.questionNumber);
    const yourAnswer = answerByQuestion.get(questionNumber) ?? null;
    const consensusAnswer = q.consensusAnswer ?? null;
    const topic = q.topic || topicByQuestion.get(questionNumber) || 'General';
    const matches = yourAnswer !== null && consensusAnswer !== null && yourAnswer === consensusAnswer;

    let outcome;
    let marks = 0;
    if (yourAnswer === null) {
      outcome = OUTCOME.UNATTEMPTED;
      unattempted += 1;
    } else if (consensusAnswer === null) {
      outcome = OUTCOME.NO_CONSENSUS;
    } else if (q.disputed && !scoreDisputed) {
      outcome = OUTCOME.DISPUTED;
      disputedCount += 1;
    } else if (matches) {
      outcome = OUTCOME.CORRECT;
      correct += 1;
      marks = correctMarks;
      score += correctMarks;
      scoredQuestions += 1;
    } else {
      outcome = OUTCOME.INCORRECT;
      incorrect += 1;
      marks = -negativeMarks || 0;
      score -= negativeMarks;
      scoredQuestions += 1;
    }

    if (!topics.has(topic)) {
      topics.set(topic, { topic, total: 0, correct: 0, incorrect: 0, disputed: 0, unattempted: 0 });
    }
    const topicRow = topics.get(topic);
    topicRow.total += 1;
    if (outcome === OUTCOME.CORRECT) topicRow.correct += 1;
    else if (outcome === OUTCOME.INCORRECT) topicRow.incorrect += 1;
    else if (outcome === OUTCOME.DISPUTED) topicRow.disputed += 1;
    else if (outcome === OUTCOME.UNATTEMPTED) topicRow.unattempted += 1;

    breakdown.push({
      questionNumber,
      topic,
      yourAnswer,
      consensusAnswer,
      confidence: q.confidence ?? 0,
      disputed: Boolean(q.disputed),
      normalisedEntropy: q.normalisedEntropy ?? 0,
      outcome,
      marks,
      cohortShare: shareOf(q.distribution, yourAnswer)
    });
  }

  const maxScore = perQuestion.length * correctMarks;
  const scoredMax = scoredQuestions * correctMarks;

  const bestCase = score + disputedCount * correctMarks || 0;
  const worstCase = score - disputedCount * negativeMarks || 0;

  const topicBreakdown = [...topics.values()]
    .map((row) => ({
      ...row,
      accuracy: row.correct + row.incorrect > 0 ? row.correct / (row.correct + row.incorrect) : null
    }))
    .sort((a, b) => a.topic.localeCompare(b.topic));

  return {
    score: score || 0,
    maxScore,
    scoredMax,
    bestCase,
    worstCase,
    percentage: scoredMax > 0 ? (score / scoredMax) * 100 : null,
    correct,
    incorrect,
    unattempted,
    disputed: disputedCount,
    attempted: answerByQuestion.size,
    totalQuestions: perQuestion.length,
    markingScheme: { correctMarks, negativeMarks },
    perQuestion: breakdown,
    topicBreakdown
  };
}

function shareOf(distribution, answer) {
  if (!distribution || answer === null || answer === undefined) return null;
  const total = Object.values(distribution).reduce((sum, c) => sum + (Number(c) || 0), 0);
  if (total === 0) return null;
  return (Number(distribution[answer]) || 0) / total;
}

export function summariseConsensus(perQuestion = [], { bins = 10 } = {}) {
  const responseCount = (q) =>
    Number.isFinite(q.totalResponses)
      ? q.totalResponses
      : Object.values(q.distribution || {}).reduce((sum, c) => sum + (Number(c) || 0), 0);
  const answered = perQuestion.filter((q) => responseCount(q) > 0);
  const disputed = answered.filter((q) => q.disputed);
  const confidences = answered.map((q) => q.confidence || 0);
  const histogram = Array.from({ length: bins }, (_, i) => ({
    bin: `${Math.round((i / bins) * 100)}-${Math.round(((i + 1) / bins) * 100)}%`,
    from: i / bins,
    to: (i + 1) / bins,
    count: 0
  }));
  for (const c of confidences) {
    const index = Math.min(bins - 1, Math.max(0, Math.floor(c * bins)));
    histogram[index].count += 1;
  }
  return {
    totalQuestions: perQuestion.length,
    answeredQuestions: answered.length,
    disputedQuestions: disputed.length,
    disputedRate: answered.length ? disputed.length / answered.length : 0,
    meanConfidence: confidences.length
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0,
    meanNormalisedEntropy: answered.length
      ? answered.reduce((sum, q) => sum + (q.normalisedEntropy || 0), 0) / answered.length
      : 0,
    overturnedByWeighting: answered.filter((q) => q.overturnsMajority).length,
    confidenceHistogram: histogram
  };
}

export default scoreSubmission;
