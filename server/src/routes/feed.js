import express from 'express';
import { asyncHandler, assert } from '../utils/errors.js';
import { decodeCursor, encodeCursor, pageLimit } from '../utils/cursor.js';
import { getFollowingIds, listFeedCandidates, reactionForPosts } from '../services/store.js';
import { rankFeedChunk } from '../services/feed.js';
import { publicPost } from '../services/serializers.js';
import { optionalAuth } from '../middleware/auth.js';

export const feedRouter = express.Router();

feedRouter.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const requestedScope = req.query.scope || 'everyone';
  assert(['everyone', 'following'].includes(requestedScope), 422, 'scope must be everyone or following', 'INVALID_FEED_SCOPE');
  const limit = pageLimit(req.query.limit, 12, 30);
  const cursorState = decodeCursor(req.query.cursor, {});
  const before = cursorState?.before || null;
  const offset = Number.isInteger(cursorState?.offset) && cursorState.offset >= 0 ? cursorState.offset : 0;
  let authorIds;
  let viewerFollowingIds = [];
  let scope = requestedScope;
  let fallbackReason = null;

  if (requestedScope === 'following') {
    if (!req.user) {
      scope = 'everyone';
      fallbackReason = 'sign-in-required';
    } else {
      authorIds = await getFollowingIds(req.user.id);
      viewerFollowingIds = authorIds;
      if (!authorIds.length) {
        authorIds = undefined;
        scope = 'everyone';
        fallbackReason = 'not-following-anyone-yet';
      }
    }
  }

  if (req.user && requestedScope !== 'following') {
    viewerFollowingIds = await getFollowingIds(req.user.id);
  }

  // Rank a meaningfully larger recent window so strong engagement and learned
  // format preferences can lift a post instead of merely reordering five rows.
  const candidateWindowSize = Math.min(120, Math.max(40, limit * 8));
  const rows = await listFeedCandidates({ authorIds, before, limit: candidateWindowSize });
  const hasOlderWindow = rows.length > candidateWindowSize;
  const chronologicalWindow = rows.slice(0, candidateWindowSize);
  const rankedWindow = await rankFeedChunk(
    chronologicalWindow,
    req.user ? { ...req.user, followingIds: viewerFollowingIds } : null
  );
  const rankedPage = rankedWindow.slice(offset, offset + limit);
  const reactions = await reactionForPosts(req.user?.id, rankedPage.map(({ post }) => post.id));
  const followingSet = new Set(viewerFollowingIds.map(String));
  let nextCursor = null;
  if (offset + limit < rankedWindow.length) {
    nextCursor = encodeCursor({ before, offset: offset + limit });
  } else if (hasOlderWindow && chronologicalWindow.length) {
    const anchor = chronologicalWindow.at(-1);
    nextCursor = encodeCursor({ before: { createdAt: anchor.createdAt, id: anchor.id }, offset: 0 });
  }
  res.json({
    scope,
    requestedScope,
    fallbackReason,
    posts: rankedPage.map(({ post, score }) => publicPost(post, {
      viewerReaction: reactions[post.id] || null,
      viewerFollowsAuthor: followingSet.has(String(post.author?.id || post.author?._id)),
      score
    })),
    nextCursor
  });
}));
