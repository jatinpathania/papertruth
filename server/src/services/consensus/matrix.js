// Builds the respondent x question answer matrix every consensus method consumes.
export function buildMatrix({ questions = [], submissions = [] } = {}) {
  const normalisedQuestions = questions
    .map((q) => ({
      number: Number(q.number),
      type: q.type === 'SHORT' ? 'SHORT' : 'MCQ',
      options: Array.isArray(q.options) ? q.options.filter((o) => o !== null && o !== undefined && `${o}` !== '') : [],
      topic: q.topic || 'General',
      text: q.text || ''
    }))
    .sort((a, b) => a.number - b.number);

  const responses = submissions.map((s) => {
    const answers = {};
    const predictions = {};
    const confidences = {};
    for (const a of s.answers || []) {
      const qn = Number(a.questionNumber);
      if (!Number.isFinite(qn)) continue;
      if (a.answer !== undefined && a.answer !== null && `${a.answer}`.trim() !== '') {
        answers[qn] = `${a.answer}`;
      }
      if (a.predictedMajority !== undefined && a.predictedMajority !== null && `${a.predictedMajority}`.trim() !== '') {
        predictions[qn] = `${a.predictedMajority}`;
      }
      if (Number.isFinite(Number(a.confidence)) && Number(a.confidence) > 0) {
        confidences[qn] = Number(a.confidence);
      }
    }
    return { respondentId: `${s.respondentId}`, answers, predictions, confidences };
  });

  return { questions: normalisedQuestions, responses };
}

export function questionNumbers(matrix) {
  if (matrix.questions?.length) return matrix.questions.map((q) => q.number);
  const seen = new Set();
  for (const r of matrix.responses || []) {
    for (const qn of Object.keys(r.answers || {})) seen.add(Number(qn));
  }
  return [...seen].sort((a, b) => a - b);
}

export function questionIndex(matrix) {
  const index = new Map();
  for (const q of matrix.questions || []) index.set(q.number, q);
  return index;
}

export function optionDomain(matrix, qn, { includePredictions = false } = {}) {
  const meta = questionIndex(matrix).get(Number(qn));
  const domain = new Set(meta?.options || []);
  for (const r of matrix.responses || []) {
    const a = r.answers?.[qn];
    if (a !== undefined) domain.add(a);
    if (includePredictions) {
      const p = r.predictions?.[qn];
      if (p !== undefined) domain.add(p);
    }
  }
  return [...domain].sort(compareOptions);
}

export function compareOptions(a, b) {
  return `${a}`.localeCompare(`${b}`, 'en');
}

export function answersByQuestion(matrix) {
  const byQuestion = new Map();
  for (const qn of questionNumbers(matrix)) byQuestion.set(qn, []);
  for (const r of matrix.responses || []) {
    for (const [qnRaw, answer] of Object.entries(r.answers || {})) {
      const qn = Number(qnRaw);
      if (!byQuestion.has(qn)) byQuestion.set(qn, []);
      byQuestion.get(qn).push({ respondentId: r.respondentId, answer });
    }
  }
  return byQuestion;
}

export function predictionsByQuestion(matrix) {
  const byQuestion = new Map();
  for (const qn of questionNumbers(matrix)) byQuestion.set(qn, []);
  for (const r of matrix.responses || []) {
    for (const [qnRaw, prediction] of Object.entries(r.predictions || {})) {
      const qn = Number(qnRaw);
      if (!byQuestion.has(qn)) byQuestion.set(qn, []);
      byQuestion.get(qn).push({ respondentId: r.respondentId, prediction });
    }
  }
  return byQuestion;
}

export function countDistribution(entries, key = 'answer') {
  const counts = {};
  for (const e of entries) {
    const v = e[key];
    if (v === undefined || v === null) continue;
    counts[v] = (counts[v] || 0) + 1;
  }
  return counts;
}

export function subsetMatrix(matrix, respondentIds) {
  const keep = new Set(respondentIds);
  return {
    questions: matrix.questions,
    responses: (matrix.responses || []).filter((r) => keep.has(r.respondentId))
  };
}

export function hasPredictions(matrix) {
  return (matrix.responses || []).some((r) => Object.keys(r.predictions || {}).length > 0);
}
