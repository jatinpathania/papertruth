import crypto from 'node:crypto';
import { env } from '../config/env.js';

export function respondentIdFor(userId, examId, secret = env.jwtSecret) {
  return crypto
    .createHmac('sha256', secret || 'papertruth')
    .update(`${userId}:${examId}`)
    .digest('hex')
    .slice(0, 16);
}

export function respondentLabel(respondentId) {
  const id = `${respondentId}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `R-${hash.toString(16).padStart(8, '0').slice(0, 6)}`;
}

export default respondentIdFor;
