import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(pathToFileURL(path.join(here, '..', '..', 'client', 'package.json')));
const { io } = require('socket.io-client');

const API = process.env.API_URL || 'http://localhost:5000';
const suffix = Date.now().toString(36);
const student = {
  name: 'Realtime Probe',
  email: `probe.${suffix}@papertruth.test`,
  password: 'probe123'
};

const fail = (message) => {
  console.error(`FAIL  ${message}`);
  process.exit(1);
};
const ok = (message) => console.log(`ok    ${message}`);

async function call(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${API}/api${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status} ${payload?.error || ''}`);
  return payload;
}

const health = await call('/health').catch(() => null);
if (!health) fail(`the API is not answering on ${API}. Start it with: npm run dev`);
ok(`API is up (${API})`);

const admin = await call('/auth/login', {
  method: 'POST',
  body: { email: 'admin@papertruth.com', password: 'admin123' }
});
const { exams } = await call('/exams', { token: admin.token });
const exam = exams.find((e) => e.acceptingSubmissions) || exams[0];
if (!exam) fail('no exams in the database — run: npm run simulate');
ok(`watching "${exam.title}" (${exam.submissionCount} submissions so far)`);

const socket = io(API, { transports: ['websocket'], auth: { token: admin.token } });
const received = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('no submission:received event within 15s')), 15000);
  socket.on('submission:received', (payload) => {
    clearTimeout(timer);
    resolve(payload);
  });
  socket.on('connect_error', (error) => reject(new Error(`socket connect_error: ${error.message}`)));
});

await new Promise((resolve, reject) => {
  socket.on('connect', resolve);
  socket.on('connect_error', reject);
  setTimeout(() => reject(new Error('socket did not connect within 8s')), 8000);
}).catch((error) => fail(error.message));
ok(`websocket connected (${socket.id})`);

socket.emit('exam:watch', exam.id);
await new Promise((resolve) => socket.once('exam:watching', resolve));
ok(`joined room exam:${exam.id}`);

const registration = await call('/auth/register', { method: 'POST', body: student });
ok(`registered a throwaway student (${student.email})`);

const detail = await call(`/exams/${exam.id}`, { token: registration.token });
const answers = detail.questions.slice(0, 12).map((question, index) => ({
  questionNumber: question.number,
  answer: (question.options?.length ? question.options : ['A', 'B', 'C', 'D'])[index % 4],
  predictedMajority: question.options?.[0] ?? 'A',
  confidence: 3
}));

const submitted = await call(`/exams/${exam.id}/submissions`, {
  method: 'POST',
  token: registration.token,
  body: { answers }
});
ok(`submitted ${submitted.answered} answers as ${submitted.respondentId}`);

const event = await received.catch((error) => fail(error.message));
ok(`event received: ${event.respondentCount} respondents, ${event.answered} answers`);

if (event.respondentId !== submitted.respondentId) {
  fail(`event carried respondentId ${event.respondentId}, expected ${submitted.respondentId}`);
}
if (!event.methods?.WEIGHTED_EM) fail('event carried no refreshed consensus summary');
if (event.userId || event.email) fail('event leaked an identity field');
ok(
  `live consensus summary present: mean confidence ${(event.methods.WEIGHTED_EM.meanConfidence * 100).toFixed(1)}%, ` +
    `${event.methods.MAJORITY.disputedQuestions} disputed`
);
ok('payload is pseudonymous (no userId / email)');

socket.close();
console.log('\nRealtime path verified.');
process.exit(0);
