import express from 'express';
import { asyncHandler, assert } from '../utils/errors.js';
import { decodeCursor, encodeCursor, pageLimit, windowItems } from '../utils/cursor.js';
import {
  findUserByIdentifier, getFollowingIds, postsByMatchingAuthors, reactionForPosts, searchCandidates
} from '../services/store.js';
import { publicPost, publicUser } from '../services/serializers.js';
import { optionalAuth } from '../middleware/auth.js';
import {
  normalizeSearchText, parseSearchIntent, rankPersonSearch, rankPostSearch
} from '../services/searchRanking.js';

export const searchRouter = express.Router();

searchRouter.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const query = String(req.query.q || '').trim().slice(0, 160);
  assert(query.length >= 1, 422, 'Enter something to search for', 'SEARCH_QUERY_REQUIRED');
  const type = req.query.type || 'all';
  assert(['all', 'text', 'photo', 'video', 'short-video'].includes(type), 422, 'Choose a valid search type', 'INVALID_SEARCH_TYPE');
  const limit = pageLimit(req.query.limit, 15, 30);
  const { offset = 0 } = decodeCursor(req.query.cursor, {});

  const { exactAt, byUsername, authorName, contentQuery } = parseSearchIntent(query);

  const [direct, authorPosts, exactUser, viewerFollowingIds] = await Promise.all([
    searchCandidates({ query: contentQuery || query, type }),
    postsByMatchingAuthors({ usernames: [byUsername || exactAt].filter(Boolean), names: [authorName].filter(Boolean), type }),
    byUsername || exactAt ? findUserByIdentifier(byUsername || exactAt) : null,
    req.user ? getFollowingIds(req.user.id) : [],
  ]);
  const followingSet = new Set(viewerFollowingIds.map(String));

  const peopleById = new Map(direct.users.map((user) => [user.id, user]));
  if (exactUser) peopleById.set(exactUser.id, exactUser);
  for (const post of authorPosts) if (post.author) peopleById.set(post.author.id, post.author);
  const people = [...peopleById.values()].map((user) => {
    const personQuery = authorName || byUsername || exactAt || query;
    let score = rankPersonSearch(personQuery, user);
    if (exactAt === user.username) score += 2_000;
    if (byUsername === user.username) score += 5_000;
    if (authorName && normalizeSearchText(user.fullName).includes(normalizeSearchText(authorName))) score += 1_000;
    if (followingSet.has(String(user.id || user._id))) score += 35;
    score += Math.min(24, Math.log1p(Number(user.followerCount || 0)) * 3);
    return { user, score };
  }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score || a.user.username.localeCompare(b.user.username));

  const postsById = new Map([...direct.posts, ...authorPosts].map((post) => [post.id, post]));
  const ranked = [...postsById.values()].map((post) => {
    let score = rankPostSearch(contentQuery, post);
    if (!contentQuery && !(byUsername || exactAt || authorName)) return { post, score: 0 };
    if (normalizeSearchText(post.nameIt) === normalizeSearchText(contentQuery) && contentQuery) score += 500;
    if (byUsername && post.author?.username !== byUsername) return { post, score: 0 };
    if (exactAt && post.author?.username !== exactAt) return { post, score: 0 };
    if (byUsername) score += 10_000;
    else if (exactAt) score += 4_000;
    else if (authorName && normalizeSearchText(post.author?.fullName).includes(normalizeSearchText(authorName))) score += 2_000;
    else if (authorName) return { post, score: 0 };
    if (followingSet.has(String(post.author?.id || post.author?._id))) score += 32;
    score += Math.min(28, Math.log1p((post.hugCount || 0) * 2 + (post.commentCount || 0) * 3 + (post.viewCount || 0) * .08) * 2.2);
    const ageDays = Math.max(0, (Date.now() - new Date(post.createdAt || 0).getTime()) / 86_400_000);
    score += Math.max(0, 16 - Math.log2(ageDays + 1) * 3);
    return { post, score };
  }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score || new Date(b.post.createdAt) - new Date(a.post.createdAt));

  const page = [...windowItems(ranked, offset, limit)];
  const reactions = await reactionForPosts(req.user?.id, page.map(({ post }) => post.id));
  res.json({
    query,
    type,
    filters: ['all', 'text', 'photo', 'video', 'short-video'],
    people: offset === 0 ? people.slice(0, 20).map(({ user, score }) => ({
      ...publicUser(user, { viewerFollows: followingSet.has(String(user.id || user._id)) }),
      searchScore: score
    })) : [],
    posts: page.map(({ post, score }) => publicPost(post, {
      viewerReaction: reactions[post.id] || null,
      viewerFollowsAuthor: followingSet.has(String(post.author?.id || post.author?._id)),
      score
    })),
    nextCursor: offset + limit < ranked.length ? encodeCursor({ offset: offset + limit }) : null
  });
}));
