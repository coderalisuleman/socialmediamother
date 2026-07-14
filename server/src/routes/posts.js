import express from 'express';
import { asyncHandler, AppError, assert } from '../utils/errors.js';
import {
  createComment, deleteComment, getPostById, isFollowing, listComments,
  reactionForPosts, recordView, setReaction, softDeletePost, updateComment
} from '../services/store.js';
import { publicComment, publicPost } from '../services/serializers.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { config } from '../config.js';
import { publishPostFiles } from '../services/postPublisher.js';

export const postsRouter = express.Router();

postsRouter.post('/', requireAuth, upload.array('files', config.maxFilesPerPost), asyncHandler(async (req, res) => {
  const files = req.files || [];
  const post = await publishPostFiles({ files, body: req.body || {}, userId: req.user.id });
  res.status(201).json({ post: publicPost(post) });
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
