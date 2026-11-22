import test from 'node:test';
import assert from 'node:assert/strict';
import { weightedEMConsensus } from '../src/services/consensus/weightedEM.js';
import { majorityConsensus } from '../src/services/consensus/majority.js';
import { buildMatrix } from '../src/services/consensus/matrix.js';

const OPTIONS = ['A', 'B', 'C', 'D'];

function matrixOf(rows, questionCount) {
  const n = questionCount ?? Math.max(...Object.values(rows).map((r) => r.length));
  return buildMatrix({
    questions: Array.from({ length: n }, (_, i) => ({
      number: i + 1,
      type: 'MCQ',
      options: OPTIONS,
      topic: 'Topic ' + ((i % 3) + 1)
    })),
    submissions: Object.entries(rows).map(([respondentId, answers]) => ({
      respondentId,
      answers: answers
        .map((answer, i) => ({ questionNumber: i + 1, answer }))
        .filter((a) => a.answer !== null)
    }))
  });
}

function trapCohort() {
  const rows = {};
  for (let i = 0; i < 6; i += 1) {
    rows['reliable' + i] = [...Array(9).fill('A'), 'C'];
  }
  for (let i = 0; i < 14; i += 1) {
    const answers = [];
    for (let q = 0; q < 9; q += 1) answers.push(['B', 'C', 'D'][(i + q) % 3]);
    answers.push('B');
    rows['unreliable' + i] = answers;
  }
  return matrixOf(rows, 10);
}

test('EM converges on synthetic data and reports iterations honestly', () => {
  const result = weightedEMConsensus(trapCohort());
  assert.equal(result.method, 'WEIGHTED_EM');
  assert.equal(result.converged, true);
  assert.ok(result.iterations >= 1 && result.iterations < 100, 'iterations: ' + result.iterations);
  assert.ok(result.maxDelta < 1e-4);
});

test('a reliable minority overturns a shared misconception (the whole thesis)', () => {
  const matrix = trapCohort();
  const majority = majorityConsensus(matrix);
  const em = weightedEMConsensus(matrix);

  const q10Majority = majority.perQuestion.find((q) => q.questionNumber === 10);
  const q10Em = em.perQuestion.find((q) => q.questionNumber === 10);

  assert.equal(q10Majority.consensusAnswer, 'B');
  assert.equal(q10Em.consensusAnswer, 'C');
  assert.equal(q10Em.overturnsMajority, true);
  assert.ok(q10Em.confidence > 0.5);
});

test('EM leaves the easy questions where the majority already agrees alone', () => {
  const em = weightedEMConsensus(trapCohort());
  for (const q of em.perQuestion.filter((q) => q.questionNumber <= 9)) {
    assert.equal(q.consensusAnswer, 'A', 'Q' + q.questionNumber);
    assert.equal(q.overturnsMajority, false);
  }
});

test('a known-unreliable respondent receives a low weight', () => {
  const em = weightedEMConsensus(trapCohort());
  const byId = new Map(em.respondentWeights.map((w) => [w.respondentId, w.weight]));
  const reliable = [...byId].filter(([id]) => id.startsWith('reliable')).map(([, w]) => w);
  const unreliable = [...byId].filter(([id]) => id.startsWith('unreliable')).map(([, w]) => w);

  assert.ok(Math.min(...reliable) > Math.max(...unreliable),
    'reliable min ' + Math.min(...reliable) + ' should exceed unreliable max ' + Math.max(...unreliable));
  assert.ok(Math.max(...unreliable) < 0.5);
});

test('a lone contrarian is pushed toward the weight floor, never past it', () => {
  const rows = {};
  for (let i = 0; i < 19; i += 1) rows['good' + i] = Array(10).fill('A');
  rows.contrarian = Array(10).fill('D');
  const em = weightedEMConsensus(matrixOf(rows, 10));
  const contrarian = em.respondentWeights.find((w) => w.respondentId === 'contrarian');
  assert.ok(contrarian.weight >= 0.01, 'clamped at the floor');
  assert.ok(contrarian.weight < 0.4, 'weight was ' + contrarian.weight);
  assert.ok(em.perQuestion.every((q) => q.consensusAnswer === 'A'));
});

