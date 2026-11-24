import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// A pending registration. The account is not created until the code is proved, so
// the password hash waits here rather than in users — an unverified row is not an
// account and cannot be signed in to.
const emailVerificationSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    passwordHash: { type: String, required: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    sendCount: { type: Number, default: 1 },
    lastSentAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

// Mongo drops the row itself once it expires, so nothing has to sweep them.
emailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

emailVerificationSchema.methods.verifyCode = function verifyCode(plain) {
  return bcrypt.compare(`${plain}`, this.codeHash);
};

export const EmailVerification = mongoose.model('EmailVerification', emailVerificationSchema);
export default EmailVerification;
