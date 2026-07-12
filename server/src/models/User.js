import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true, minlength: 1, maxlength: 40, match: /^[a-z]+$/ },
  passwordHash: { type: String, required: true, select: false },
  email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  phone: { type: String, unique: true, sparse: true, trim: true },
  verifiedEmail: { type: Boolean, default: false },
  verifiedPhone: { type: Boolean, default: false },
  gender: { type: String, enum: ['female', 'male', 'other', 'prefer-not-to-say'], default: 'prefer-not-to-say' },
  bio: { type: String, trim: true, maxlength: 500, default: '' },
  profileImageFileId: { type: mongoose.Schema.Types.ObjectId, default: null },
  followerCount: { type: Number, min: 0, default: 0 },
  followingCount: { type: Number, min: 0, default: 0 },
  typePreferences: {
    text: { type: Number, default: 0 },
    photo: { type: Number, default: 0 },
    video: { type: Number, default: 0 },
    'short-video': { type: Number, default: 0 }
  },
  lastSeenAt: { type: Date, default: Date.now }
}, { timestamps: true });

userSchema.index({ fullName: 'text', username: 'text' }, { weights: { username: 10, fullName: 5 } });

export const User = mongoose.model('User', userSchema);
