import express from 'express';
import { asyncHandler } from '../utils/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { publicPost } from '../services/serializers.js';
import { publishPostFiles } from '../services/postPublisher.js';
import {
  assembleUploadSession, cancelUploadSession, createUploadSession, storeUploadChunk, UPLOAD_CHUNK_BYTES
} from '../services/uploadSessions.js';

export const uploadsRouter = express.Router();

uploadsRouter.post('/sessions', requireAuth, asyncHandler(async (req, res) => {
  const session = await createUploadSession(req.user.id, req.body?.files);
  res.status(201).json({ session });
}));

uploadsRouter.put(
  '/sessions/:sessionId/files/:fileIndex/chunks/:chunkIndex',
  requireAuth,
  express.raw({ type: 'application/octet-stream', limit: UPLOAD_CHUNK_BYTES + 1024 }),
  asyncHandler(async (req, res) => {
    const progress = await storeUploadChunk({
      sessionId: req.params.sessionId,
      ownerId: req.user.id,
      fileIndex: Number(req.params.fileIndex),
      chunkIndex: Number(req.params.chunkIndex),
      data: req.body,
    });
    res.json(progress);
  })
);

uploadsRouter.post('/sessions/:sessionId/complete', requireAuth, asyncHandler(async (req, res) => {
  const files = await assembleUploadSession(req.params.sessionId, req.user.id);
  const post = await publishPostFiles({ files, body: req.body || {}, userId: req.user.id });
  res.status(201).json({ post: publicPost(post) });
}));

uploadsRouter.delete('/sessions/:sessionId', requireAuth, asyncHandler(async (req, res) => {
  await cancelUploadSession(req.params.sessionId, req.user.id);
  res.status(204).end();
}));
