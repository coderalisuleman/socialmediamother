import express from 'express';
import { asyncHandler, assert } from '../utils/errors.js';
import { decodeCursor, encodeCursor, pageLimit, windowItems } from '../utils/cursor.js';
import {
  findUserByIdentifier, getFollowingIds, postsByMatchingAuthors, reactionForPosts, searchCandidates
} from '../services/store.js';
import { publicPost, publicUser } from '../services/serializers.js';
import { optionalAuth } from '../middleware/auth.js';

export const searchRouter = express.Router();

const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const words = (value) => normalize(value).split(' ').filter(Boolean);

const textScore = (query, text) => {
  const q = normalize(query);
  const target = normalize(text);
  if (!q || !target) return 0;
  let score = target.includes(q) ? 80 : 0;
  const tokens = words(q);
  const matched = tokens.filter((token) => target.includes(token)).length;
  score += matched * 12 + (matched === tokens.length ? 35 : 0);
  return score;
};

searchRouter.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const query = String(req.query.q || '').trim().slice(0, 160);
  assert(query.length >= 1, 422, 'Enter something to search for', 'SEARCH_QUERY_REQUIRED');
  const type = req.query.type || 'all';
  assert(['all', 'text', 'photo', 'video', 'short-video'].includes(type), 422, 'Choose a valid search type', 'INVALID_SEARCH_TYPE');
  const limit = pageLimit(req.query.limit, 15, 30);
  const { offset = 0 } = decodeCursor(req.query.cursor, {});

  const exactAt = query.match(/(?:^|\s)@([a-z]{1,40})(?=\s|$)/i)?.[1]?.toLowerCase();
  const byMatch = query.match(/\bby\s+(@?)([a-z]{1,40})(?=\s|$)/i);
  const byUsername = byMatch?.[1] === '@' ? byMatch[2].toLowerCase() : null;
  const byName = byMatch?.[1] !== '@' ? byMatch?.[2] : null;
  const contentQuery = query.replace(/\bby\s+@?[a-z]{1,40}(?=\s|$)/ig, '').replace(/@[a-z]{1,40}/ig, '').trim() || query;

  const [direct, authorPosts, exactUser] = await Promise.all([
    searchCandidates({ query: contentQuery, type }),
    postsByMatchingAuthors({ usernames: [byUsername || exactAt].filter(Boolean), names: [byName].filter(Boolean), type }),
    byUsername || exactAt ? findUserByIdentifier(byUsername || exactAt) : null
  ]);

  const peopleById = new Map(direct.users.map((user) => [user.id, user]));
  if (exactUser) peopleById.set(exactUser.id, exactUser);
  for (const post of authorPosts) if (post.author) peopleById.set(post.author.id, post.author);
  const people = [...peopleById.values()].map((user) => {
    let score = textScore(query, `${user.fullName} ${user.username}`);
    if (exactAt === user.username) score += 2_000;
    if (byUsername === user.username) score += 5_000;
    if (byName && user.fullName.toLowerCase().includes(byName.toLowerCase())) score += 1_000;
    return { user, score };
  }).sort((a, b) => b.score - a.score || a.user.username.localeCompare(b.user.username));

  const postsById = new Map([...direct.posts, ...authorPosts].map((post) => [post.id, post]));
  const ranked = [...postsById.values()].map((post) => {
    let score = textScore(contentQuery, `${post.nameIt} ${post.text} ${post.detail} ${(post.links || []).join(' ')}`);
    if (normalize(post.nameIt) === normalize(contentQuery)) score += 500;
    if (byUsername && post.author?.username === byUsername) score += 10_000;
    else if (exactAt && post.author?.username === exactAt) score += 4_000;
    else if (byName && normalize(post.author?.fullName).includes(normalize(byName))) score += 2_000;
    score += Math.log1p((post.hugCount || 0) * 2 + (post.viewCount || 0) * 0.1);
    return { post, score };
  }).sort((a, b) => b.score - a.score || new Date(b.post.createdAt) - new Date(a.post.createdAt));

  const page = [...windowItems(ranked, offset, limit)];
  const [reactions, viewerFollowingIds] = await Promise.all([
    reactionForPosts(req.user?.id, page.map(({ post }) => post.id)),
    req.user ? getFollowingIds(req.user.id) : []
  ]);
  const followingSet = new Set(viewerFollowingIds.map(String));
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
