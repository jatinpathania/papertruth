import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import { ErrorNote } from '../components/ui.jsx';
import AuthShell from '../components/AuthShell.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(form);
      navigate(location.state?.from || '/exams', { replace: true });
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <span className="eyebrow">Sign in</span>
      <h1 className="auth-title">Welcome back</h1>
      <p className="muted small">Pick up where the class left off.</p>

      <form onSubmit={submit} className="mt-2">
        <div className="field">
          <label htmlFor="email">Email</label>
          <div className="input-wrap">
            <span className="input-icon" aria-hidden="true">
              ✉
            </span>
            <input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="you@college.edu"
              required
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <div className="input-wrap">
            <span className="input-icon" aria-hidden="true">
              🔒
            </span>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              required
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
            <button
              type="button"
              className="input-action small subtle"
              onClick={() => setShowPassword((v) => !v)}
              aria-pressed={showPassword}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {error && <ErrorNote error={error} />}

        <motion.button className="primary lg block mt-1" type="submit" disabled={busy} whileTap={{ scale: 0.98 }}>
          {busy ? <span className="spinner" /> : null}
          {busy ? 'Signing in…' : (
            <>
              Sign in <span className="arrow">→</span>
            </>
          )}
        </motion.button>
      </form>

      <p className="small muted mt-2 mb-0 center">
        No account? <Link to="/register">Register as a student</Link>
      </p>
    </AuthShell>
  );
}
