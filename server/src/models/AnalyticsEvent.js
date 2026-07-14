import mongoose from 'mongoose';

const analyticsEventSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true, maxlength: 100 },
  userId: { type: String, default: null, index: true, maxlength: 100 },
  eventType: { type: String, required: true, index: true, maxlength: 80 },
  path: { type: String, default: '/', index: true, maxlength: 300 },
  targetType: { type: String, default: '', maxlength: 60 },
  targetId: { type: String, default: '', index: true, maxlength: 160 },
  postId: { type: String, default: '', index: true, maxlength: 160 },
  postAuthorId: { type: String, default: '', index: true, maxlength: 100 },
  durationMs: { type: Number, min: 0, max: 86_400_000, default: 0 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  occurredAt: { type: Date, required: true, index: true },
}, { timestamps: true, versionKey: false });

analyticsEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });
analyticsEventSchema.index({ postAuthorId: 1, occurredAt: -1 });
analyticsEventSchema.index({ sessionId: 1, occurredAt: 1 });

export const AnalyticsEvent = mongoose.model('AnalyticsEvent', analyticsEventSchema);
