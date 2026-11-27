import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../api/client.js';
import { ErrorNote } from '../components/ui.jsx';
import AuthShell from '../components/AuthShell.jsx';
import OtpDialog from '../components/OtpDialog.jsx';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  // Set once a code has been asked for. The server answers the same way whether
  // or not the address has an account, so reaching this state proves nothing
  // about the address — only that the request was accepted.
  const [pending, setPending] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setPending(await api.forgotPassword({ email }));
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  // The code buys a short-lived ticket, and the ticket is what the reset page
  // spends. Carried in history state so it never shows up in the address bar,
  // in a shared link, or in the browser's history.
  const verify = async (code) => {
    const { resetToken } = await api.verifyPasswordCode({ email, code });
    setPending(null);
    navigate('/reset-password', { replace: true, state: { email, resetToken } });
  };

  const resend = async () => {
    const next = await api.resendPasswordCode({ email });
    setPending(next);
    return next;
  };

  return (
    <AuthShell>
      <span className="eyebrow">Forgot password</span>
      <h1 className="auth-title">Let's get you back in</h1>
      <p className="muted small">
        Tell us the address on your account and we'll send a six-digit code to it.
      </p>

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
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
        </div>

        {error && <ErrorNote error={error} />}

        <motion.button
          className="primary lg block mt-1"
          type="submit"
          disabled={busy}
          whileTap={{ scale: 0.98 }}
        >
          {busy ? <span className="spinner" /> : null}
          {busy ? 'Sending code…' : (
            <>
              Send reset code <span className="arrow">→</span>
            </>
          )}
        </motion.button>
      </form>

      <p className="small muted mt-2 mb-0 center">
        Remembered it? <Link to="/login">Sign in</Link>
      </p>

      <OtpDialog
        open={Boolean(pending)}
        email={pending?.email || email}
        resendAfterSeconds={pending?.resendAfterSeconds}
        devCode={pending?.devCode}
        kicker="Step 2 of 3"
        submitLabel="Verify code"
        onVerify={verify}
        onResend={resend}
        onClose={() => setPending(null)}
      />
    </AuthShell>
  );
}
