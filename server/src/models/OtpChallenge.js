import mongoose from 'mongoose';

const otpChallengeSchema = new mongoose.Schema({
  channel: { type: String, enum: ['email', 'phone'], required: true },
  destination: { type: String, required: true, index: true },
  codeHash: { type: String, required: true, select: false },
  attempts: { type: Number, default: 0 },
  consumedAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true, expires: 0 }
}, { timestamps: true });

export const OtpChallenge = mongoose.model('OtpChallenge', otpChallengeSchema);
