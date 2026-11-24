import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import express from 'express';
import { User, ROLES } from '../models/User.js';
import { EmailVerification } from '../models/EmailVerification.js';
import { issueToken, requireAuth } from '../middleware/auth.js';
import { asyncRoute, badRequest, conflict, HttpError } from '../middleware/errors.js';
import { sendVerificationCode } from '../services/mailer.js';

const router = express.Router();

const MIN_PASSWORD_LENGTH = 6;
const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_SENDS = 5;

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
