import test from 'node:test';
import assert from 'node:assert/strict';
import {
  levenshtein,
  normaliseAnswer,
  isNearDuplicate,
  groupShortAnswers,
  cosineSimilarity,
  mergeGroupsBySimilarity,
  canonicaliseShortAnswers
} from '../src/services/consensus/shortAnswer.js';
import { buildMatrix } from '../src/services/consensus/matrix.js';

test('levenshtein: standard textbook cases', () => {
  assert.equal(levenshtein('kitten', 'sitting'), 3);
  assert.equal(levenshtein('flaw', 'lawn'), 2);
  assert.equal(levenshtein('saturday', 'sunday'), 3);
  assert.equal(levenshtein('intention', 'execution'), 5);
  assert.equal(levenshtein('gumbo', 'gambol'), 2);
});

test('levenshtein: identity, empty strings and single edits', () => {
  assert.equal(levenshtein('', ''), 0);
  assert.equal(levenshtein('abc', 'abc'), 0);
  assert.equal(levenshtein('', 'abc'), 3);
  assert.equal(levenshtein('abc', ''), 3);
  assert.equal(levenshtein('abc', 'abd'), 1);
  assert.equal(levenshtein('abc', 'abcd'), 1);
  assert.equal(levenshtein('abcd', 'abc'), 1);
});

test('levenshtein is symmetric and satisfies the triangle inequality', () => {
  const a = 'linearithmic';
  const b = 'logarithmic';
  const c = 'algorithmic';
  assert.equal(levenshtein(a, b), levenshtein(b, a));
  assert.ok(levenshtein(a, c) <= levenshtein(a, b) + levenshtein(b, c));
});

test('normalisation lowercases, strips punctuation and collapses whitespace', () => {
  assert.equal(normaliseAnswer('  O(n LOG n)!!  '), 'o n log n');
  assert.equal(normaliseAnswer('Round-Robin'), 'round robin');
  assert.equal(normaliseAnswer('T.C.P.'), 't c p');
  assert.equal(normaliseAnswer(null), '');
  assert.equal(normaliseAnswer(42), '42');
});

test('near-duplicate rule: 2 absolute edits, or 20% of the longer string', () => {
  assert.equal(isNearDuplicate('quicksort', 'quick sort'), true);
  assert.equal(isNearDuplicate('binary search tree', 'binary search trees'), true);
  assert.equal(isNearDuplicate('dynamic programming', 'dinamic programing'), true);
  assert.equal(isNearDuplicate('heap', 'tree'), false);
  assert.equal(isNearDuplicate('', 'heap'), false);
});

test('grouping merges typos and spelling variants into one answer group', () => {
  const answers = [
    { respondentId: 'r1', answer: 'Quicksort' },
    { respondentId: 'r2', answer: 'quick sort' },
    { respondentId: 'r3', answer: 'QUICKSORT!' },
    { respondentId: 'r4', answer: 'Mergesort' },
    { respondentId: 'r5', answer: 'merge sort' },
    { respondentId: 'r6', answer: 'Heapsort' }
  ];
  const { groups } = groupShortAnswers(answers);
  assert.equal(groups.length, 3);
  assert.equal(groups[0].count, 3);
  assert.equal(normaliseAnswer(groups[0].label), 'quicksort');
  assert.deepEqual(groups[0].respondentIds.sort(), ['r1', 'r2', 'r3']);
  const labels = groups.map((g) => normaliseAnswer(g.label)).sort();
  assert.deepEqual(labels, ['heapsort', 'mergesort', 'quicksort']);
});

test('group labels are the most frequently typed spelling', () => {
  const answers = [
    { respondentId: 'a', answer: 'O(n log n)' },
    { respondentId: 'b', answer: 'O(n log n)' },
    { respondentId: 'c', answer: 'O(n logn)' }
  ];
  const { groups } = groupShortAnswers(answers);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, 'O(n log n)');
  assert.equal(groups[0].count, 3);
  assert.deepEqual(groups[0].variants, { 'O(n log n)': 2, 'O(n logn)': 1 });
});

test('blank answers are dropped rather than forming a group', () => {
  const { groups } = groupShortAnswers([
    { respondentId: 'a', answer: '   ' },
    { respondentId: 'b', answer: '!!!' },
    { respondentId: 'c', answer: 'stack' }
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, 'stack');
});

test('cosine similarity: identical, orthogonal and opposite vectors', () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.ok(Math.abs(cosineSimilarity([1, 1], [-1, -1]) + 1) < 1e-12);
  assert.equal(cosineSimilarity([], [1, 2]), 0);
  assert.equal(cosineSimilarity([0, 0], [1, 2]), 0);
  assert.ok(Math.abs(cosineSimilarity([1, 2, 3], [2, 4, 6]) - 1) < 1e-12);
});

test('embeddings merge groups that no string metric could ever join', () => {
  const answers = [
    { respondentId: 'a', answer: 'O(n log n)' },
    { respondentId: 'b', answer: 'O(n log n)' },
    { respondentId: 'c', answer: 'linearithmic' },
    { respondentId: 'd', answer: 'quadratic' }
  ];
  const grouped = groupShortAnswers(answers);
  assert.equal(grouped.groups.length, 3, 'edit distance alone keeps them apart');

  const embeddings = {
    'O(n log n)': [1, 0.95, 0.1],
    linearithmic: [0.98, 1, 0.12],
    quadratic: [-0.4, 0.2, 1]
  };
  const merged = mergeGroupsBySimilarity(grouped, embeddings);
  assert.equal(merged.groups.length, 2);
  const big = merged.groups[0];
  assert.equal(big.count, 3);
  assert.equal(merged.semanticMerges.length, 1);
  assert.ok(merged.semanticMerges[0].similarity >= 0.85);
});

test('missing embeddings leave the edit-distance groups untouched', () => {
  const grouped = groupShortAnswers([
    { respondentId: 'a', answer: 'stack' },
    { respondentId: 'b', answer: 'queue' }
  ]);
  const merged = mergeGroupsBySimilarity(grouped, {});
  assert.equal(merged.groups.length, 2);
  assert.deepEqual(merged.semanticMerges, []);
});

test('canonicalising a matrix rewrites SHORT answers into group labels', () => {
  const matrix = buildMatrix({
    questions: [
      { number: 1, type: 'MCQ', options: ['A', 'B'] },
      { number: 2, type: 'SHORT' }
    ],
    submissions: [
      { respondentId: 'r1', answers: [{ questionNumber: 1, answer: 'A' }, { questionNumber: 2, answer: 'Quicksort' }] },
      { respondentId: 'r2', answers: [{ questionNumber: 1, answer: 'A' }, { questionNumber: 2, answer: 'quick sort' }] },
      { respondentId: 'r3', answers: [{ questionNumber: 1, answer: 'B' }, { questionNumber: 2, answer: 'Mergesort' }] }
    ]
  });
  const { matrix: canonical, groupsByQuestion } = canonicaliseShortAnswers(matrix);
  const q2Answers = canonical.responses.map((r) => r.answers[2]);
  assert.equal(q2Answers[0], q2Answers[1], 'both spellings collapse to one label');
  assert.notEqual(q2Answers[0], q2Answers[2]);
  assert.deepEqual(canonical.responses.map((r) => r.answers[1]), ['A', 'A', 'B']);
  assert.equal(groupsByQuestion[2].length, 2);
  assert.equal(canonical.questions.find((q) => q.number === 2).options.length, 2);
});
