import mongoose from 'mongoose';

const followSchema = new mongoose.Schema({
  follower: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  followed: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }
}, { timestamps: true });

followSchema.index({ follower: 1, followed: 1 }, { unique: true });
followSchema.index({ followed: 1, createdAt: -1 });

export const Follow = mongoose.model('Follow', followSchema);

