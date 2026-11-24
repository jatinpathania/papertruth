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

/**
 * Returns { delivered, code } — `code` is only ever populated when SMTP is not
 * configured AND we are not in production, so a developer can finish the flow
 * without a mail server. In production an unconfigured mailer is a hard error
 * rather than a silent bypass.
 */
export async function sendVerificationCode({ to, name, code }) {
  if (!mailerConfigured) {
    if (isProduction) {
      throw new Error('Email verification is not configured on this server');
    }
    console.warn(`[mail] SMTP not configured — verification code for ${to} is ${code}`);
    return { delivered: false, code };
  }

  await getTransport().sendMail({
    from: env.mailFrom,
    to,
    subject: `${code} is your PaperTruth verification code`,
    text:
      `Hi ${name},\n\n` +
      `Your PaperTruth verification code is ${code}.\n` +
      `It expires in 10 minutes. If you did not request it, ignore this email.\n`,
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0b1220">
        <p style="margin:0 0 4px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#64748b">PaperTruth</p>
        <h1 style="margin:0 0 16px;font-size:22px;line-height:1.25">Confirm your email</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6">
          Hi ${escapeHtml(name)}, use this code to finish creating your account.
        </p>
        <p style="margin:0 0 24px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:.3em;color:#0f172a">
          ${code}
        </p>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b">
          The code expires in 10 minutes. If you did not request it, you can ignore this email.
        </p>
      </div>
    `
  });

  return { delivered: true, code: null };
}

function escapeHtml(value) {
  return `${value}`.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

export default sendVerificationCode;
