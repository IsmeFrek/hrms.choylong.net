import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    // new: allow username-based logins (sparse => either email or username can be used)
    username: { type: String, unique: true, lowercase: true, trim: true, sparse: true },
  // keep email support (optional now — phone can be used instead)
  email: { type: String, lowercase: true, trim: true },

    // NEW: canonical email used for uniqueness and queries
    emailCanonical: { type: String, lowercase: true, trim: true, index: true },

    // display names (support existing "name" docs; keep fullName for new writes)
    fullName: { type: String, trim: true, required: true },
    name: { type: String, trim: true }, // legacy field from existing collection

    // secure password hash
    passwordHash: { type: String, required: true },

    // legacy single-role string and new role refs (either can be used)
    role: { type: String, trim: true }, // e.g., "Admin"
    roles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Role' }],

    active: { type: Boolean, default: true },

    // legacy plain password field (present in existing docs); will be migrated on first login
    password: { type: String },
    // phone number (optional)
    phone: { type: String, trim: true },

    // Password reset token and expiration
    resetToken: { type: String },
    resetTokenExpire: { type: Date },

    // Optional Telegram chat id or username for notifications
    telegramId: { type: String, trim: true },

    // Telegram Chat IDs for different bots (numeric IDs only)
    telegramChatId: { type: String, trim: true },   // For Bot 1: @Chantha_hospital_bot
    telegramChatId2: { type: String, trim: true },  // For Bot 2: @frek_automatebot

    // department assignment (for leadership users to filter their team's HR records)
    department: { type: String, trim: true },
  },
  { timestamps: true }
);

// keep indexes sparse to allow missing username or email
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ username: 1 }, { unique: true, sparse: true });
// index phone for quick lookup/search (sparse to allow missing)
userSchema.index({ phone: 1 }, { sparse: true });

// Unique index on canonical email (only when present)
userSchema.index(
  { emailCanonical: 1 },
  { unique: true, partialFilterExpression: { emailCanonical: { $type: 'string' } } }
);

// normalize names between "name" and "fullName"
userSchema.pre('validate', function normalizeNames(next) {
  if (!this.fullName && this.name) this.fullName = this.name;
  if (!this.name && this.fullName) this.name = this.fullName;
  next();
});

// Ensure emailCanonical is set from email
userSchema.pre('validate', function setCanonical(next) {
  if (this.email) {
    this.emailCanonical = String(this.email).trim().toLowerCase();
  }
  next();
});

// hash setter
userSchema.methods.setPassword = async function setPassword(password) {
  this.passwordHash = await bcrypt.hash(password, 10);
};

// validate password, with legacy migration support
userSchema.methods.validatePassword = async function validatePassword(password) {
  // migrate legacy plain password if present and no hash yet
  if (!this.passwordHash && this.password) {
    const ok = password === this.password;
    if (ok) {
      await this.setPassword(this.password);
      this.password = undefined;
      await this.save();
      return true;
    }
  }
  return bcrypt.compare(password, this.passwordHash || '');
};

// hide sensitive fields in JSON
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.password;
    return ret;
  },
});

export default mongoose.model('User', userSchema);
