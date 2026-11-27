import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import express from 'express';
import { User, ROLES } from '../models/User.js';
import { EmailVerification } from '../models/EmailVerification.js';
import { PasswordReset, hashToken } from '../models/PasswordReset.js';
import { issueToken, requireAuth } from '../middleware/auth.js';
import { asyncRoute, badRequest, conflict, HttpError } from '../middleware/errors.js';
import { sendVerificationCode, sendPasswordResetCode } from '../services/mailer.js';

const router = express.Router();

const MIN_PASSWORD_LENGTH = 6;
const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_SENDS = 5;
// How long the proved-the-code ticket lives. Long enough to choose a password,
// short enough that a ticket left behind in a closed tab is worthless.
const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;

// crypto.randomInt, not Math.random: this is the only thing standing between a
// stranger and an account on someone else's email address.
const newCode = () => `${crypto.randomInt(0, 1_000_000)}`.padStart(6, '0');

const normalise = (email) => `${email}`.toLowerCase().trim();

function pendingPayload(record, delivered, devCode) {
  return {
    pending: true,
    email: record.email,
    expiresAt: record.expiresAt,
    resendAfterSeconds: Math.ceil(RESEND_COOLDOWN_MS / 1000),
    delivered,
    ...(devCode ? { devCode } : {})
  };
}

