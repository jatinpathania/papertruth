import { mulberry32, randomNormal, shuffled } from '../../utils/rng.js';

export const OPTION_LABELS = ['A', 'B', 'C', 'D'];

export const DEFAULT_TOPICS = [
  'Arrays & Strings',
  'Linked Lists',
  'Trees & Graphs',
  'Sorting & Searching',
  'Dynamic Programming',
  'Complexity Analysis',
  'Hashing'
];

export const COHORT_DEFAULTS = {
  seed: 42,
  questionCount: 50,
  optionCount: 4,
  respondentCount: 150,
  trapCount: 7,
  abilityMin: 0.35,
  abilityMax: 0.95,
  abilityMean: 0.66,
  abilityStdDev: 0.15,
  answerRate: 0.97,
  temptingDistractorShare: 0.5,
  trapCorrectShareRange: [0.34, 0.46],
  trapAbilitySlope: 0.05,
  trapCaptureRate: 0.85,
  ambiguousCount: 4,
  ambiguousCorrectRate: 0.25,
  predictionInsight: 0.62,
  trapPredictionInsight: 0.85,
  collectPredictions: true,
  collusionGroups: [{ size: 4, copyRate: 1 }, { size: 3, copyRate: 0.94 }],
  topics: DEFAULT_TOPICS
};

export function generateCohort(options = {}) {
  const cfg = { ...COHORT_DEFAULTS, ...options };
  const rng = mulberry32(cfg.seed);
  const optionLabels = OPTION_LABELS.slice(0, cfg.optionCount);

  const trapNumbers = new Set(
    shuffled(rng, Array.from({ length: cfg.questionCount }, (_, i) => i + 1)).slice(0, cfg.trapCount)
  );

  const remaining = shuffled(
    rng,
    Array.from({ length: cfg.questionCount }, (_, i) => i + 1).filter((n) => !trapNumbers.has(n))
  );
  const ambiguousNumbers = new Set(remaining.slice(0, cfg.ambiguousCount));

  const trapOrder = [...trapNumbers].sort((a, b) => a - b);
  const trapCorrectShare = new Map(
    trapOrder.map((number, i) => {
      const [from, to] = cfg.trapCorrectShareRange;
      const t = trapOrder.length > 1 ? i / (trapOrder.length - 1) : 1;
      return [number, from + (to - from) * t];
    })
  );

  const questions = Array.from({ length: cfg.questionCount }, (_, index) => {
    const number = index + 1;
    const correctIndex = Math.floor(rng() * optionLabels.length);
    let temptingIndex = Math.floor(rng() * (optionLabels.length - 1));
    if (temptingIndex >= correctIndex) temptingIndex += 1;
    const isTrap = trapNumbers.has(number);
    const isAmbiguous = ambiguousNumbers.has(number);
    const label = isTrap ? '[Commonly misremembered] ' : isAmbiguous ? '[Poorly recalled] ' : '';
    return {
      number,
      type: 'MCQ',
      options: [...optionLabels],
      topic: cfg.topics[index % cfg.topics.length],
      text: `${label}Question ${number} — ${cfg.topics[index % cfg.topics.length]}`,
      isAmbiguous,
      correctAnswer: optionLabels[correctIndex],
      temptingAnswer: optionLabels[temptingIndex],
      isTrap,
      targetCorrectShare: isTrap ? trapCorrectShare.get(number) : null
    };
  });

  const groundTruth = questions.map((q) => ({ questionNumber: q.number, answer: q.correctAnswer }));
  const expectedPopular = new Map(
    questions.map((q) => [q.number, q.isTrap ? q.temptingAnswer : q.correctAnswer])
  );

  const abilities = Array.from({ length: cfg.respondentCount }, () =>
    clamp(randomNormal(rng, cfg.abilityMean, cfg.abilityStdDev), cfg.abilityMin, cfg.abilityMax)
  );
  const sortedAbilities = [...abilities].sort((a, b) => a - b);
  const abilityCutoff = new Map(
    questions
      .filter((q) => q.isTrap)
      .map((q) => [q.number, quantile(sortedAbilities, 1 - q.targetCorrectShare)])
  );

  const respondents = abilities.map((ability, i) => ({
    respondentId: `sim-${String(i + 1).padStart(3, '0')}`,
    ability,
    answers: questions
      .map((question) =>
        answerQuestion(rng, cfg, question, ability, optionLabels, expectedPopular, abilityCutoff)
      )
      .filter(Boolean)
  }));

  const optionsByNumber = new Map(questions.map((q) => [q.number, q.options]));
  const collusionGroups = [];
  let colludingIndex = 0;
  for (const group of cfg.collusionGroups || []) {
    const size = Math.min(group.size, cfg.respondentCount - colludingIndex);
    if (size < 2) break;
    const members = respondents.slice(colludingIndex, colludingIndex + size);
    const source = members[0];
    const copyRate = group.copyRate ?? 1;
    for (let i = 1; i < members.length; i += 1) {
      const own = new Map(members[i].answers.map((a) => [a.questionNumber, a]));
      members[i].answers = source.answers.map((a) => {
        if (rng() < copyRate) return { ...a };
        const mine = own.get(a.questionNumber);
        if (mine && mine.answer !== a.answer) return { ...mine };
        const alternatives = (optionsByNumber.get(a.questionNumber) || []).filter((o) => o !== a.answer);
        if (alternatives.length === 0) return { ...a };
        return { ...(mine || a), answer: alternatives[Math.floor(rng() * alternatives.length)] };
      });
      members[i].colludedWith = source.respondentId;
    }
    collusionGroups.push({
      respondentIds: members.map((m) => m.respondentId),
      copyRate,
      identical: copyRate >= 1
    });
    colludingIndex += size;
  }

  return {
    params: cfg,
    questions,
    groundTruth,
    trapQuestionNumbers: [...trapNumbers].sort((a, b) => a - b),
    ambiguousQuestionNumbers: [...ambiguousNumbers].sort((a, b) => a - b),
    respondents,
    collusionGroups,
    abilityStats: {
      mean: abilities.reduce((a, b) => a + b, 0) / (abilities.length || 1),
      min: abilities.length ? Math.min(...abilities) : 0,
      max: abilities.length ? Math.max(...abilities) : 0
    }
  };
}

