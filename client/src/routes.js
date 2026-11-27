import { lazy } from 'react';

// Each route is its own chunk. The loader is kept next to the component so a
// link can warm the chunk on hover, which is what makes navigation feel instant.
const defs = {
  register: () => import('./pages/Register.jsx'),
  forgotPassword: () => import('./pages/ForgotPassword.jsx'),
  resetPassword: () => import('./pages/ResetPassword.jsx'),
  about: () => import('./pages/About.jsx'),
  results: () => import('./pages/Results.jsx'),
  examList: () => import('./pages/ExamList.jsx'),
  submitAnswers: () => import('./pages/SubmitAnswers.jsx'),
  myResults: () => import('./pages/MyResults.jsx'),
  disputes: () => import('./pages/Disputes.jsx'),
  disputeDetail: () => import('./pages/DisputeDetail.jsx'),
  adminHome: () => import('./pages/admin/AdminHome.jsx'),
  createExam: () => import('./pages/admin/CreateExam.jsx'),
  monitor: () => import('./pages/admin/Monitor.jsx'),
  analytics: () => import('./pages/admin/Analytics.jsx'),
  validation: () => import('./pages/admin/Validation.jsx'),
  integrity: () => import('./pages/admin/Integrity.jsx')
};

export const Register = lazy(defs.register);
export const ForgotPassword = lazy(defs.forgotPassword);
export const ResetPassword = lazy(defs.resetPassword);
export const About = lazy(defs.about);
export const Results = lazy(defs.results);
export const ExamList = lazy(defs.examList);
export const SubmitAnswers = lazy(defs.submitAnswers);
export const MyResults = lazy(defs.myResults);
export const Disputes = lazy(defs.disputes);
export const DisputeDetail = lazy(defs.disputeDetail);
export const AdminHome = lazy(defs.adminHome);
export const CreateExam = lazy(defs.createExam);
export const Monitor = lazy(defs.monitor);
export const Analytics = lazy(defs.analytics);
export const Validation = lazy(defs.validation);
export const Integrity = lazy(defs.integrity);

const byPath = [
  [/^\/register/, defs.register],
  [/^\/forgot-password/, defs.forgotPassword],
  [/^\/reset-password/, defs.resetPassword],
  [/^\/about/, defs.about],
  [/^\/results/, defs.results],
  [/^\/exams\/[^/]+\/submit/, defs.submitAnswers],
  [/^\/exams\/[^/]+\/results/, defs.myResults],
  [/^\/exams\/[^/]+\/disputes\/[^/]+/, defs.disputeDetail],
  [/^\/exams\/[^/]+\/disputes/, defs.disputes],
  [/^\/exams/, defs.examList],
  [/^\/admin\/exams\/new/, defs.createExam],
  [/^\/admin\/exams\/[^/]+\/monitor/, defs.monitor],
  [/^\/admin\/exams\/[^/]+\/analytics/, defs.analytics],
  [/^\/admin\/exams\/[^/]+\/validation/, defs.validation],
  [/^\/admin\/exams\/[^/]+\/integrity/, defs.integrity],
  [/^\/admin/, defs.adminHome]
];

const warmed = new Set();

export function prefetch(path) {
  if (typeof path !== 'string' || warmed.has(path)) return;
  const hit = byPath.find(([pattern]) => pattern.test(path));
  if (!hit) return;
  warmed.add(path);
  hit[1]().catch(() => warmed.delete(path));
}

export function prefetchIdle(paths) {
  const run = () => paths.forEach(prefetch);
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 2500 });
  else setTimeout(run, 1200);
}
