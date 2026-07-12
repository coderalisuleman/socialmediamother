import mongoose from 'mongoose';

const reactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
  kind: { type: String, enum: ['hug', 'throw'], required: true }
}, { timestamps: true });

reactionSchema.index({ user: 1, post: 1 }, { unique: true });
reactionSchema.index({ user: 1, updatedAt: -1 });

export const Reaction = mongoose.model('Reaction', reactionSchema);

