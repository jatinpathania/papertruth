import test from 'node:test';
import assert from 'node:assert/strict';
import { majorityConsensus } from '../src/services/consensus/majority.js';
import { buildMatrix } from '../src/services/consensus/matrix.js';

const mcq = (number) => ({ number, type: 'MCQ', options: ['A', 'B', 'C', 'D'], topic: 'Topic ' + number });

function matrixOf(answerRows) {
  const questionCount = Math.max(...Object.values(answerRows).map((a) => a.length));
  return buildMatrix({
    questions: Array.from({ length: questionCount }, (_, i) => mcq(i + 1)),
    submissions: Object.entries(answerRows).map(([respondentId, answers]) => ({
      respondentId,
      answers: answers.map((answer, i) => ({ questionNumber: i + 1, answer }))
    }))
  });
}

test('picks the modal answer with confidence = share of the cohort', () => {
  const result = majorityConsensus(matrixOf({ r1: ['A'], r2: ['A'], r3: ['B'], r4: ['C'] }));
  assert.equal(result.method, 'MAJORITY');
  const q1 = result.perQuestion[0];
  assert.equal(q1.consensusAnswer, 'A');
  assert.equal(q1.confidence, 0.5);
  assert.equal(q1.totalResponses, 4);
  assert.deepEqual(q1.distribution, { A: 2, B: 1, C: 1 });
});

test('every respondent is weighted equally', () => {
  const result = majorityConsensus(matrixOf({ r1: ['A'], r2: ['B'] }));
  assert.deepEqual(result.respondentWeights.map((w) => w.weight), [1, 1]);
});

test('ties break deterministically by option label', () => {
  const a = majorityConsensus(matrixOf({ r1: ['B'], r2: ['A'] })).perQuestion[0].consensusAnswer;
  const b = majorityConsensus(matrixOf({ r1: ['A'], r2: ['B'] })).perQuestion[0].consensusAnswer;
  assert.equal(a, 'A');
  assert.equal(b, 'A');
});

test('unanimous question is not disputed; dead-heat question is', () => {
  const result = majorityConsensus(
    matrixOf({
      r1: ['A', 'A'],
      r2: ['A', 'B'],
      r3: ['A', 'A'],
      r4: ['A', 'B']
    })
  );
  assert.equal(result.perQuestion[0].disputed, false);
  assert.equal(result.perQuestion[0].normalisedEntropy, 0);
  assert.equal(result.perQuestion[1].disputed, true);
});

test('handles questions nobody answered without crashing', () => {
  const matrix = buildMatrix({
    questions: [mcq(1), mcq(2)],
    submissions: [{ respondentId: 'r1', answers: [{ questionNumber: 1, answer: 'A' }] }]
  });
  const result = majorityConsensus(matrix);
  assert.equal(result.perQuestion.length, 2);
  assert.equal(result.perQuestion[1].consensusAnswer, null);
  assert.equal(result.perQuestion[1].confidence, 0);
  assert.equal(result.perQuestion[1].disputed, false);
});
