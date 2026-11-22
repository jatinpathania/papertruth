import test from 'node:test';
import assert from 'node:assert/strict';
import {
  methodAccuracy,
  compareMethods,
  accuracyVsCohortSize,
  runAllMethods,
  applicableMethods,
  keyToMap,
  METHODS
} from '../src/services/consensus/validation.js';
import { generateCohort, cohortToMatrix } from '../src/services/simulation/generateCohort.js';

const cohort = generateCohort();
const matrix = cohortToMatrix(cohort);
const key = keyToMap(cohort.groundTruth);
const results = runAllMethods(matrix, { collectPredictions: true });
const trapNumbers = new Set(cohort.trapQuestionNumbers);
const onlyTraps = (perQuestion) => perQuestion.filter((q) => trapNumbers.has(q.questionNumber));

test('methodAccuracy counts only questions present in both the key and the result', () => {
  const perQuestion = [
    { questionNumber: 1, consensusAnswer: 'A' },
    { questionNumber: 2, consensusAnswer: 'B' },
    { questionNumber: 3, consensusAnswer: null },
    { questionNumber: 4, consensusAnswer: 'D' }
  ];
  const accuracy = methodAccuracy(perQuestion, [
    { questionNumber: 1, answer: 'A' },
    { questionNumber: 2, answer: 'C' },
    { questionNumber: 3, answer: 'A' }
  ]);
  assert.equal(accuracy.comparable, 2);
  assert.equal(accuracy.matched, 1);
  assert.equal(accuracy.accuracy, 0.5);
  assert.deepEqual(accuracy.mismatches.map((m) => m.questionNumber), [2]);
});

test('methodAccuracy splits accuracy by dispute flag', () => {
  const accuracy = methodAccuracy(
    [
      { questionNumber: 1, consensusAnswer: 'A', disputed: false },
      { questionNumber: 2, consensusAnswer: 'A', disputed: true }
    ],
    [
      { questionNumber: 1, answer: 'A' },
      { questionNumber: 2, answer: 'B' }
    ]
  );
  assert.equal(accuracy.undisputedAccuracy, 1);
  assert.equal(accuracy.disputedAccuracy, 0);
});

test('an empty key produces 0 accuracy rather than NaN', () => {
  const accuracy = methodAccuracy([{ questionNumber: 1, consensusAnswer: 'A' }], []);
  assert.equal(accuracy.accuracy, 0);
  assert.equal(accuracy.comparable, 0);
});

test('the seeded cohort is generated as documented', () => {
  assert.equal(matrix.responses.length, 150);
  assert.equal(cohort.questions.length, 50);
  assert.equal(cohort.trapQuestionNumbers.length, 7);
  assert.equal(cohort.ambiguousQuestionNumbers.length, 4);
  for (const qn of cohort.ambiguousQuestionNumbers) assert.ok(!trapNumbers.has(qn));
  assert.ok(cohort.abilityStats.min >= 0.35 && cohort.abilityStats.max <= 0.95);
  assert.equal(applicableMethods(matrix, { collectPredictions: true }).length, 3);
});

test('on seeded data, weighted-EM accuracy >= majority accuracy', () => {
  const majority = methodAccuracy(results[METHODS.MAJORITY].perQuestion, key).accuracy;
  const em = methodAccuracy(results[METHODS.WEIGHTED_EM].perQuestion, key).accuracy;
  assert.ok(em >= majority, `EM ${em} should be at least majority ${majority}`);
});

test('on trap questions, weighted-EM and SP clearly beat majority voting', () => {
  const majority = methodAccuracy(onlyTraps(results[METHODS.MAJORITY].perQuestion), key);
  const em = methodAccuracy(onlyTraps(results[METHODS.WEIGHTED_EM].perQuestion), key);
  const sp = methodAccuracy(onlyTraps(results[METHODS.SURPRISINGLY_POPULAR].perQuestion), key);

  assert.equal(majority.comparable, 7);
  assert.ok(majority.accuracy <= 0.3, 'majority trap accuracy was ' + majority.accuracy);
  assert.ok(em.accuracy >= 0.7, 'EM trap accuracy was ' + em.accuracy);
  assert.ok(sp.accuracy >= 0.7, 'SP trap accuracy was ' + sp.accuracy);
  assert.ok(em.accuracy > majority.accuracy && sp.accuracy > majority.accuracy);
});

