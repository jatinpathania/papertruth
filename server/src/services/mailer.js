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

// Tables and inline styles only: Outlook renders through Word, which has no
// flexbox, no grid and no external stylesheets. Everything degrades to a
// single centred column if the radii and borders are dropped.
function buildHtml({ name, code }) {
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
<title>Your PaperTruth verification code</title>
</head>
<body style="margin:0;padding:0;background:#05070c;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${code} is your PaperTruth verification code. It expires in 10 minutes.</div>
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
              &#8212;&#8212; Verify your email
            </p>
            <h1 style="margin:0 0 12px;font-size:25px;line-height:1.2;font-weight:700;color:#eef4fb">
              One code and you're in
            </h1>
            <p style="margin:0;font-size:15px;line-height:1.6;color:#9aabc7">
              Hi ${escapeHtml(name)}, enter this code in the window you left open to finish creating your account.
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
              Didn't try to sign up? Ignore this email &#8212; no account is created until the code is entered.
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
export async function sendVerificationCode({ to, name, code }) {
  if (!mailerConfigured) {
    if (isProduction) {
      throw new Error('Email verification is not configured on this server');
    }
    console.warn(`[mail] SMTP not configured — verification code for ${to} is ${code}`);
    return { delivered: false, code };
  }

  await getTransport().sendMail({
    // Always the authenticated account. A From on a domain the account does not
    // own is relayed with a 250 OK and then treated as spoofed further down the
    // chain, which from here looks exactly like nothing was ever sent.
    from: `PaperTruth <${env.smtpUser}>`,
    to,
    subject: `${code} is your PaperTruth verification code`,
    text:
      `Hi ${name},\n\n` +
      `Your PaperTruth verification code is ${code}\n\n` +
      `Enter it in the window you left open to finish creating your account.\n` +
      `It expires in 10 minutes.\n\n` +
      `Didn't try to sign up? Ignore this email — no account is created until the code is entered.\n`,
    html: buildHtml({ name, code })
  });

  return { delivered: true, code: null };
}

export default sendVerificationCode;
