import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { ErrorNote } from '../components/ui.jsx';
import AuthShell from '../components/AuthShell.jsx';
import OtpDialog from '../components/OtpDialog.jsx';
import PasswordField from '../components/PasswordField.jsx';

export default function Register() {
  const { register, verifyRegistration } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  // Set once the server has accepted the details and emailed a code. The account
  // still does not exist at this point — the dialog is what creates it.
  const [pending, setPending] = useState(null);

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
        <PasswordField
          value={form.password}
          onChange={(password) => setForm({ ...form, password })}
        />

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
