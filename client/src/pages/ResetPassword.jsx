import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import { ErrorNote } from '../components/ui.jsx';
import AuthShell from '../components/AuthShell.jsx';
import PasswordField, { MIN_PASSWORD_LENGTH } from '../components/PasswordField.jsx';

export default function ResetPassword() {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { email, resetToken } = location.state || {};

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Landing here without a proved code — a bookmark, a refresh, a typed URL —
  // means there is nothing to spend, so start the flow again rather than show a
  // form that cannot succeed.
  if (!email || !resetToken) return <Navigate to="/forgot-password" replace />;

  const mismatch = confirm.length > 0 && confirm !== password;
  const ready = password.length >= MIN_PASSWORD_LENGTH && confirm === password;

  const submit = async (event) => {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await resetPassword({ email, resetToken, password });
      navigate('/exams', { replace: true });
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <span className="eyebrow">Step 3 of 3</span>
      <h1 className="auth-title">Choose a new password</h1>
      <p className="muted small">
        For <strong>{email}</strong>. Once it's saved you'll be signed straight in.
      </p>

      <form onSubmit={submit} className="mt-2">
        <PasswordField
          id="new-password"
          label="New password"
          value={password}
          onChange={setPassword}
        />

        <PasswordField
          id="confirm-password"
          label="Confirm new password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          placeholder="Type it again"
          meter={false}
          note={
            mismatch ? (
              <span className="tiny" style={{ color: 'var(--danger)' }}>
                Both passwords must match.
              </span>
            ) : null
          }
        />

        {error && <ErrorNote error={error} />}

        <motion.button
          className="primary lg block mt-1"
          type="submit"
          disabled={busy || !ready}
          whileTap={{ scale: 0.98 }}
        >
          {busy ? <span className="spinner" /> : null}
          {busy ? 'Saving…' : (
            <>
              Save and sign in <span className="arrow">→</span>
            </>
          )}
        </motion.button>
      </form>

      <p className="small muted mt-2 mb-0 center">
        Code expired? <Link to="/forgot-password">Start again</Link>
      </p>
    </AuthShell>
  );
}
