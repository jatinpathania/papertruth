import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ROLES, User } from '../models/User.js';
import { HttpError } from './errors.js';

export function issueToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role, name: user.name },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

export async function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) throw new HttpError(401, 'Authentication required');
    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw new HttpError(401, 'Session expired or invalid — please sign in again');
    }
    const user = await User.findById(payload.sub);
    if (!user) throw new HttpError(401, 'Account no longer exists');
    req.user = user;
    req.auth = payload;
    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireRole(...roles) {
  return function roleGuard(req, res, next) {
    if (!req.user) return next(new HttpError(401, 'Authentication required'));
    if (!roles.includes(req.user.role)) {
      return next(new HttpError(403, 'This action is restricted to ' + roles.join('/').toLowerCase() + 's'));
    }
    return next();
  };
}

export const requireAdmin = [requireAuth, requireRole(ROLES.ADMIN)];

export async function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = verifyToken(token);
    const user = await User.findById(payload.sub);
    if (user) {
      req.user = user;
      req.auth = payload;
    }
  } catch {
  }
  return next();
}
