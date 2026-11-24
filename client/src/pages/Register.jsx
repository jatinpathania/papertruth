import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { ErrorNote } from '../components/ui.jsx';
import AuthShell from '../components/AuthShell.jsx';
import OtpDialog from '../components/OtpDialog.jsx';

function passwordStrength(value) {
  let score = 0;
  if (value.length >= 6) score += 1;
  if (value.length >= 10) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value) || /[^A-Za-z0-9]/.test(value)) score += 1;
  return score;
}
const STRENGTH = [
  { label: 'Too short', color: 'var(--danger)' },
  { label: 'Okay', color: 'var(--warn)' },
  { label: 'Good', color: 'var(--method-sp)' },
  { label: 'Strong', color: 'var(--brand)' },
  { label: 'Excellent', color: 'var(--ok)' }
];

export default function Register() {
  const { register, verifyRegistration } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  // Set once the server has accepted the details and emailed a code. The account
  // still does not exist at this point — the dialog is what creates it.
  const [pending, setPending] = useState(null);

  const strength = passwordStrength(form.password);
  const meter = form.password.length < 6 ? STRENGTH[0] : STRENGTH[strength];

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setPending(await register(form));
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (code) => {
    await verifyRegistration({ email: form.email, code });
    setPending(null);
    navigate('/exams', { replace: true });
  };

  const resend = async () => {
    const next = await api.resendRegistrationCode({ email: form.email });
    setPending(next);
    return next;
  };

  return (
    <AuthShell>
      <span className="eyebrow">New here</span>
      <h1 className="auth-title">Create your account</h1>
      <p className="muted small">
        Your identity stays private — your answers are linked to an anonymous ID, never
        your name.
      </p>

      <form onSubmit={submit} className="mt-2">
        <div className="field">
          <label htmlFor="name">Full name</label>
          <div className="input-wrap">
            <span className="input-icon" aria-hidden="true">
              👤
            </span>
            <input
              id="name"
              autoComplete="name"
              placeholder="Your name"
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </div>
        </div>
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
              autoComplete="new-password"
              placeholder="At least 6 characters"
              minLength={6}
              required
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              aria-describedby="password-strength"
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
          <div className="strength" id="password-strength" aria-live="polite">
            <span className="strength-track">
              {[0, 1, 2, 3].map((step) => (
                <motion.span
                  key={step}
                  className="strength-seg"
                  animate={{
                    backgroundColor: form.password.length >= 6 && step < strength ? meter.color : 'rgba(255,255,255,0.08)',
                    scaleY: form.password.length >= 6 && step < strength ? 1 : 0.7
                  }}
                  transition={{ duration: 0.3 }}
                />
              ))}
            </span>
            <span className="tiny" style={{ color: form.password ? meter.color : 'var(--text-muted)' }}>
              {form.password ? meter.label : 'At least 6 characters'}
            </span>
          </div>
        </div>

        {error && <ErrorNote error={error} />}

        <motion.button className="primary lg block mt-1" type="submit" disabled={busy} whileTap={{ scale: 0.98 }}>
          {busy ? <span className="spinner" /> : null}
          {busy ? 'Sending code…' : (
            <>
              Create account <span className="arrow">→</span>
            </>
          )}
        </motion.button>
      </form>

      <p className="small muted mt-2 mb-0 center">
        Already registered? <Link to="/login">Sign in</Link>
      </p>

      <OtpDialog
        open={Boolean(pending)}
        email={pending?.email || form.email}
        resendAfterSeconds={pending?.resendAfterSeconds}
        devCode={pending?.devCode}
        onVerify={verify}
        onResend={resend}
        onClose={() => setPending(null)}
      />
    </AuthShell>
  );
}
