import mongoose from 'mongoose';

const mediaSchema = new mongoose.Schema({
  fileId: { type: mongoose.Schema.Types.ObjectId, required: true },
  filename: { type: String, required: true },
  contentType: { type: String, required: true },
  size: { type: Number, required: true },
  order: { type: Number, required: true },
  alt: { type: String, maxlength: 300, default: '' }
}, { _id: false });

const postSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['text', 'photo', 'video', 'short-video'], required: true, index: true },
  text: { type: String, trim: true, maxlength: 20_000, default: '' },
  nameIt: { type: String, trim: true, maxlength: 200, default: '' },
  detail: { type: String, trim: true, maxlength: 5_000, default: '' },
  links: [{ type: String, trim: true, maxlength: 2_000 }],
  media: { type: [mediaSchema], default: [] },
  hugCount: { type: Number, min: 0, default: 0 },
  throwCount: { type: Number, min: 0, default: 0 },
  viewCount: { type: Number, min: 0, default: 0 },
  deletedAt: { type: Date, default: null, index: true }
}, { timestamps: true });

postSchema.index({ createdAt: -1, _id: -1 });
postSchema.index({ type: 1, createdAt: -1 });
postSchema.index({ nameIt: 'text', detail: 'text', text: 'text', links: 'text' }, {
  weights: { nameIt: 10, text: 7, detail: 4, links: 2 }
});

export const Post = mongoose.model('Post', postSchema);

