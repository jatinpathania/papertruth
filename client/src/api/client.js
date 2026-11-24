const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const TOKEN_KEY = 'papertruth.token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY)
};

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const token = tokenStore.get();
  let response;
  try {
    response = await fetch(`${BASE}/api${path}`, {
      method,
      signal,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError(0, 'Cannot reach the PaperTruth server. Is it running on port 5000?');
  }

  if (response.status === 204) return null;

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text.slice(0, 200) };
    }
  }

  if (!response.ok) {
    if (response.status === 401 && tokenStore.get()) {
      tokenStore.clear();
      window.dispatchEvent(new Event('papertruth:unauthorised'));
    }
    throw new ApiError(response.status, payload?.error || `Request failed (${response.status})`, payload?.details);
  }
  return payload;
}

export const api = {
  get: (path, options) => request(path, options),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  del: (path, options) => request(path, { ...options, method: 'DELETE' }),

  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  verifyRegistration: (payload) => request('/auth/register/verify', { method: 'POST', body: payload }),
  resendRegistrationCode: (payload) => request('/auth/register/resend', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  me: () => request('/auth/me'),

  exams: () => request('/exams'),
  exam: (id) => request(`/exams/${id}`),
  createExam: (payload) => request('/exams', { method: 'POST', body: payload }),
  setExamStatus: (id, payload) => request(`/exams/${id}/status`, { method: 'PATCH', body: payload }),
  monitor: (id) => request(`/exams/${id}/monitor`),
  deleteExam: (id) => request(`/exams/${id}`, { method: 'DELETE' }),

  submit: (examId, answers) => request(`/exams/${examId}/submissions`, { method: 'POST', body: { answers } }),
  mySubmission: (examId) => request(`/exams/${examId}/submissions/me`),
  submissionCount: (examId) => request(`/exams/${examId}/submissions/count`),

  compute: (examId) => request(`/exams/${examId}/consensus/compute`, { method: 'POST' }),
  consensus: (examId) => request(`/exams/${examId}/consensus`),
  consensusMethod: (examId, method) => request(`/exams/${examId}/consensus/${method}`),
  question: (examId, number) => request(`/exams/${examId}/consensus/question/${number}`),
  liveConsensus: (examId) => request(`/exams/${examId}/consensus-live`),

  disputes: (examId, { limit = 12, onlyFlagged = false, method } = {}) =>
    request(
      `/exams/${examId}/disputes?limit=${limit}&onlyFlagged=${onlyFlagged}` +
        (method ? `&method=${method}` : '')
    ),
  thread: (examId, number) => request(`/exams/${examId}/disputes/${number}/thread`),
  postToThread: (examId, number, body) =>
    request(`/exams/${examId}/disputes/${number}/posts`, { method: 'POST', body: { body } }),
  voteOnPost: (examId, number, postId, direction = 'up') =>
    request(`/exams/${examId}/disputes/${number}/posts/${postId}/vote`, {
      method: 'POST',
      body: { direction }
    }),

  myResults: (examId, method) =>
    request(`/exams/${examId}/results/me${method ? `?method=${method}` : ''}`),
  myResultsCompare: (examId) => request(`/exams/${examId}/results/me/compare`),
  scoreDistribution: (examId, method) =>
    request(`/exams/${examId}/results/distribution${method ? `?method=${method}` : ''}`),

  officialKey: (examId) => request(`/exams/${examId}/official-key`),
  uploadKey: (examId, answers) =>
    request(`/exams/${examId}/official-key`, { method: 'PUT', body: { answers } }),
  validation: (examId) => request(`/exams/${examId}/validation`),
  curve: (examId, { step = 10, trials = 5 } = {}) =>
    request(`/exams/${examId}/validation/curve?step=${step}&trials=${trials}`),
  mismatches: (examId) => request(`/exams/${examId}/validation/mismatches`),

  integrity: (examId, params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
    ).toString();
    return request(`/exams/${examId}/integrity${query ? `?${query}` : ''}`);
  },

  health: () => request('/health')
};

export default api;
