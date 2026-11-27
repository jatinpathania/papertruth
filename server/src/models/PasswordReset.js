import crypto from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// A password reset in flight. It carries two secrets, one after the other:
//
//   codeHash   the six digits mailed to the address, proving the person asking
//              can read that inbox;
//   tokenHash  issued once the code is proved, and spent by the reset itself.
//
// The second exists so the reset page never has to hold the code — the code is
// short enough to guess given enough tries, and the attempt counter it is
// guarded by is spent by the time the new password is typed.
const passwordResetSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },

    codeHash: { type: String, default: null },
    codeExpiresAt: { type: Date, default: null },
    attempts: { type: Number, default: 0 },
    sendCount: { type: Number, default: 1 },
    lastSentAt: { type: Date, default: Date.now },

    tokenHash: { type: String, default: null },
    tokenExpiresAt: { type: Date, default: null },

    // The TTL field — always the later of the two deadlines above, so Mongo
    // drops the row on its own and nothing has to sweep them.
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

passwordResetSchema.methods.verifyCode = function verifyCode(plain) {
  if (!this.codeHash) return Promise.resolve(false);
  return bcrypt.compare(`${plain}`, this.codeHash);
};

// The token is 256 bits of randomness, so a single SHA-256 is enough — bcrypt
// buys nothing against a secret that cannot be guessed, and the comparison is
// done in constant time either way.
export const hashToken = (plain) =>
  crypto.createHash('sha256').update(`${plain}`).digest('hex');

passwordResetSchema.methods.verifyToken = function verifyToken(plain) {
  if (!this.tokenHash || !this.tokenExpiresAt) return false;
  if (this.tokenExpiresAt.getTime() < Date.now()) return false;
  const given = Buffer.from(hashToken(plain));
  const held = Buffer.from(this.tokenHash);
  return given.length === held.length && crypto.timingSafeEqual(given, held);
};

export const PasswordReset = mongoose.model('PasswordReset', passwordResetSchema);
export default PasswordReset;
