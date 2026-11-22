import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreSubmission, summariseConsensus, OUTCOME } from '../src/services/consensus/scoring.js';

const consensus = [
  { questionNumber: 1, consensusAnswer: 'A', confidence: 0.9, disputed: false, topic: 'Trees', distribution: { A: 18, B: 2 } },
  { questionNumber: 2, consensusAnswer: 'B', confidence: 0.8, disputed: false, topic: 'Trees', distribution: { B: 15, C: 5 } },
  { questionNumber: 3, consensusAnswer: 'C', confidence: 0.4, disputed: true, topic: 'Sorting', distribution: { C: 8, D: 7, A: 5 } },
  { questionNumber: 4, consensusAnswer: 'D', confidence: 0.7, disputed: false, topic: 'Sorting', distribution: { D: 12, A: 8 } },
  { questionNumber: 5, consensusAnswer: null, confidence: 0, disputed: false, topic: 'Hashing', distribution: {} }
];

test('scores correct answers and leaves disputed questions out of the total', () => {
  const result = scoreSubmission({
    answers: [
      { questionNumber: 1, answer: 'A' },
      { questionNumber: 2, answer: 'C' },
      { questionNumber: 3, answer: 'D' },
      { questionNumber: 4, answer: 'D' }
    ],
    perQuestion: consensus,
    markingScheme: { correctMarks: 4, negativeMarks: 1 },
    questions: []
  });

  assert.equal(result.correct, 2);
  assert.equal(result.incorrect, 1);
  assert.equal(result.disputed, 1);
  assert.equal(result.unattempted, 1, 'only Q5 was left blank');
  assert.equal(result.score, 4 + 4 - 1);
  assert.equal(result.scoredMax, 12);
  assert.equal(result.maxScore, 20);
  assert.equal(result.bestCase, 7 + 4);
  assert.equal(result.worstCase, 7 - 1);
  assert.equal(result.markingScheme.negativeMarks, 1);
});

test('per-question outcomes are labelled, including no-consensus', () => {
  const result = scoreSubmission({
    answers: [
      { questionNumber: 1, answer: 'A' },
      { questionNumber: 2, answer: 'C' },
      { questionNumber: 3, answer: 'C' },
      { questionNumber: 5, answer: 'A' }
    ],
    perQuestion: consensus
  });
  const byNumber = new Map(result.perQuestion.map((q) => [q.questionNumber, q]));
  assert.equal(byNumber.get(1).outcome, OUTCOME.CORRECT);
  assert.equal(byNumber.get(2).outcome, OUTCOME.INCORRECT);
  assert.equal(byNumber.get(3).outcome, OUTCOME.DISPUTED);
  assert.equal(byNumber.get(4).outcome, OUTCOME.UNATTEMPTED);
  assert.equal(byNumber.get(5).outcome, OUTCOME.NO_CONSENSUS);
  assert.equal(byNumber.get(3).cohortShare, 8 / 20);
  assert.equal(byNumber.get(1).cohortShare, 0.9);
});

test('negative marking defaults to zero and never rewards a wrong answer', () => {
  const result = scoreSubmission({
    answers: [{ questionNumber: 1, answer: 'B' }],
    perQuestion: [consensus[0]],
    markingScheme: { correctMarks: 1 }
  });
  assert.equal(result.score, 0);
  assert.equal(result.incorrect, 1);
  assert.equal(result.perQuestion[0].marks, 0);
});

test('a negative marking magnitude is applied as a deduction whichever sign it is given', () => {
  const answers = [{ questionNumber: 1, answer: 'B' }];
  const withPositive = scoreSubmission({ answers, perQuestion: [consensus[0]], markingScheme: { correctMarks: 4, negativeMarks: 1 } });
  const withNegative = scoreSubmission({ answers, perQuestion: [consensus[0]], markingScheme: { correctMarks: 4, negativeMarks: -1 } });
  assert.equal(withPositive.score, -1);
  assert.equal(withNegative.score, -1);
});

