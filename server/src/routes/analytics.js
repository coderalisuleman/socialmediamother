import express from 'express';
import bcrypt from 'bcryptjs';
import { AnalyticsEvent } from '../models/AnalyticsEvent.js';
import { config } from '../config.js';
import { asyncHandler, AppError, assert } from '../utils/errors.js';
import { optionalAuth, requireAnalyticsTeam, requireAuth } from '../middleware/auth.js';
import { signAnalyticsToken } from '../services/tokens.js';
import { listPostsByAuthor } from '../services/store.js';

export const analyticsRouter = express.Router();
const memoryEvents = [];
const safeMetadataKeys = new Set(['action', 'element', 'filter', 'format', 'network', 'position', 'reason', 'visibility']);

const safeText = (value, max) => String(value || '').replace(/[\r\n\0]/g, ' ').trim().slice(0, max);
const safePath = (value) => {
  try {
    return new URL(String(value || '/'), 'https://socialmediamother.invalid').pathname.slice(0, 300) || '/';
  } catch {
    return '/';
  }
};
const safeMetadata = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
    if (!safeMetadataKeys.has(key) || !['string', 'number', 'boolean'].includes(typeof item)) return [];
    return [[key, typeof item === 'string' ? safeText(item, 100) : item]];
  }));
};

const normalizeEvent = (event, userId) => {
  const occurred = new Date(event?.occurredAt || Date.now());
  const now = Date.now();
  return {
    sessionId: safeText(event?.sessionId, 100),
    userId: userId ? String(userId) : null,
    eventType: safeText(event?.eventType, 80).toLowerCase(),
    path: safePath(event?.path),
    targetType: safeText(event?.targetType, 60),
    targetId: safeText(event?.targetId, 160),
    postId: safeText(event?.postId, 160),
    postAuthorId: safeText(event?.postAuthorId, 100),
    durationMs: Math.min(86_400_000, Math.max(0, Math.round(Number(event?.durationMs) || 0))),
    metadata: safeMetadata(event?.metadata),
    occurredAt: Number.isNaN(occurred.getTime()) || Math.abs(occurred.getTime() - now) > 86_400_000 ? new Date() : occurred,
  };
};

analyticsRouter.post('/events', optionalAuth, asyncHandler(async (req, res) => {
  const requested = Array.isArray(req.body?.events) ? req.body.events : [];
  assert(requested.length >= 1 && requested.length <= 50, 422, 'Send 1–50 analytics events at a time', 'INVALID_ANALYTICS_BATCH');
  const events = requested.map((event) => normalizeEvent(event, req.user?.id));
  assert(events.every((event) => event.sessionId && /^[a-z0-9-]{8,100}$/i.test(event.sessionId) && /^[a-z0-9_.:-]{2,80}$/i.test(event.eventType)),
    422, 'An analytics event has an invalid session or type', 'INVALID_ANALYTICS_EVENT');
  if (config.storageMode === 'mongodb') await AnalyticsEvent.insertMany(events, { ordered: false });
  else {
    memoryEvents.push(...events.map((event) => ({ ...event, createdAt: new Date() })));
    if (memoryEvents.length > 10_000) memoryEvents.splice(0, memoryEvents.length - 10_000);
  }
  res.status(202).json({ accepted: events.length });
}));

analyticsRouter.post('/team/login', asyncHandler(async (req, res) => {
  const email = safeText(req.body?.email, 180).toLowerCase();
  const password = String(req.body?.password || '');
  if (!config.analytics.passwordHash) {
    throw new AppError(503, 'Human-behaviour login needs ANALYTICS_TEAM_PASSWORD_HASH in the server environment.', 'ANALYTICS_NOT_CONFIGURED');
  }
  const valid = email === config.analytics.teamEmail && await bcrypt.compare(password, config.analytics.passwordHash);
  if (!valid) throw new AppError(401, 'Human-behaviour team email or password is incorrect', 'INVALID_ANALYTICS_CREDENTIALS');
  res.json({ token: signAnalyticsToken(email), team: { email } });
}));

