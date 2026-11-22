import test from 'node:test';
import assert from 'node:assert/strict';
import { surprisinglyPopularConsensus } from '../src/services/consensus/surprisinglyPopular.js';
import { majorityConsensus } from '../src/services/consensus/majority.js';
import { buildMatrix } from '../src/services/consensus/matrix.js';

function prelecMatrix() {
  const submissions = [];
  for (let i = 0; i < 65; i += 1) {
    submissions.push({
      respondentId: 'yes' + i,
      answers: [{ questionNumber: 1, answer: 'YES', predictedMajority: 'YES' }]
    });
  }
  for (let i = 0; i < 35; i += 1) {
    submissions.push({
      respondentId: 'no' + i,
      answers: [{ questionNumber: 1, answer: 'NO', predictedMajority: i < 20 ? 'YES' : 'NO' }]
    });
  }
  return buildMatrix({
    questions: [{ number: 1, type: 'MCQ', options: ['YES', 'NO'], topic: 'Recall' }],
    submissions
  });
}

test('surprisingly popular picks the informed minority answer', () => {
  const matrix = prelecMatrix();
  const sp = surprisinglyPopularConsensus(matrix);
  const majority = majorityConsensus(matrix);

  assert.equal(majority.perQuestion[0].consensusAnswer, 'YES');
  assert.equal(sp.perQuestion[0].consensusAnswer, 'NO');
  assert.equal(sp.perQuestion[0].overturnsMajority, true);
  assert.equal(sp.method, 'SURPRISINGLY_POPULAR');
  assert.equal(sp.applicable, true);
});

test('SP scores are exactly Actual minus Predicted', () => {
  const q = surprisinglyPopularConsensus(prelecMatrix()).perQuestion[0];
  assert.equal(q.actual.YES, 0.65);
  assert.equal(q.actual.NO, 0.35);
  assert.equal(q.predicted.YES, 0.85);
  assert.equal(q.predicted.NO, 0.15);
  assert.ok(Math.abs(q.spScores.YES + 0.2) < 1e-12);
  assert.ok(Math.abs(q.spScores.NO - 0.2) < 1e-12);
});

test('the eligibility guard stops a 25% option from overturning a 75% one', () => {
  const submissions = [];
  for (let i = 0; i < 30; i += 1) {
    submissions.push({
      respondentId: 'a' + i,
      answers: [{ questionNumber: 1, answer: 'A', predictedMajority: 'A' }]
    });
  }
  for (let i = 0; i < 10; i += 1) {
    submissions.push({
      respondentId: 'b' + i,
      answers: [{ questionNumber: 1, answer: 'B', predictedMajority: 'A' }]
    });
  }
  const matrix = buildMatrix({
    questions: [{ number: 1, type: 'MCQ', options: ['A', 'B', 'C', 'D'] }],
    submissions
  });
  const q = surprisinglyPopularConsensus(matrix).perQuestion[0];
  assert.equal(q.consensusAnswer, 'A');
  assert.equal(q.overturnsMajority, false);
  assert.equal(q.pureConsensusAnswer, 'B');
  assert.equal(q.guardApplied, true);
  assert.deepEqual(q.eligibleOptions, ['A']);
});

test('minShareRatio: 0 recovers the unguarded criterion exactly', () => {
  const submissions = [];
  for (let i = 0; i < 30; i += 1) {
    submissions.push({
      respondentId: 'a' + i,
      answers: [{ questionNumber: 1, answer: 'A', predictedMajority: 'A' }]
    });
  }
  for (let i = 0; i < 10; i += 1) {
    submissions.push({
      respondentId: 'b' + i,
      answers: [{ questionNumber: 1, answer: 'B', predictedMajority: 'A' }]
    });
  }
  const matrix = buildMatrix({
    questions: [{ number: 1, type: 'MCQ', options: ['A', 'B', 'C', 'D'] }],
    submissions
  });
  const q = surprisinglyPopularConsensus(matrix, { minShareRatio: 0 }).perQuestion[0];
  assert.equal(q.consensusAnswer, 'B');
  assert.equal(q.guardApplied, false);
});

test('the guard never blocks a genuine trap-shaped flip (35% vs 47%)', () => {
  const submissions = [];
  for (let i = 0; i < 47; i += 1) {
    submissions.push({
      respondentId: 'trap' + i,
      answers: [{ questionNumber: 1, answer: 'B', predictedMajority: 'B' }]
    });
  }
  for (let i = 0; i < 35; i += 1) {
    submissions.push({
      respondentId: 'right' + i,
      answers: [{ questionNumber: 1, answer: 'C', predictedMajority: i < 30 ? 'B' : 'C' }]
    });
  }
  const matrix = buildMatrix({
    questions: [{ number: 1, type: 'MCQ', options: ['A', 'B', 'C', 'D'] }],
    submissions
  });
  const q = surprisinglyPopularConsensus(matrix).perQuestion[0];
  assert.equal(q.consensusAnswer, 'C');
  assert.equal(q.overturnsMajority, true);
  assert.ok(q.eligibleOptions.includes('C'));
});

test('a unanimous question with matching predictions is left alone', () => {
  const submissions = Array.from({ length: 20 }, (_, i) => ({
    respondentId: 'r' + i,
    answers: [{ questionNumber: 1, answer: 'C', predictedMajority: 'C' }]
  }));
  const matrix = buildMatrix({
    questions: [{ number: 1, type: 'MCQ', options: ['A', 'B', 'C', 'D'] }],
    submissions
  });
  const q = surprisinglyPopularConsensus(matrix).perQuestion[0];
  assert.equal(q.consensusAnswer, 'C');
  assert.equal(q.overturnsMajority, false);
});

test('without prediction data SP reports itself inapplicable and falls back to plurality', () => {
  const matrix = buildMatrix({
    questions: [{ number: 1, type: 'MCQ', options: ['A', 'B'] }],
    submissions: [
      { respondentId: 'r1', answers: [{ questionNumber: 1, answer: 'A' }] },
      { respondentId: 'r2', answers: [{ questionNumber: 1, answer: 'A' }] },
      { respondentId: 'r3', answers: [{ questionNumber: 1, answer: 'B' }] }
    ]
  });
  const result = surprisinglyPopularConsensus(matrix);
  assert.equal(result.applicable, false);
  assert.equal(result.perQuestion[0].applicable, false);
  assert.equal(result.perQuestion[0].consensusAnswer, 'A');
});

test('an option that was predicted but never chosen can never win', () => {
  const submissions = Array.from({ length: 10 }, (_, i) => ({
    respondentId: 'r' + i,
    answers: [{ questionNumber: 1, answer: 'A', predictedMajority: 'D' }]
  }));
  const matrix = buildMatrix({
    questions: [{ number: 1, type: 'MCQ', options: ['A', 'B', 'C', 'D'] }],
    submissions
  });
  const q = surprisinglyPopularConsensus(matrix).perQuestion[0];
  assert.equal(q.consensusAnswer, 'A');
  assert.equal(q.spScores.D, -1);
});

test('questions with no responses do not crash the criterion', () => {
  const matrix = buildMatrix({
    questions: [
      { number: 1, type: 'MCQ', options: ['A', 'B'] },
      { number: 2, type: 'MCQ', options: ['A', 'B'] }
    ],
    submissions: [
      { respondentId: 'r1', answers: [{ questionNumber: 1, answer: 'A', predictedMajority: 'A' }] }
    ]
  });
  const result = surprisinglyPopularConsensus(matrix);
  assert.equal(result.perQuestion[1].consensusAnswer, null);
  assert.equal(result.perQuestion[1].confidence, 0);
});
