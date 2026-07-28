import mongoose from 'mongoose';

const uploadPartSchema = new mongoose.Schema({
  index: { type: Number, required: true, min: 0 },
  fileId: { type: mongoose.Schema.Types.ObjectId, required: true },
}, { _id: false });

const uploadFileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  size: { type: Number, required: true, min: 1 },
  totalChunks: { type: Number, required: true, min: 1 },
  parts: { type: [uploadPartSchema], default: [] },
}, { _id: false });

const uploadSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  files: { type: [uploadFileSchema], required: true },
  totalBytes: { type: Number, required: true, min: 1 },
  expiresAt: { type: Date, required: true, index: true },
}, { timestamps: true });

export const UploadSession = mongoose.model('UploadSession', uploadSessionSchema);