const adminReportFromRows = (rows, since) => {
  const sessions = new Set();
  const eventCounts = new Map();
  const pathCounts = new Map();
  let watchingMs = 0;
  for (const row of rows) {
    sessions.add(row.sessionId);
    eventCounts.set(row.eventType, (eventCounts.get(row.eventType) || 0) + 1);
    pathCounts.set(row.path, (pathCounts.get(row.path) || 0) + 1);
    if (row.eventType === 'media_watch') watchingMs += Number(row.durationMs || 0);
  }
  const top = (map, label) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name, count]) => ({ [label]: name, count }));
  const eventTypes = top(eventCounts, 'eventType');
  const paths = top(pathCounts, 'path');
  const recommendations = [];
  const errors = eventCounts.get('asset_error') || 0;
  const searches = eventCounts.get('search') || 0;
  const exits = eventCounts.get('session_end') || 0;
  if (errors) recommendations.push(`${errors} media or page loading errors occurred. Review the affected paths and connection details first.`);
  if (searches && !(eventCounts.get('search_result_open') || 0)) recommendations.push('People are searching but rarely opening a result. Refine result labels and ranking.');
  if (exits > sessions.size * .8) recommendations.push('Many recorded sessions ended after little interaction. Review the top exit paths and first-screen clarity.');
  if (!recommendations.length) recommendations.push('No strong problem pattern appears in this period. Compare top paths and watch time week over week.');
  return {
    period: { since, until: new Date().toISOString() },
    totals: { events: rows.length, sessions: sessions.size, watchingSeconds: Math.round(watchingMs / 1000) },
    eventTypes,
    paths,
    recommendations,
    recent: rows.slice(-100).reverse().map(({ metadata, ...row }) => ({ ...row, metadata: safeMetadata(metadata) })),
  };
};

analyticsRouter.get('/team/report', requireAnalyticsTeam, asyncHandler(async (req, res) => {
  const days = Math.min(90, Math.max(1, Number.parseInt(req.query.days || '7', 10) || 7));
  const sinceDate = new Date(Date.now() - days * 86_400_000);
  const rows = config.storageMode === 'mongodb'
    ? await AnalyticsEvent.find({ occurredAt: { $gte: sinceDate } }).sort({ occurredAt: 1 }).limit(100_000).lean()
    : memoryEvents.filter((event) => new Date(event.occurredAt) >= sinceDate);
  res.json(adminReportFromRows(rows.map((row) => ({ ...row, id: String(row._id || '') })), sinceDate.toISOString()));
}));

analyticsRouter.get('/creator/report', requireAuth, asyncHandler(async (req, res) => {
  const posts = (await listPostsByAuthor(req.user.id, { limit: 500 })).slice(0, 500);
  const postIds = new Set(posts.map((post) => String(post.id)));
  const sinceDate = new Date(Date.now() - 90 * 86_400_000);
  const events = config.storageMode === 'mongodb'
    ? await AnalyticsEvent.find({ postAuthorId: String(req.user.id), occurredAt: { $gte: sinceDate } }).lean()
    : memoryEvents.filter((event) => event.postAuthorId === String(req.user.id) && new Date(event.occurredAt) >= sinceDate);
  const watchByPost = new Map();
  const followsByPost = new Map();
  for (const event of events) {
    if (!postIds.has(String(event.postId))) continue;
    if (event.eventType === 'media_watch') watchByPost.set(String(event.postId), (watchByPost.get(String(event.postId)) || 0) + Number(event.durationMs || 0));
    if (event.eventType === 'creator_follow') followsByPost.set(String(event.postId), (followsByPost.get(String(event.postId)) || 0) + 1);
  }
  const individual = posts.map((post) => ({
    id: String(post.id),
    type: post.type,
    name: post.nameIt || post.text?.split('\n')[0]?.slice(0, 100) || `${post.type} post`,
    views: Number(post.viewCount || 0),
    hugs: Number(post.hugCount || 0),
    throws: Number(post.throwCount || 0),
    thoughts: Number(post.commentCount || 0),
    watchingSeconds: Math.round((watchByPost.get(String(post.id)) || 0) / 1000),
    followersGained: followsByPost.get(String(post.id)) || 0,
    createdAt: post.createdAt,
  })).sort((a, b) => b.views + b.hugs * 2 + b.thoughts * 3 - (a.views + a.hugs * 2 + a.thoughts * 3));
  res.json({
    periodDays: 90,
    totals: individual.reduce((total, post) => ({
      posts: total.posts + 1,
      views: total.views + post.views,
      hugs: total.hugs + post.hugs,
      throws: total.throws + post.throws,
      thoughts: total.thoughts + post.thoughts,
      watchingSeconds: total.watchingSeconds + post.watchingSeconds,
    }), { posts: 0, views: 0, hugs: 0, throws: 0, thoughts: 0, watchingSeconds: 0 }),
    followers: Number(req.user.followerCount || 0),
    individual,
  });
}));