function answerQuestion(rng, cfg, question, ability, optionLabels, expectedPopular, abilityCutoff) {
  if (rng() > cfg.answerRate) return null;

  const distractors = optionLabels.filter((o) => o !== question.correctAnswer);
  const otherDistractors = distractors.filter((o) => o !== question.temptingAnswer);

  let answer;
  let correct;
  if (question.isAmbiguous) {
    correct = rng() < cfg.ambiguousCorrectRate;
    answer = correct ? question.correctAnswer : pickFrom(rng, distractors);
  } else if (question.isTrap) {
    const cutoff = abilityCutoff?.get(question.number) ?? 0.5;
    const correctChance =
      cfg.trapAbilitySlope > 0
        ? 1 / (1 + Math.exp(-(ability - cutoff) / cfg.trapAbilitySlope))
        : ability >= cutoff
          ? 1
          : 0;
    correct = rng() < correctChance;
    if (correct) {
      answer = question.correctAnswer;
    } else if (rng() < cfg.trapCaptureRate) {
      answer = question.temptingAnswer;
    } else {
      answer = pickFrom(rng, otherDistractors.length ? otherDistractors : distractors);
    }
  } else {
    correct = rng() < ability;
    if (correct) {
      answer = question.correctAnswer;
    } else if (rng() < cfg.temptingDistractorShare) {
      answer = question.temptingAnswer;
    } else {
      answer = pickFrom(rng, otherDistractors.length ? otherDistractors : distractors);
    }
  }

  const entry = {
    questionNumber: question.number,
    answer,
    confidence: confidenceFor(rng, ability, correct)
  };

  if (cfg.collectPredictions) {
    const insight = question.isAmbiguous
      ? 0
      : question.isTrap
        ? cfg.trapPredictionInsight
        : cfg.predictionInsight;
    entry.predictedMajority = rng() < insight ? expectedPopular.get(question.number) : answer;
  }

  return entry;
}

function confidenceFor(rng, ability, correct) {
  const base = ability * 4 + (correct ? 1 : 0) + rng() * 1.2 - 0.6;
  return clamp(Math.round(base), 1, 5);
}

function pickFrom(rng, array) {
  return array[Math.floor(rng() * array.length)];
}

function clamp(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value));
}

function quantile(sortedValues, p) {
  if (sortedValues.length === 0) return 0;
  const position = clamp(p, 0, 1) * (sortedValues.length - 1);
  const low = Math.floor(position);
  const high = Math.ceil(position);
  if (low === high) return sortedValues[low];
  return sortedValues[low] + (sortedValues[high] - sortedValues[low]) * (position - low);
}

export function cohortToMatrix(cohort) {
  return {
    questions: cohort.questions.map(({ number, type, options, topic, text }) => ({
      number,
      type,
      options,
      topic,
      text
    })),
    responses: cohort.respondents.map((r) => ({
      respondentId: r.respondentId,
      answers: Object.fromEntries(r.answers.map((a) => [a.questionNumber, a.answer])),
      predictions: Object.fromEntries(
        r.answers.filter((a) => a.predictedMajority).map((a) => [a.questionNumber, a.predictedMajority])
      ),
      confidences: Object.fromEntries(
        r.answers.filter((a) => a.confidence).map((a) => [a.questionNumber, a.confidence])
      )
    }))
  };
}

export default generateCohort;