test('all weights stay inside the clamp range so no logit is infinite', () => {
  const em = weightedEMConsensus(trapCohort());
  for (const { weight } of em.respondentWeights) {
    assert.ok(weight >= 0.01 && weight <= 0.99, 'weight out of range: ' + weight);
    assert.ok(Number.isFinite(weight));
  }
  assert.ok(em.weightStats.max <= 0.99 && em.weightStats.min >= 0.01);
});

test('smoothing stops a respondent with 3 answers from earning an extreme weight', () => {
  const rows = {};
  for (let i = 0; i < 20; i += 1) rows['full' + i] = Array(20).fill('A');
  rows.light = [...Array(3).fill('A'), ...Array(17).fill(null)];
  const em = weightedEMConsensus(matrixOf(rows, 20));
  const light = em.respondentWeights.find((w) => w.respondentId === 'light');
  const full = em.respondentWeights.find((w) => w.respondentId === 'full0');
  assert.equal(light.answered, 3);
  assert.ok(light.weight < full.weight, 'the light respondent must be shrunk toward the mean');
});

test('a unanimous question is a fixed point, not a crash', () => {
  const em = weightedEMConsensus(matrixOf({ r1: ['A'], r2: ['A'], r3: ['A'] }, 1));
  const q = em.perQuestion[0];
  assert.equal(q.consensusAnswer, 'A');
  assert.equal(q.confidence, 1);
  assert.equal(q.normalisedEntropy, 0);
  assert.equal(em.converged, true);
});

test('a respondent who answered nothing is harmless', () => {
  const matrix = buildMatrix({
    questions: [{ number: 1, type: 'MCQ', options: OPTIONS }],
    submissions: [
      { respondentId: 'r1', answers: [{ questionNumber: 1, answer: 'A' }] },
      { respondentId: 'r2', answers: [{ questionNumber: 1, answer: 'A' }] },
      { respondentId: 'empty', answers: [] }
    ]
  });
  const em = weightedEMConsensus(matrix);
  const empty = em.respondentWeights.find((w) => w.respondentId === 'empty');
  assert.equal(empty.answered, 0);
  assert.ok(Number.isFinite(empty.weight));
  assert.equal(em.perQuestion[0].consensusAnswer, 'A');
});

test('an empty cohort produces an empty result instead of throwing', () => {
  const em = weightedEMConsensus(buildMatrix({ questions: [], submissions: [] }));
  assert.deepEqual(em.perQuestion, []);
  assert.deepEqual(em.respondentWeights, []);
  assert.equal(em.converged, true);
});

test('a question nobody answered yields a null consensus', () => {
  const matrix = buildMatrix({
    questions: [
      { number: 1, type: 'MCQ', options: OPTIONS },
      { number: 2, type: 'MCQ', options: OPTIONS }
    ],
    submissions: [{ respondentId: 'r1', answers: [{ questionNumber: 1, answer: 'B' }] }]
  });
  const em = weightedEMConsensus(matrix);
  assert.equal(em.perQuestion[1].consensusAnswer, null);
  assert.equal(em.perQuestion[1].confidence, 0);
});

test('the consensus never returns an option nobody chose', () => {
  const rows = {};
  for (let i = 0; i < 9; i += 1) rows['r' + i] = [['A', 'B', 'C'][i % 3]];
  const em = weightedEMConsensus(matrixOf(rows, 1));
  assert.ok(['A', 'B', 'C'].includes(em.perQuestion[0].consensusAnswer));
  assert.equal(em.perQuestion[0].optionScores.D, undefined);
});

test('results are deterministic across repeated runs', () => {
  const a = weightedEMConsensus(trapCohort());
  const b = weightedEMConsensus(trapCohort());
  assert.deepEqual(
    a.perQuestion.map((q) => [q.questionNumber, q.consensusAnswer, q.confidence]),
    b.perQuestion.map((q) => [q.questionNumber, q.consensusAnswer, q.confidence])
  );
});