test('weighting overturns the plurality only where the plurality was wrong', () => {
  const comparison = compareMethods(matrix, key, { results, collectPredictions: true });
  assert.ok(comparison.overturnedQuestions.length >= 5);
  assert.ok(
    comparison.overturnedWonByWeighting >= 4 * Math.max(1, comparison.overturnedLostByWeighting),
    `won ${comparison.overturnedWonByWeighting}, lost ${comparison.overturnedLostByWeighting}`
  );
  assert.equal(comparison.methods[0].accuracy >= comparison.methods.at(-1).accuracy, true);
  assert.equal(comparison.keyedQuestions, 50);
  assert.equal(comparison.respondents, 150);
});

test('the dispute flag lands on the questions the methods actually get wrong', () => {
  const accuracy = methodAccuracy(results[METHODS.WEIGHTED_EM].perQuestion, key);
  assert.ok(accuracy.disputedComparable > 0, 'some questions must be flagged');
  assert.ok(
    accuracy.disputedAccuracy < accuracy.undisputedAccuracy,
    `disputed ${accuracy.disputedAccuracy} vs undisputed ${accuracy.undisputedAccuracy}`
  );
});

test('questions nobody can recall are flagged as disputed', () => {
  const byNumber = new Map(results[METHODS.MAJORITY].perQuestion.map((q) => [q.questionNumber, q]));
  const flagged = cohort.ambiguousQuestionNumbers.filter((qn) => byNumber.get(qn).disputed);
  assert.ok(
    flagged.length >= cohort.ambiguousQuestionNumbers.length - 1,
    `only ${flagged.length} of ${cohort.ambiguousQuestionNumbers.length} ambiguous questions were flagged`
  );
});

test('accuracy-vs-cohort-size produces a usable learning curve', () => {
  const { curve, methods, respondents } = accuracyVsCohortSize(matrix, key, {
    step: 20,
    trials: 3,
    collectPredictions: true
  });
  assert.equal(respondents, 150);
  assert.deepEqual(methods, [METHODS.MAJORITY, METHODS.WEIGHTED_EM, METHODS.SURPRISINGLY_POPULAR]);
  assert.ok(curve.length >= 5);
  for (let i = 1; i < curve.length; i += 1) {
    assert.ok(curve[i].cohortSize > curve[i - 1].cohortSize);
  }
  assert.equal(curve.at(-1).cohortSize, 150);
  assert.equal(curve.at(-1).trials, 1, 'the full cohort has only one possible sample');
  for (const row of curve) {
    for (const method of methods) {
      assert.ok(row[method] >= 0 && row[method] <= 1, method + ' out of range at n=' + row.cohortSize);
      assert.ok(row[`${method}_min`] <= row[method] && row[method] <= row[`${method}_max`]);
    }
  }
});

test('the weighted methods improve as the cohort grows', () => {
  const { curve } = accuracyVsCohortSize(matrix, key, { step: 20, trials: 4, collectPredictions: true });
  const smallest = curve[0];
  const largest = curve.at(-1);
  for (const method of [METHODS.WEIGHTED_EM, METHODS.SURPRISINGLY_POPULAR]) {
    assert.ok(
      largest[method] > smallest[method],
      `${method}: n=${smallest.cohortSize} scored ${smallest[method]}, n=${largest.cohortSize} scored ${largest[method]}`
    );
  }
});

test('majority voting hits an error floor that more respondents cannot fix', () => {
  const { curve } = accuracyVsCohortSize(matrix, key, { step: 20, trials: 4, collectPredictions: true });
  const majorityValues = curve.map((row) => row[METHODS.MAJORITY]);
  const spread = Math.max(...majorityValues) - Math.min(...majorityValues);
  assert.ok(spread < 0.1, 'majority accuracy should be roughly flat, spread was ' + spread);
  assert.ok(curve.at(-1)[METHODS.WEIGHTED_EM] - curve.at(-1)[METHODS.MAJORITY] > 0.05);
});

test('the learning curve is reproducible for a given seed', () => {
  const options = { step: 30, trials: 2, seed: 1234, collectPredictions: true };
  const a = accuracyVsCohortSize(matrix, key, options);
  const b = accuracyVsCohortSize(matrix, key, options);
  assert.deepEqual(a.curve, b.curve);
  const c = accuracyVsCohortSize(matrix, key, { ...options, seed: 4321 });
  assert.notDeepEqual(a.curve, c.curve);
});

test('EM converges on the full seeded cohort', () => {
  const em = results[METHODS.WEIGHTED_EM];
  assert.equal(em.converged, true);
  assert.ok(em.iterations < 100);
  const byId = new Map(em.respondentWeights.map((w) => [w.respondentId, w.weight]));
  const abilities = cohort.respondents.map((r) => r.ability);
  const weights = cohort.respondents.map((r) => byId.get(r.respondentId));
  assert.ok(pearson(abilities, weights) > 0.7, 'weights should correlate with true ability');
});

function pearson(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return num / Math.sqrt(dx * dy);
}
