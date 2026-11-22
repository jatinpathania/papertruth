import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export const ROLES = { STUDENT: 'STUDENT', ADMIN: 'ADMIN' };

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address']
    },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.STUDENT }
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

userSchema.virtual('password').set(function setPassword(plain) {
  this._plainPassword = plain;
});

userSchema.pre('validate', async function hashPassword(next) {
  if (!this._plainPassword) return next();
  this.passwordHash = await bcrypt.hash(this._plainPassword, 10);
  this._plainPassword = undefined;
  return next();
});

userSchema.methods.verifyPassword = function verifyPassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.toPublic = function toPublic() {
  return { id: this._id.toString(), name: this.name, email: this.email, role: this.role };
};

export const User = mongoose.model('User', userSchema);
export default User;
