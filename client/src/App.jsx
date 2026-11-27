import { Suspense } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { RequireAuth, useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Backdrop from './components/Backdrop.jsx';
import { useGlobalEffects } from './components/effects.js';
import { Headline, Page } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import Landing from './pages/Landing.jsx';
import {
  About,
  AdminHome,
  Analytics,
  CreateExam,
  DisputeDetail,
  Disputes,
  ExamList,
  ForgotPassword,
  Integrity,
  Monitor,
  MyResults,
  Register,
  ResetPassword,
  Results,
  SubmitAnswers,
  Validation
} from './routes.js';

const routeFallback = (
  <Page>
    <div className="route-loading">
      <span className="spinner" />
    </div>
  </Page>
);

export default function App() {
  const { user } = useAuth();
  useGlobalEffects();

  return (
    <MotionConfig reducedMotion="user">
      <Backdrop />
      <Suspense fallback={routeFallback}>
      <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/exams" replace /> : <Login />}
      />
      <Route
        path="/register"
        element={user ? <Navigate to="/exams" replace /> : <Register />}
      />
      <Route
        path="/forgot-password"
        element={user ? <Navigate to="/exams" replace /> : <ForgotPassword />}
      />
      <Route
        path="/reset-password"
        element={user ? <Navigate to="/exams" replace /> : <ResetPassword />}
      />

      <Route element={<Layout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/about" element={<About />} />

        <Route path="/exams" element={<RequireAuth><ExamList /></RequireAuth>} />
        <Route path="/results" element={<RequireAuth><Results /></RequireAuth>} />
        <Route path="/exams/:examId/submit" element={<RequireAuth><SubmitAnswers /></RequireAuth>} />
        <Route path="/exams/:examId/results" element={<RequireAuth><MyResults /></RequireAuth>} />
        <Route path="/exams/:examId/disputes" element={<RequireAuth><Disputes /></RequireAuth>} />
        <Route
          path="/exams/:examId/disputes/:questionNumber"
          element={<RequireAuth><DisputeDetail /></RequireAuth>}
        />

        <Route path="/admin" element={<RequireAuth adminOnly><AdminHome /></RequireAuth>} />
        <Route path="/admin/exams/new" element={<RequireAuth adminOnly><CreateExam /></RequireAuth>} />
        <Route path="/admin/exams/:examId/monitor" element={<RequireAuth adminOnly><Monitor /></RequireAuth>} />
        <Route path="/admin/exams/:examId/analytics" element={<RequireAuth adminOnly><Analytics /></RequireAuth>} />
        <Route path="/admin/exams/:examId/validation" element={<RequireAuth adminOnly><Validation /></RequireAuth>} />
        <Route path="/admin/exams/:examId/integrity" element={<RequireAuth adminOnly><Integrity /></RequireAuth>} />

        <Route
          path="*"
          element={
            <Page className="not-found">
            <div className="hero-xl mt-3">
              <div className="hero-xl-inner">
                <span className="section-kicker">Error 404</span>
                <Headline className="hero-title" lines={['This page', { text: 'is not on', grad: true }, 'the paper.']} />
                <p className="hero-lede">
                  The link may be old, or the exam may have been removed. Everything that
                  still exists is one click away.
                </p>
                <div className="hero-actions">
                  <Link className="btn primary lg" to="/">
                    Back to the home page <span className="arrow">→</span>
                  </Link>
                </div>
              </div>
            </div>
            </Page>
          }
        />
      </Route>
      </Routes>
      </Suspense>
    </MotionConfig>
  );
}
