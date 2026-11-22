import test from 'node:test';
import assert from 'node:assert/strict';
import { topKDisputed, compareDisputed } from '../src/services/consensus/ranking.js';

test('disputed ranking prefers higher entropy, then a narrower margin', () => {
  const questions = [
    { questionNumber: 1, normalisedEntropy: 0.2, margin: 0.5, totalResponses: 10 },
    { questionNumber: 2, normalisedEntropy: 0.95, margin: 0.02, totalResponses: 10 },
    { questionNumber: 3, normalisedEntropy: 0.7, margin: 0.3, totalResponses: 10 },
    { questionNumber: 4, normalisedEntropy: 0.7, margin: 0.05, totalResponses: 10 }
  ];
  assert.deepEqual(
    topKDisputed(questions, 3).map((q) => q.questionNumber),
    [2, 4, 3]
  );
  assert.equal(compareDisputed(questions[3], questions[2]) < 0, true);
});

test('ties on both keys fall back to question number for a stable order', () => {
  const questions = [
    { questionNumber: 7, normalisedEntropy: 0.5, margin: 0.1, totalResponses: 5 },
    { questionNumber: 2, normalisedEntropy: 0.5, margin: 0.1, totalResponses: 5 }
  ];
  assert.deepEqual(topKDisputed(questions, 2).map((q) => q.questionNumber), [2, 7]);
});

test('unanswered questions are never ranked as disputes', () => {
  const questions = [
    { questionNumber: 1, normalisedEntropy: 1, margin: 0, totalResponses: 0 },
    { questionNumber: 2, normalisedEntropy: 0.4, margin: 0.4, totalResponses: 12 }
  ];
  assert.deepEqual(topKDisputed(questions, 5).map((q) => q.questionNumber), [2]);
});

test('onlyFlagged keeps just the questions the dispute rule flagged', () => {
  const questions = [
    { questionNumber: 1, normalisedEntropy: 0.9, margin: 0.4, totalResponses: 10, disputed: true },
    { questionNumber: 2, normalisedEntropy: 0.4, margin: 0.4, totalResponses: 10, disputed: false }
  ];
  assert.deepEqual(
    topKDisputed(questions, 5, { onlyFlagged: true }).map((q) => q.questionNumber),
    [1]
  );
});