test('scoreDisputed includes disputed questions when explicitly requested', () => {
  const answers = [{ questionNumber: 3, answer: 'C' }];
  const excluded = scoreSubmission({ answers, perQuestion: [consensus[2]] });
  const included = scoreSubmission({ answers, perQuestion: [consensus[2]], scoreDisputed: true });
  assert.equal(excluded.score, 0);
  assert.equal(excluded.disputed, 1);
  assert.equal(included.score, 1);
  assert.equal(included.correct, 1);
});

test('topic breakdown aggregates by topic and ignores unscored questions in accuracy', () => {
  const result = scoreSubmission({
    answers: [
      { questionNumber: 1, answer: 'A' },
      { questionNumber: 2, answer: 'C' },
      { questionNumber: 3, answer: 'A' },
      { questionNumber: 4, answer: 'D' }
    ],
    perQuestion: consensus
  });
  const byTopic = new Map(result.topicBreakdown.map((t) => [t.topic, t]));
  assert.equal(byTopic.get('Trees').correct, 1);
  assert.equal(byTopic.get('Trees').incorrect, 1);
  assert.equal(byTopic.get('Trees').accuracy, 0.5);
  assert.equal(byTopic.get('Sorting').disputed, 1);
  assert.equal(byTopic.get('Sorting').accuracy, 1, 'only the scored question counts');
  assert.equal(byTopic.get('Hashing').accuracy, null, 'nothing scored -> no accuracy claim');
  assert.deepEqual(result.topicBreakdown.map((t) => t.topic), ['Hashing', 'Sorting', 'Trees']);
});

test('topics fall back to the question list when the consensus lacks them', () => {
  const result = scoreSubmission({
    answers: [{ questionNumber: 1, answer: 'A' }],
    perQuestion: [{ questionNumber: 1, consensusAnswer: 'A', distribution: { A: 5 } }],
    questions: [{ number: 1, topic: 'Graphs' }]
  });
  assert.equal(result.topicBreakdown[0].topic, 'Graphs');
});

test('an empty submission scores zero without dividing by zero', () => {
  const result = scoreSubmission({ answers: [], perQuestion: consensus });
  assert.equal(result.score, 0);
  assert.equal(result.attempted, 0);
  assert.equal(result.unattempted, 5);
  assert.equal(result.percentage, null);
});

test('blank answers are treated as unattempted, not wrong', () => {
  const result = scoreSubmission({
    answers: [{ questionNumber: 1, answer: '   ' }, { questionNumber: 2, answer: null }],
    perQuestion: consensus.slice(0, 2),
    markingScheme: { correctMarks: 1, negativeMarks: 1 }
  });
  assert.equal(result.unattempted, 2);
  assert.equal(result.score, 0);
});

test('summariseConsensus bins confidence and counts disputes', () => {
  const summary = summariseConsensus(consensus, { bins: 5 });
  assert.equal(summary.totalQuestions, 5);
  assert.equal(summary.answeredQuestions, 4, 'the question nobody answered is excluded');
  assert.equal(summary.disputedQuestions, 1);
  assert.equal(summary.disputedRate, 0.25);
  assert.equal(summary.confidenceHistogram.length, 5);
  assert.equal(summary.confidenceHistogram.reduce((sum, b) => sum + b.count, 0), 4);
  assert.equal(summary.confidenceHistogram[4].count, 2);
  assert.equal(summary.confidenceHistogram[3].count, 1);
  assert.equal(summary.confidenceHistogram[2].count, 1);
  assert.ok(Math.abs(summary.meanConfidence - 0.7) < 1e-9);
});

test('summariseConsensus survives an empty consensus', () => {
  const summary = summariseConsensus([], { bins: 4 });
  assert.equal(summary.totalQuestions, 0);
  assert.equal(summary.meanConfidence, 0);
  assert.equal(summary.disputedRate, 0);
  assert.equal(summary.confidenceHistogram.length, 4);
});
