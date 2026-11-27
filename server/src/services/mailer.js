import nodemailer from 'nodemailer';
import { env, isProduction } from '../config/env.js';

let transport = null;

export const mailerConfigured = Boolean(env.smtpHost && env.smtpUser && env.smtpPass);

function getTransport() {
  if (transport) return transport;
  transport = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: { user: env.smtpUser, pass: env.smtpPass }
  });
  return transport;
}

function escapeHtml(value) {
  return `${value}`.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

// The two code emails differ only in their words. Everything structural — the
// shell, the digit boxes, the footer — is shared, so a change to the design
// cannot drift between them.
const COPY = {
  verify: {
    subject: (code) => `${code} is your PaperTruth verification code`,
    preheader: (code) => `${code} is your PaperTruth verification code. It expires in 10 minutes.`,
    documentTitle: 'Your PaperTruth verification code',
    kicker: 'Verify your email',
    heading: "One code and you're in",
    intro: (name) =>
      `Hi ${name}, enter this code in the window you left open to finish creating your account.`,
    disclaimer:
      "Didn't try to sign up? Ignore this email &#8212; no account is created until the code is entered.",
    text: ({ name, code }) =>
      `Hi ${name},\n\n` +
      `Your PaperTruth verification code is ${code}\n\n` +
      `Enter it in the window you left open to finish creating your account.\n` +
      `It expires in 10 minutes.\n\n` +
      `Didn't try to sign up? Ignore this email — no account is created until the code is entered.\n`
  },
  reset: {
    subject: (code) => `${code} is your PaperTruth password reset code`,
    preheader: (code) => `${code} is your PaperTruth password reset code. It expires in 10 minutes.`,
    documentTitle: 'Your PaperTruth password reset code',
    kicker: 'Reset your password',
    heading: 'Set a new password',
    intro: (name) =>
      `Hi ${name}, enter this code in the window you left open and you can choose a new password.`,
    disclaimer:
      "Didn't ask to reset it? Ignore this email &#8212; your current password still works and nothing has changed.",
    text: ({ name, code }) =>
      `Hi ${name},\n\n` +
      `Your PaperTruth password reset code is ${code}\n\n` +
      `Enter it in the window you left open and you can choose a new password.\n` +
      `It expires in 10 minutes.\n\n` +
      `Didn't ask to reset it? Ignore this email — your current password still works and nothing has changed.\n`
  }
};

// Tables and inline styles only: Outlook renders through Word, which has no
// flexbox, no grid and no external stylesheets. Everything degrades to a
// single centred column if the radii and borders are dropped.
function buildHtml({ name, code, copy }) {
  const digits = `${code}`
    .split('')
    .map(
      (d) =>
        `<td style="padding:0 3px"><div style="width:40px;height:52px;line-height:52px;background:#0a0f18;border:1px solid #243247;border-radius:3px;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:26px;font-weight:700;color:#7cf3ff;text-align:center">${d}</div></td>`
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>${copy.documentTitle}</title>
</head>
<body style="margin:0;padding:0;background:#05070c;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${copy.preheader(code)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#05070c;padding:32px 16px">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#0c111a;border:1px solid #1d2838;border-radius:4px">

        <tr>
          <td style="padding:26px 32px 22px;border-bottom:1px solid #1d2838">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding-right:10px">
                  <div style="width:28px;height:28px;line-height:28px;background:#22e2f5;border-radius:6px;color:#03121a;font-size:15px;font-weight:700;text-align:center">&#10003;</div>
                </td>
                <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:17px;font-weight:700;letter-spacing:.04em;color:#eef4fb">
                  Paper<span style="color:#22e2f5">Truth</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 32px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
            <p style="margin:0 0 14px;font-family:'SFMono-Regular',Consolas,Menlo,monospace;font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#22e2f5">
              &#8212;&#8212; ${copy.kicker}
            </p>
            <h1 style="margin:0 0 12px;font-size:25px;line-height:1.2;font-weight:700;color:#eef4fb">
              ${copy.heading}
            </h1>
            <p style="margin:0;font-size:15px;line-height:1.6;color:#9aabc7">
              ${copy.intro(escapeHtml(name))}
            </p>
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:26px 12px 10px">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${digits}</tr></table>
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:0 32px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
            <p style="margin:0;font-size:13px;color:#7f8ea8">Expires in 10 minutes</p>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 32px 26px;border-top:1px solid #1d2838;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
            <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#7f8ea8">
              ${copy.disclaimer}
            </p>
            <p style="margin:0;font-size:12px;line-height:1.6;color:#5c6b85">
              PaperTruth builds answer keys from what a whole cohort remembers. Your answers are
              linked to an anonymous ID, never your name.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/**
 * Returns { delivered, code } — `code` is only ever populated when SMTP is not
 * configured AND we are not in production, so a developer can finish the flow
 * without a mail server. In production an unconfigured mailer is a hard error
 * rather than a silent bypass.
 */
async function sendCode({ to, name, code, kind }) {
  const copy = COPY[kind];

  if (!mailerConfigured) {
    if (isProduction) {
      throw new Error('Email delivery is not configured on this server');
    }
    console.warn(`[mail] SMTP not configured — ${kind} code for ${to} is ${code}`);
    return { delivered: false, code };
  }

  await getTransport().sendMail({
    // Always the authenticated account. A From on a domain the account does not
    // own is relayed with a 250 OK and then treated as spoofed further down the
    // chain, which from here looks exactly like nothing was ever sent.
    from: `PaperTruth <${env.smtpUser}>`,
    to,
    subject: copy.subject(code),
    text: copy.text({ name, code }),
    html: buildHtml({ name, code, copy })
  });

  return { delivered: true, code: null };
}

export const sendVerificationCode = ({ to, name, code }) =>
  sendCode({ to, name, code, kind: 'verify' });

export const sendPasswordResetCode = ({ to, name, code }) =>
  sendCode({ to, name, code, kind: 'reset' });

export default sendVerificationCode;
