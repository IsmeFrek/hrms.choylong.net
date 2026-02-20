import mongoose from 'mongoose';

const otpChallengeSchema = new mongoose.Schema({
  staffId: { type: String, required: true, index: true },
  hrId: { type: mongoose.Schema.Types.ObjectId, ref: 'HR', required: true },
  code: { type: String, required: true }, // For production, store hashed
  expiresAt: { type: Date, required: true, index: true },
  attempts: { type: Number, default: 0 },
  used: { type: Boolean, default: false, index: true },
}, { timestamps: true });

// TTL index (expires after a while)
otpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('OtpChallenge', otpChallengeSchema);
