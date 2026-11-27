import { useState } from 'react';
import { motion } from 'framer-motion';

// Shared by registration and by the password reset, so the rule a new password
// is held to — and the way it is shown — cannot drift between the two places a
// password is chosen.
export function passwordStrength(value) {
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

export const MIN_PASSWORD_LENGTH = 6;

export default function PasswordField({
  id = 'password',
  label = 'Password',
  value,
  onChange,
  autoComplete = 'new-password',
  placeholder = 'At least 6 characters',
  meter = true,
  required = true,
  note = null
}) {
  const [shown, setShown] = useState(false);
  const strength = passwordStrength(value);
  const level = value.length < MIN_PASSWORD_LENGTH ? STRENGTH[0] : STRENGTH[strength];
  const meterId = `${id}-strength`;

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="input-wrap">
        <span className="input-icon" aria-hidden="true">
          🔒
        </span>
        <input
          id={id}
          type={shown ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder={placeholder}
          minLength={MIN_PASSWORD_LENGTH}
          required={required}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={meter ? meterId : undefined}
        />
        <button
          type="button"
          className="input-action small subtle"
          onClick={() => setShown((v) => !v)}
          aria-pressed={shown}
          aria-label={shown ? 'Hide password' : 'Show password'}
        >
          {shown ? 'Hide' : 'Show'}
        </button>
      </div>

      {meter && (
        <div className="strength" id={meterId} aria-live="polite">
          <span className="strength-track">
            {[0, 1, 2, 3].map((step) => (
              <motion.span
                key={step}
                className="strength-seg"
                animate={{
                  backgroundColor:
                    value.length >= MIN_PASSWORD_LENGTH && step < strength
                      ? level.color
                      : 'rgba(255,255,255,0.08)',
                  scaleY: value.length >= MIN_PASSWORD_LENGTH && step < strength ? 1 : 0.7
                }}
                transition={{ duration: 0.3 }}
              />
            ))}
          </span>
          <span className="tiny" style={{ color: value ? level.color : 'var(--text-muted)' }}>
            {value ? level.label : `At least ${MIN_PASSWORD_LENGTH} characters`}
          </span>
        </div>
      )}

      {note}
    </div>
  );
}