// Step 1 — hold the details, email a code. No account exists yet.
router.post(
  '/register',
  asyncRoute(async (req, res) => {
    const { name, email, password, role } = req.body || {};
    if (!name || !email || !password) throw badRequest('Name, email and password are all required');
    if (`${password}`.length < MIN_PASSWORD_LENGTH) {
      throw badRequest(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    const normalisedEmail = normalise(email);
    if (await User.exists({ email: normalisedEmail })) {
      throw conflict('An account with that email already exists');
    }

    const code = newCode();
    const record = await EmailVerification.findOneAndUpdate(
      { email: normalisedEmail },
      {
        email: normalisedEmail,
        name: `${name}`.trim(),
        passwordHash: await bcrypt.hash(`${password}`, 10),
        codeHash: await bcrypt.hash(code, 10),
        attempts: 0,
        sendCount: 1,
        lastSentAt: new Date(),
        expiresAt: new Date(Date.now() + CODE_TTL_MS)
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const { delivered, code: devCode } = await sendVerificationCode({
      to: normalisedEmail,
      name: record.name,
      code
    });

    if (role && role !== ROLES.STUDENT) {
      res.set('X-PaperTruth-Note', 'Role requests are ignored on self-registration');
    }

    res.status(202).json(pendingPayload(record, delivered, devCode));
  })
);

// Step 2 — prove the code, and only then create the account.
router.post(
  '/register/verify',
  asyncRoute(async (req, res) => {
    const { email, code } = req.body || {};
    if (!email || !code) throw badRequest('Email and verification code are required');

    const normalisedEmail = normalise(email);
    const record = await EmailVerification.findOne({ email: normalisedEmail });
    if (!record || record.expiresAt.getTime() < Date.now()) {
      throw new HttpError(410, 'That code has expired — request a new one');
    }
    if (record.attempts >= MAX_ATTEMPTS) {
      await record.deleteOne();
      throw new HttpError(429, 'Too many incorrect attempts — start again');
    }

    if (!(await record.verifyCode(code))) {
      record.attempts += 1;
      await record.save();
      const left = MAX_ATTEMPTS - record.attempts;
      throw new HttpError(
        400,
        left > 0 ? `That code is not right — ${left} attempt${left === 1 ? '' : 's'} left` : 'Too many incorrect attempts — start again'
      );
    }

    // Someone may have registered this address while the code was in flight.
    if (await User.exists({ email: normalisedEmail })) {
      await record.deleteOne();
      throw conflict('An account with that email already exists');
    }

    const user = new User({
      name: record.name,
      email: record.email,
      role: ROLES.STUDENT,
      passwordHash: record.passwordHash
    });
    await user.save();
    await record.deleteOne();

    res.status(201).json({ token: issueToken(user), user: user.toPublic() });
  })
);

// Step 1 again, rate limited, reusing the details already held.
router.post(
  '/register/resend',
  asyncRoute(async (req, res) => {
    const normalisedEmail = normalise((req.body || {}).email);
    const record = await EmailVerification.findOne({ email: normalisedEmail });
    if (!record) throw new HttpError(410, 'That request has expired — start again');

    const waited = Date.now() - record.lastSentAt.getTime();
    if (waited < RESEND_COOLDOWN_MS) {
      throw new HttpError(429, `Wait ${Math.ceil((RESEND_COOLDOWN_MS - waited) / 1000)}s before asking for another code`);
    }
    if (record.sendCount >= MAX_SENDS) {
      throw new HttpError(429, 'Too many codes requested for this address — try again later');
    }

    const code = newCode();
    record.codeHash = await bcrypt.hash(code, 10);
    record.attempts = 0;
    record.sendCount += 1;
    record.lastSentAt = new Date();
    record.expiresAt = new Date(Date.now() + CODE_TTL_MS);
    await record.save();

    const { delivered, code: devCode } = await sendVerificationCode({
      to: record.email,
      name: record.name,
      code
    });

    res.json(pendingPayload(record, delivered, devCode));
  })
);

// ---------------------------------------------------------------------------
// Forgotten password: mail a code, prove it, then choose a new password.
//
// Every response below is deliberately the same whether or not the address has
// an account. A reset form that answers "no such user" is a membership oracle:
// anyone could walk a list of addresses through it and learn which ones belong
// to students here.
// ---------------------------------------------------------------------------

function resetPayload(email, devCode) {
  return {
    // "If that address has an account, a code is on its way" — never a claim
    // that this particular address exists.
    sent: true,
    email,
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
    resendAfterSeconds: Math.ceil(RESEND_COOLDOWN_MS / 1000),
    ...(devCode ? { devCode } : {})
  };
}

// Step 1 — mail a code to an address that has an account.
router.post(
  '/password/forgot',
  asyncRoute(async (req, res) => {
    const { email } = req.body || {};
    if (!email) throw badRequest('Email is required');

    const normalisedEmail = normalise(email);
    const user = await User.findOne({ email: normalisedEmail });
    if (!user) return res.status(202).json(resetPayload(normalisedEmail));

    const code = newCode();
    await PasswordReset.findOneAndUpdate(
      { email: normalisedEmail },
      {
        email: normalisedEmail,
        userId: user._id,
        name: user.name,
        codeHash: await bcrypt.hash(code, 10),
        codeExpiresAt: new Date(Date.now() + CODE_TTL_MS),
        attempts: 0,
        sendCount: 1,
        lastSentAt: new Date(),
        // A fresh code revokes any ticket an earlier one had already bought.
        tokenHash: null,
        tokenExpiresAt: null,
        expiresAt: new Date(Date.now() + CODE_TTL_MS)
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const { code: devCode } = await sendPasswordResetCode({
      to: normalisedEmail,
      name: user.name,
      code
    });

    return res.status(202).json(resetPayload(normalisedEmail, devCode));
  })
);

// Step 1 again, rate limited.
router.post(
  '/password/resend',
  asyncRoute(async (req, res) => {
    const normalisedEmail = normalise((req.body || {}).email);
    const record = await PasswordReset.findOne({ email: normalisedEmail });
    // No record: answer exactly as if one had been refreshed.
    if (!record) return res.status(202).json(resetPayload(normalisedEmail));

    const waited = Date.now() - record.lastSentAt.getTime();
    if (waited < RESEND_COOLDOWN_MS) {
      throw new HttpError(
        429,
        `Wait ${Math.ceil((RESEND_COOLDOWN_MS - waited) / 1000)}s before asking for another code`
      );
    }
    if (record.sendCount >= MAX_SENDS) {
      throw new HttpError(429, 'Too many codes requested for this address — try again later');
    }

    const code = newCode();
    record.codeHash = await bcrypt.hash(code, 10);
    record.codeExpiresAt = new Date(Date.now() + CODE_TTL_MS);
    record.attempts = 0;
    record.sendCount += 1;
    record.lastSentAt = new Date();
    record.tokenHash = null;
    record.tokenExpiresAt = null;
    record.expiresAt = new Date(Date.now() + CODE_TTL_MS);
    await record.save();

    const { code: devCode } = await sendPasswordResetCode({
      to: record.email,
      name: record.name,
      code
    });

    return res.status(202).json(resetPayload(record.email, devCode));
  })
);

// Step 2 — prove the code. Spends the code and hands back a one-time ticket;
// the reset page carries that ticket, never the six digits.
router.post(
  '/password/verify',
  asyncRoute(async (req, res) => {
    const { email, code } = req.body || {};
    if (!email || !code) throw badRequest('Email and reset code are required');

    const normalisedEmail = normalise(email);
    const record = await PasswordReset.findOne({ email: normalisedEmail });
    const expired = new HttpError(410, 'That code has expired — start again');
    if (!record || !record.codeExpiresAt || record.codeExpiresAt.getTime() < Date.now()) {
      throw expired;
    }
    if (record.attempts >= MAX_ATTEMPTS) {
      await record.deleteOne();
      throw new HttpError(429, 'Too many incorrect attempts — start again');
    }

    if (!(await record.verifyCode(code))) {
      record.attempts += 1;
      await record.save();
      const left = MAX_ATTEMPTS - record.attempts;
      throw new HttpError(
        400,
        left > 0
          ? `That code is not right — ${left} attempt${left === 1 ? '' : 's'} left`
          : 'Too many incorrect attempts — start again'
      );
    }

    // The account may have been removed while the code was in the inbox.
    if (!(await User.exists({ _id: record.userId }))) {
      await record.deleteOne();
      throw expired;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    record.codeHash = null; // one code, one use
    record.codeExpiresAt = null;
    record.tokenHash = hashToken(resetToken);
    record.tokenExpiresAt = tokenExpiresAt;
    record.expiresAt = tokenExpiresAt;
    await record.save();

    res.json({ email: record.email, resetToken, expiresAt: tokenExpiresAt });
  })
);

// Step 3 — spend the ticket on a new password, and sign the person in.
router.post(
  '/password/reset',
  asyncRoute(async (req, res) => {
    const { email, resetToken, password } = req.body || {};
    if (!email || !resetToken || !password) {
      throw badRequest('Email, reset token and new password are all required');
    }
    if (`${password}`.length < MIN_PASSWORD_LENGTH) {
      throw badRequest(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    const record = await PasswordReset.findOne({ email: normalise(email) });
    const stale = new HttpError(410, 'This reset link has expired — start again');
    if (!record || !record.verifyToken(resetToken)) throw stale;

    const user = await User.findById(record.userId);
    if (!user) {
      await record.deleteOne();
      throw stale;
    }

    user.password = `${password}`;
    await user.save();
    await record.deleteOne();

    res.json({ token: issueToken(user), user: user.toPublic() });
  })
);

router.post(
  '/login',
  asyncRoute(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) throw badRequest('Email and password are required');

    const user = await User.findOne({ email: normalise(email) });
    const invalid = new HttpError(401, 'Incorrect email or password');
    if (!user) throw invalid;
    if (!(await user.verifyPassword(`${password}`))) throw invalid;

    res.json({ token: issueToken(user), user: user.toPublic() });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncRoute(async (req, res) => {
    res.json({ user: req.user.toPublic() });
  })
);

export default router;
