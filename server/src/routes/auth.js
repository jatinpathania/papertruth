import express from 'express';
import { User, ROLES } from '../models/User.js';
import { issueToken, requireAuth } from '../middleware/auth.js';
import { asyncRoute, badRequest, conflict, HttpError } from '../middleware/errors.js';

const router = express.Router();

const MIN_PASSWORD_LENGTH = 6;

router.post(
  '/register',
  asyncRoute(async (req, res) => {
    const { name, email, password, role } = req.body || {};
    if (!name || !email || !password) throw badRequest('Name, email and password are all required');
    if (`${password}`.length < MIN_PASSWORD_LENGTH) {
      throw badRequest(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    const normalisedEmail = `${email}`.toLowerCase().trim();
    if (await User.exists({ email: normalisedEmail })) {
      throw conflict('An account with that email already exists');
    }

    const user = new User({ name: `${name}`.trim(), email: normalisedEmail, role: ROLES.STUDENT });
    user.password = `${password}`;
    await user.save();

    if (role && role !== ROLES.STUDENT) {
      res.set('X-PaperTruth-Note', 'Role requests are ignored on self-registration');
    }

    res.status(201).json({ token: issueToken(user), user: user.toPublic() });
  })
);

router.post(
  '/login',
  asyncRoute(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) throw badRequest('Email and password are required');

    const user = await User.findOne({ email: `${email}`.toLowerCase().trim() });
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
