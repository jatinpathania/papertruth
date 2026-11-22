import test from 'node:test';
import assert from 'node:assert/strict';
import { detectCollusion, answerSignature } from '../src/services/consensus/integrity.js';
import { connectedComponents } from '../src/services/consensus/groups.js';
import { buildMatrix } from '../src/services/consensus/matrix.js';
import { mulberry32, randomInt } from '../src/utils/rng.js';

test('grouping: unlinked ids stay in their own group', () => {
  const groups = connectedComponents(['a', 'b', 'c'], []);
  assert.equal(groups.length, 3);
  assert.deepEqual(groups.map((g) => g.length), [1, 1, 1]);
});

test('grouping: a chain of links collapses into one group', () => {
  const edges = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]];
  const groups = connectedComponents([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], edges);
  const big = groups.find((g) => g.length > 1);
  assert.equal(big.length, 6);
  assert.deepEqual([...big].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5]);
  assert.equal(groups.filter((g) => g.length === 1).length, 4);
});

test('grouping: two separate links make two separate groups', () => {
  const groups = connectedComponents([0, 1, 2, 3], [[0, 1], [2, 3]]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((g) => g.length), [2, 2]);
});

test('grouping: repeating the same link does not change the grouping', () => {
  const groups = connectedComponents(['a', 'b', 'c'], [['a', 'b'], ['a', 'b'], ['b', 'a']]);
  assert.equal(groups.length, 2);
  assert.equal(groups.find((g) => g.length === 2).length, 2);
});

test('exact duplicate answer vectors are grouped in one pass', () => {
  const answers = (pattern) => pattern.split('').map((answer, i) => ({ questionNumber: i + 1, answer }));
  const matrix = buildMatrix({
    questions: 'ABCDEFGHIJ'.split('').map((_, i) => ({ number: i + 1, type: 'MCQ', options: ['A', 'B', 'C', 'D'] })),
    submissions: [
      { respondentId: 'copy1', answers: answers('ABCDABCDAB') },
      { respondentId: 'copy2', answers: answers('ABCDABCDAB') },
      { respondentId: 'copy3', answers: answers('ABCDABCDAB') },
      { respondentId: 'solo', answers: answers('DCBADCBADC') }
    ]
  });
  const report = detectCollusion(matrix);
  assert.equal(report.identicalGroups.length, 1);
  assert.deepEqual(report.identicalGroups[0].respondentIds.sort(), ['copy1', 'copy2', 'copy3']);
  const cluster = report.clusters.find((c) => c.respondentIds.includes('copy1'));
  assert.equal(cluster.size, 3);
  assert.equal(cluster.containsIdenticalSubmissions, true);
  assert.ok(!report.clusters.some((c) => c.respondentIds.includes('solo')));
});

test('answer signatures record blanks so partial submissions differ', () => {
  const sig = answerSignature({ answers: { 1: 'A', 3: 'C' } }, [1, 2, 3]);
  assert.equal(sig, '1:A|2:-|3:C');
});

function cohortWithOneCollusionRing() {
  const rng = mulberry32(7);
  const questionCount = 30;
  const questions = Array.from({ length: questionCount }, (_, i) => ({
    number: i + 1,
    type: 'MCQ',
    options: ['A', 'B', 'C', 'D', 'E', 'F']
  }));
  const submissions = [];
  for (let i = 0; i < 40; i += 1) {
    submissions.push({
      respondentId: 'indep' + i,
      answers: Array.from({ length: questionCount }, (_, q) => ({
        questionNumber: q + 1,
        answer: ['A', 'A', 'A', 'B', 'B', 'C', 'D'][randomInt(rng, 7)]
      }))
    });
  }
  const sharedRare = Array.from({ length: 12 }, (_, q) => ({
    questionNumber: q + 1,
    answer: q % 2 === 0 ? 'E' : 'F'
  }));
  for (let i = 0; i < 3; i += 1) {
    submissions.push({
      respondentId: 'ring' + i,
      answers: [
        ...sharedRare,
        ...Array.from({ length: questionCount - 12 }, (_, q) => ({
          questionNumber: q + 13,
          answer: ['A', 'B', 'C', 'D'][randomInt(rng, 4)]
        }))
      ]
    });
  }
  return buildMatrix({ questions, submissions });
}

test('near-identical rare-answer patterns cluster the colluding ring only', () => {
  const report = detectCollusion(cohortWithOneCollusionRing());
  const ringCluster = report.clusters.find((c) => c.respondentIds.includes('ring0'));
  assert.ok(ringCluster, 'the ring should be detected');
  assert.deepEqual(ringCluster.respondentIds, ['ring0', 'ring1', 'ring2']);
  assert.ok(ringCluster.maxRareMatches >= 12);
  for (const cluster of report.clusters) {
    assert.ok(
      cluster.respondentIds.every((id) => id.startsWith('ring')),
      'independent respondents were clustered: ' + cluster.respondentIds.join(', ')
    );
  }
});

test('agreement on popular answers is not treated as collusion', () => {
  const questions = Array.from({ length: 20 }, (_, i) => ({
    number: i + 1,
    type: 'MCQ',
    options: ['A', 'B', 'C', 'D']
  }));
  const submissions = Array.from({ length: 30 }, (_, i) => ({
    respondentId: 'r' + i,
    answers: questions.map((q) => ({ questionNumber: q.number, answer: 'A' }))
  }));
  const report = detectCollusion(buildMatrix({ questions, submissions }));
  assert.equal(report.rareAnswerCount, 0);
  assert.equal(report.suspiciousPairs.length, 0);
  assert.equal(report.identicalGroups.length, 1);
});

test('the rare-match threshold is configurable', () => {
  const matrix = cohortWithOneCollusionRing();
  const strict = detectCollusion(matrix, { rareMatchThreshold: 50 });
  assert.equal(strict.suspiciousPairs.length, 0);
  assert.equal(strict.clusters.length, 0);
});

test('a cohort smaller than two respondents reports nothing', () => {
  const report = detectCollusion(buildMatrix({ questions: [], submissions: [] }));
  assert.deepEqual(report.clusters, []);
  assert.equal(report.totalRespondents, 0);
});
