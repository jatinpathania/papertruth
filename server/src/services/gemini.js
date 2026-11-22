import { env, geminiEnabled } from '../config/env.js';

const EMBED_ENDPOINT = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents`;

const REQUEST_TIMEOUT_MS = 8000;
const BATCH_SIZE = 100;

export const geminiStatus = () => ({
  enabled: geminiEnabled,
  model: geminiEnabled ? env.geminiModel : null,
  reason: geminiEnabled ? null : 'GEMINI_API_KEY not set — using edit-distance grouping only'
});

export async function embedTexts(texts = [], { logger = console } = {}) {
  const distinct = [...new Set(texts.map((t) => `${t}`.trim()).filter(Boolean))];
  if (!geminiEnabled || distinct.length === 0) return {};

  const embeddings = {};
  for (let i = 0; i < distinct.length; i += BATCH_SIZE) {
    const batch = distinct.slice(i, i + BATCH_SIZE);
    try {
      const vectors = await embedBatch(batch);
      batch.forEach((text, index) => {
        const vector = vectors[index];
        if (Array.isArray(vector) && vector.length > 0) embeddings[text] = vector;
      });
    } catch (error) {
      logger.warn(`[gemini] embedding request failed (${error.message}) — falling back to edit distance`);
      return {};
    }
  }
  return embeddings;
}

async function embedBatch(batch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${EMBED_ENDPOINT(env.geminiModel)}?key=${env.geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        requests: batch.map((text) => ({
          model: `models/${env.geminiModel}`,
          content: { parts: [{ text }] },
          taskType: 'SEMANTIC_SIMILARITY'
        }))
      })
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${await safeText(response)}`);
    }
    const payload = await response.json();
    return (payload.embeddings || []).map((e) => e.values || e.value || []);
  } finally {
    clearTimeout(timeout);
  }
}

async function safeText(response) {
  try {
    const text = await response.text();
    return text.slice(0, 200);
  } catch {
    return '';
  }
}

export async function embeddingsForShortAnswers(questions = [], submissions = [], { logger = console } = {}) {
  if (!geminiEnabled) return {};
  const shortNumbers = questions.filter((q) => q.type === 'SHORT').map((q) => q.number);
  if (shortNumbers.length === 0) return {};

  const byQuestion = new Map(shortNumbers.map((n) => [n, new Set()]));
  for (const submission of submissions) {
    for (const answer of submission.answers || []) {
      const bucket = byQuestion.get(Number(answer.questionNumber));
      if (bucket && answer.answer) bucket.add(`${answer.answer}`.trim());
    }
  }

  const allTexts = [...byQuestion.values()].flatMap((set) => [...set]);
  const vectors = await embedTexts(allTexts, { logger });
  if (Object.keys(vectors).length === 0) return {};

  const out = {};
  for (const [questionNumber, texts] of byQuestion) {
    const perQuestion = {};
    for (const text of texts) {
      if (vectors[text]) perQuestion[text] = vectors[text];
    }
    if (Object.keys(perQuestion).length > 1) out[questionNumber] = perQuestion;
  }
  return out;
}

export default embedTexts;
