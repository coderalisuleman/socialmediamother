import express from 'express';
import { promises as fsPromises } from 'node:fs';
import { asyncHandler, AppError, assert } from '../utils/errors.js';
import { cleanLinks } from '../utils/normalize.js';
import { inChunks } from '../utils/cursor.js';
import {
  createComment, createPost, deleteComment, getPostById, isFollowing, listComments,
  reactionForPosts, recordView, setReaction, softDeletePost, updateComment
} from '../services/store.js';
import { publicComment, publicPost } from '../services/serializers.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { removeFiles, saveUploadedFile } from '../services/files.js';
import { config } from '../config.js';
import { hasValidMediaSignature } from '../utils/media.js';

export const postsRouter = express.Router();

const validTypes = ['text', 'photo', 'video', 'short-video'];
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']);
const allowedVideoTypes = new Set(['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-matroska']);

const cleanupTemp = async (files = []) => {
  await Promise.allSettled(files.map((file) => fsPromises.rm(file.path, { force: true })));
};

postsRouter.post('/', requireAuth, upload.array('files', config.maxFilesPerPost), asyncHandler(async (req, res) => {
  const files = req.files || [];
  const type = req.body?.type;
  try {
    const aggregateBytes = files.reduce((total, file) => total + Number(file.size || 0), 0);
    assert(aggregateBytes <= config.maxUploadBytes, 413,
      `A post can contain at most ${Math.floor(config.maxUploadBytes / 1024 / 1024)} MB in total`, 'UPLOAD_TOO_LARGE');
    assert(validTypes.includes(type), 422, 'type must be text, photo, video, or short-video', 'INVALID_POST_TYPE');
    const text = String(req.body?.text || '').trim();
    const nameIt = String(req.body?.nameIt || '').trim();
    const detail = String(req.body?.detail || '').trim();
    assert(text.length <= 20_000, 422, 'Text must be at most 20,000 characters', 'TEXT_TOO_LONG');
    assert(nameIt.length <= 200, 422, 'nameIt must be at most 200 characters', 'NAME_TOO_LONG');
    assert(detail.length <= 5_000, 422, 'Detail must be at most 5,000 characters', 'DETAIL_TOO_LONG');
    if (type === 'text') {
      assert(text.length > 0, 422, 'Write some text before posting', 'TEXT_REQUIRED');
      assert(files.length === 0, 422, 'Text posts cannot contain media files', 'UNEXPECTED_MEDIA');
    } else {
      assert(nameIt.length > 0, 422, 'nameIt is required for photo and video posts', 'NAME_REQUIRED');
      assert(files.length > 0, 422, 'Choose at least one file', 'MEDIA_REQUIRED');
      const allowedTypes = type === 'photo' ? allowedImageTypes : allowedVideoTypes;
      assert(files.every((file) => allowedTypes.has(file.mimetype)), 415,
        `${type === 'photo' ? 'Photo' : 'Video'} posts contain an unsupported file type`, 'INVALID_MEDIA_TYPE');
      const signatures = await Promise.all(files.map(hasValidMediaSignature));
      assert(signatures.every(Boolean), 415, 'A file does not match its declared media type', 'INVALID_MEDIA_SIGNATURE');
    }

    let altTexts = [];
    if (req.body?.altTexts) {
      try { altTexts = JSON.parse(req.body.altTexts); } catch { throw new AppError(422, 'altTexts must be a JSON array', 'INVALID_ALT_TEXT'); }
      assert(Array.isArray(altTexts), 422, 'altTexts must be an array', 'INVALID_ALT_TEXT');
    }

    const saved = [];
    try {
      for await (const chunk of inChunks(files, 2)) {
        const batch = await Promise.all(chunk.map((file) => saveUploadedFile(file, { ownerId: req.user.id, purpose: 'post' })));
        saved.push(...batch);
      }
      const media = saved.map((file, order) => ({ ...file, order, alt: String(altTexts[order] || '').slice(0, 300) }));
      const post = await createPost({
        author: req.user.id, type, text, nameIt, detail,
        links: cleanLinks(req.body?.links), media
      });
      res.status(201).json({ post: publicPost(post) });
    } catch (error) {
      await removeFiles(saved.map((file) => file.fileId));
      throw error;
    }
  } finally {
    await cleanupTemp(files);
  }
}));

postsRouter.get('/:postId', optionalAuth, asyncHandler(async (req, res) => {
  const post = await getPostById(req.params.postId);
  if (!post) throw new AppError(404, 'Post not found', 'POST_NOT_FOUND');
  const [reactions, viewerFollowsAuthor] = await Promise.all([
    reactionForPosts(req.user?.id, [post.id]),
    isFollowing(req.user?.id, post.author?.id)
  ]);
  res.json({ post: publicPost(post, { viewerReaction: reactions[post.id] || null, viewerFollowsAuthor }) });
}));

postsRouter.delete('/:postId', requireAuth, asyncHandler(async (req, res) => {
  const removed = await softDeletePost(req.params.postId, req.user.id);
  if (!removed) throw new AppError(404, 'Post not found or you do not own it', 'POST_NOT_FOUND');
  res.status(204).end();
}));

postsRouter.put('/:postId/reaction', requireAuth, asyncHandler(async (req, res) => {
  const requested = req.body?.reaction ?? req.body?.kind ?? null;
  assert(requested === null || ['hug', 'throw'].includes(requested), 422, 'reaction must be hug, throw, or null', 'INVALID_REACTION');
  const result = await setReaction(req.user.id, req.params.postId, requested);
  const viewerFollowsAuthor = await isFollowing(req.user.id, result.post.author?.id);
  res.json({ post: publicPost(result.post, { viewerReaction: result.reaction, viewerFollowsAuthor }), reaction: result.reaction });
}));

postsRouter.get('/:postId/comments', optionalAuth, asyncHandler(async (req, res) => {
  const comments = await listComments(req.params.postId, { limit: 100 });
  res.json({ comments: comments.map(publicComment) });
}));

postsRouter.post('/:postId/comments', requireAuth, asyncHandler(async (req, res) => {
  const body = String(req.body?.body || '').trim();
  assert(body.length >= 1 && body.length <= 2_000, 422, 'A comment must be 1–2,000 characters', 'INVALID_COMMENT');
  const comment = await createComment(req.params.postId, req.user.id, body);
  res.status(201).json({ comment: publicComment(comment) });
}));

postsRouter.patch('/:postId/comments/:commentId', requireAuth, asyncHandler(async (req, res) => {
  const body = String(req.body?.body || '').trim();
  assert(body.length >= 1 && body.length <= 2_000, 422, 'A comment must be 1–2,000 characters', 'INVALID_COMMENT');
  const comment = await updateComment(req.params.commentId, req.user.id, body);
  if (!comment) throw new AppError(404, 'Comment not found or you do not own it', 'COMMENT_NOT_FOUND');
  res.json({ comment: publicComment(comment) });
}));

postsRouter.delete('/:postId/comments/:commentId', requireAuth, asyncHandler(async (req, res) => {
  const removed = await deleteComment(req.params.commentId, req.user.id);
  if (!removed) throw new AppError(404, 'Comment not found or you do not own it', 'COMMENT_NOT_FOUND');
  res.status(204).end();
}));

postsRouter.post('/:postId/view', optionalAuth, asyncHandler(async (req, res) => {
  const viewCount = await recordView(req.user?.id, req.params.postId);
  if (viewCount == null) throw new AppError(404, 'Post not found', 'POST_NOT_FOUND');
  res.json({ viewCount: Number(viewCount) });
}));
