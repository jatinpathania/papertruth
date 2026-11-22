import test from 'node:test';
import assert from 'node:assert/strict';
import {
  shannonEntropy,
  normalisedEntropy,
  topTwoMargin,
  rankedOptions,
  assessDispute,
  distributionTotal
} from '../src/services/consensus/entropy.js';

test('shannon entropy of a unanimous distribution is 0 bits', () => {
  assert.equal(shannonEntropy({ A: 42 }), 0);
});

test('shannon entropy of a fair coin is exactly 1 bit', () => {
  assert.equal(shannonEntropy({ A: 10, B: 10 }), 1);
});

test('shannon entropy of a uniform 4-way split is exactly 2 bits', () => {
  assert.equal(shannonEntropy({ A: 5, B: 5, C: 5, D: 5 }), 2);
});

test('uniform distribution over k options -> normalised entropy 1.0', () => {
  assert.equal(normalisedEntropy({ A: 5, B: 5, C: 5, D: 5 }, 4), 1);
  assert.equal(normalisedEntropy({ A: 3, B: 3 }, 2), 1);
  assert.equal(normalisedEntropy({ A: 2, B: 2, C: 2, D: 2, E: 2 }, 5), 1);
});

test('unanimous distribution -> normalised entropy 0.0', () => {
  assert.equal(normalisedEntropy({ A: 100 }, 4), 0);
  assert.equal(normalisedEntropy({ D: 1 }, 4), 0);
});

test('normalised entropy stays in [0,1] and accounts for unchosen options', () => {
  assert.equal(normalisedEntropy({ A: 10, B: 10 }, 4), 0.5);
  assert.equal(normalisedEntropy({ A: 10, B: 10 }, 2), 1);
});

test('degenerate inputs never produce NaN', () => {
  assert.equal(shannonEntropy({}), 0);
  assert.equal(shannonEntropy(undefined), 0);
  assert.equal(normalisedEntropy({}, 0), 0);
  assert.equal(normalisedEntropy({ A: 0, B: 0 }, 4), 0);
  assert.equal(distributionTotal(undefined), 0);
  assert.equal(topTwoMargin({}), 0);
});

test('ranked options sort by count then deterministically by option label', () => {
  assert.deepEqual(rankedOptions({ B: 3, A: 3, C: 1 }), [['A', 3], ['B', 3], ['C', 1]]);
});

test('top-two margin measures the gap as a fraction of responses', () => {
  assert.equal(topTwoMargin({ A: 60, B: 40 }), 0.2);
  assert.equal(topTwoMargin({ A: 100 }), 1);
  assert.equal(topTwoMargin({ A: 50, B: 50 }), 0);
});

test('a question is disputed when the top-two margin is under 10 points', () => {
  const result = assessDispute({ A: 51, B: 49 }, { optionCount: 4 });
  assert.equal(result.disputed, true);
  assert.deepEqual(result.disputeReasons, ['NARROW_MARGIN']);
  assert.ok(result.normalisedEntropy < 0.85);
});

test('a question is disputed when normalised entropy exceeds the threshold', () => {
  const result = assessDispute({ A: 26, B: 25, C: 25, D: 24 }, { optionCount: 4 });
  assert.equal(result.disputed, true);
  assert.ok(result.disputeReasons.includes('HIGH_ENTROPY'));
});

test('a clear winner is not disputed', () => {
  const result = assessDispute({ A: 80, B: 10, C: 5, D: 5 }, { optionCount: 4 });
  assert.equal(result.disputed, false);
  assert.deepEqual(result.disputeReasons, []);
});

test('the dispute threshold is configurable per exam', () => {
  const distribution = { A: 60, B: 20, C: 10, D: 10 };
  assert.equal(assessDispute(distribution, { optionCount: 4, disputeThreshold: 0.85 }).disputed, false);
  assert.equal(assessDispute(distribution, { optionCount: 4, disputeThreshold: 0.5 }).disputed, true);
});
