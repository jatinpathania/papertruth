import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

const LENGTH = 6;

// Shared by registration and by the forgotten-password flow — the two differ
// only in the kicker and the label on the confirm button.
export default function OtpDialog({
  open,
  email,
  resendAfterSeconds = 60,
  devCode = null,
  kicker = 'Step 2 of 2',
  submitLabel = 'Verify and create account',
  onVerify,
  onResend,
  onClose
}) {
  const [digits, setDigits] = useState(() => Array(LENGTH).fill(''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);
  const [cooldown, setCooldown] = useState(resendAfterSeconds);
  const inputs = useRef([]);
  const dialogRef = useRef(null);

  const code = digits.join('');

  const reset = useCallback(() => {
    setDigits(Array(LENGTH).fill(''));
    setError(null);
    setNote(null);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    reset();
    setCooldown(resendAfterSeconds);
    const focus = requestAnimationFrame(() => inputs.current[0]?.focus());
    return () => cancelAnimationFrame(focus);
  }, [open, resendAfterSeconds, reset]);

  useEffect(() => {
    if (!open || cooldown <= 0) return undefined;
    const timer = setInterval(() => setCooldown((value) => (value <= 1 ? 0 : value - 1)), 1000);
    return () => clearInterval(timer);
  }, [open, cooldown]);

  // The page behind must not scroll while a modal owns the screen.
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const submit = useCallback(
    async (value) => {
      if (value.length !== LENGTH || busy) return;
      setBusy(true);
      setError(null);
      setNote(null);
      try {
        await onVerify(value);
      } catch (caught) {
        setError(caught.message || 'Could not verify that code');
        setDigits(Array(LENGTH).fill(''));
        inputs.current[0]?.focus();
      } finally {
        setBusy(false);
      }
    },
    [busy, onVerify]
  );

  const place = (index, value) => {
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    setError(null);
    if (value && index < LENGTH - 1) inputs.current[index + 1]?.focus();
    const joined = next.join('');
    if (joined.length === LENGTH && !next.includes('')) submit(joined);
  };

  const onChange = (index) => (event) => {
    const typed = event.target.value.replace(/\D/g, '');
    if (!typed) return place(index, '');
    if (typed.length > 1) return paste(typed, index);
    place(index, typed.slice(-1));
  };

  const paste = (text, from = 0) => {
    const chars = text.replace(/\D/g, '').slice(0, LENGTH - from).split('');
    if (!chars.length) return;
    const next = [...digits];
    chars.forEach((char, offset) => {
      next[from + offset] = char;
    });
    setDigits(next);
    setError(null);
    const landed = Math.min(from + chars.length, LENGTH - 1);
    inputs.current[landed]?.focus();
    if (!next.includes('')) submit(next.join(''));
  };

  const onKeyDown = (index) => (event) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      event.preventDefault();
      place(index - 1, '');
      inputs.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowLeft' && index > 0) inputs.current[index - 1]?.focus();
    if (event.key === 'ArrowRight' && index < LENGTH - 1) inputs.current[index + 1]?.focus();
  };

  const resend = async () => {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const result = await onResend();
      setDigits(Array(LENGTH).fill(''));
      setCooldown(result?.resendAfterSeconds ?? resendAfterSeconds);
      setNote('A new code is on its way.');
      inputs.current[0]?.focus();
    } catch (caught) {
      setError(caught.message || 'Could not send another code');
    } finally {
      setBusy(false);
    }
  };

  // Focus trap: a modal that lets Tab wander behind it is not a modal.
  const onDialogKeyDown = (event) => {
    if (event.key === 'Escape') return onClose?.();
    if (event.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), a[href]'
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="otp-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'linear' }}
          onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}
        >
          <motion.div
            ref={dialogRef}
            className="otp-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="otp-title"
            onKeyDown={onDialogKeyDown}
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <button type="button" className="otp-close no-ripple" onClick={onClose} aria-label="Cancel">
              ✕
            </button>

            <span className="section-kicker">{kicker}</span>
            <h2 id="otp-title" className="otp-title">Check your email</h2>
            <p className="otp-lede">
              We sent a six-digit code to <strong>{email}</strong>. It expires in 10 minutes.
            </p>

            {devCode && (
              <p className="notice warn otp-devcode">
                <strong>No mail server configured.</strong> Development code:{' '}
                <code>{devCode}</code>
              </p>
            )}

            <div
              className="otp-inputs"
              onPaste={(event) => {
                event.preventDefault();
                paste(event.clipboardData.getData('text'));
              }}
            >
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(node) => {
                    inputs.current[index] = node;
                  }}
                  className={`otp-input${error ? ' invalid' : ''}`}
                  type="text"
                  inputMode="numeric"
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  maxLength={1}
                  value={digit}
                  disabled={busy}
                  aria-label={`Digit ${index + 1} of ${LENGTH}`}
                  onChange={onChange(index)}
                  onKeyDown={onKeyDown(index)}
                  onFocus={(event) => event.target.select()}
                />
              ))}
            </div>

            <div className="otp-status" aria-live="polite">
              {error && <span className="otp-error">{error}</span>}
              {!error && note && <span className="otp-note">{note}</span>}
            </div>

            <button
              type="button"
              className="btn primary lg block"
              disabled={busy || code.length !== LENGTH}
              onClick={() => submit(code)}
            >
              {busy ? <span className="spinner" /> : null}
              {busy ? 'Verifying…' : submitLabel}
            </button>

            <div className="otp-footer">
              <button
                type="button"
                className="link-button no-ripple"
                disabled={busy || cooldown > 0}
                onClick={resend}
              >
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
              </button>
              <button type="button" className="link-button no-ripple" onClick={onClose}>
                Use a different email
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
