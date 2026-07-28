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
    throw new AppError(503, 'Analytics login needs ANALYTICS_TEAM_PASSWORD_HASH in the server environment.', 'ANALYTICS_NOT_CONFIGURED');
  }
  const valid = email === config.analytics.teamEmail && await bcrypt.compare(password, config.analytics.passwordHash);
  if (!valid) throw new AppError(401, 'Analytics team email or password is incorrect', 'INVALID_ANALYTICS_CREDENTIALS');
  res.json({ token: signAnalyticsToken(email), team: { email } });
}));

export const friendlyAnalyticsEventType = (row) => {
  if (row?.eventType === 'post_view') {
    const format = String(row?.metadata?.format || '').toLowerCase();
    const postViewNames = {
      text: 'text_post_view',
      photo: 'photo_post_view',
      video: 'video_post_view',
      'short-video': 'short_video_post_view',
    };
    return postViewNames[format] || 'post_view';
  }
  if (row?.eventType === 'connection') {
    if (row?.metadata?.network === 'online') return 'internet_connected';
    if (row?.metadata?.network === 'offline') return 'internet_disconnected';
    return 'internet_status_changed';
  }
  if (row?.eventType === 'visibility') {
    if (row?.metadata?.visibility === 'visible') return 'returned_to_page';
    if (row?.metadata?.visibility === 'hidden') return 'switched_away_from_page';
    return 'page_view_status_changed';
  }
  return row?.eventType || 'other_action';
};

const adminReportFromRows = (rows, since, mode = 'days', days = null) => {
  const sessions = new Set();
  const eventCounts = new Map();
  const rawEventCounts = new Map();
  const pathCounts = new Map();
  let watchingMs = 0;
  for (const row of rows) {
    sessions.add(row.sessionId);
    const friendlyType = friendlyAnalyticsEventType(row);
    eventCounts.set(friendlyType, (eventCounts.get(friendlyType) || 0) + 1);
    rawEventCounts.set(row.eventType, (rawEventCounts.get(row.eventType) || 0) + 1);
    pathCounts.set(row.path, (pathCounts.get(row.path) || 0) + 1);
    if (row.eventType === 'media_watch') watchingMs += Number(row.durationMs || 0);
  }
  const top = (map, label) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name, count]) => ({ [label]: name, count }));
  const eventTypes = top(eventCounts, 'eventType');
  const paths = top(pathCounts, 'path');
  const recommendations = [];
  const errors = rawEventCounts.get('asset_error') || 0;
  const searches = rawEventCounts.get('search') || 0;
  const exits = rawEventCounts.get('session_end') || 0;
  if (errors) recommendations.push(`${errors} media or page loading errors occurred. Review the affected paths and connection details first.`);
  if (searches && !(rawEventCounts.get('search_result_open') || 0)) recommendations.push('People are searching but rarely opening a result. Refine result labels and ranking.');
  if (exits > sessions.size * .8) recommendations.push('Many recorded sessions ended after little interaction. Review the top exit paths and first-screen clarity.');
  if (!recommendations.length) recommendations.push('No strong problem pattern appears in this period. Compare top paths and watch time week over week.');
  return {
    period: { mode, since, until: new Date().toISOString(), days: mode === 'days' ? days : null },
    totals: { events: rows.length, sessions: sessions.size, watchingSeconds: Math.round(watchingMs / 1000) },
    eventTypes,
    paths,
    recommendations,
    recent: rows.slice(-100).reverse().map(({ metadata, ...row }) => ({ ...row, metadata: safeMetadata(metadata) })),
  };
};

analyticsRouter.get('/team/report', requireAnalyticsTeam, asyncHandler(async (req, res) => {
  const lifetime = req.query.lifetime === 'true';
  const days = Math.min(36_500, Math.max(1, Number.parseInt(req.query.days || '30', 10) || 30));
  const sinceDate = lifetime ? null : new Date(Date.now() - days * 86_400_000);
  const rows = config.storageMode === 'mongodb'
    ? await AnalyticsEvent.find(sinceDate ? { occurredAt: { $gte: sinceDate } } : {}).sort({ occurredAt: 1 }).limit(500_000).lean()
    : memoryEvents.filter((event) => !sinceDate || new Date(event.occurredAt) >= sinceDate);
  const plainRows = rows.map((row) => ({ ...row, id: String(row._id || '') }));
  const since = sinceDate?.toISOString() || plainRows[0]?.occurredAt || null;
  res.json(adminReportFromRows(plainRows, since, lifetime ? 'lifetime' : 'days', lifetime ? null : days));
}));

analyticsRouter.get('/creator/report', requireAuth, asyncHandler(async (req, res) => {
  const posts = (await listPostsByAuthor(req.user.id, { limit: 500 })).slice(0, 500);
  const postIds = new Set(posts.map((post) => String(post.id)));
  const lifetime = req.query.lifetime === 'true';
  const days = Math.min(365, Math.max(1, Number.parseInt(req.query.days || '30', 10) || 30));
  const sinceDate = lifetime ? null : new Date(Date.now() - days * 86_400_000);
  const eventFilter = { postAuthorId: String(req.user.id) };
  if (sinceDate) eventFilter.occurredAt = { $gte: sinceDate };
  const events = config.storageMode === 'mongodb'
    ? await AnalyticsEvent.find(eventFilter).lean()
    : memoryEvents.filter((event) => event.postAuthorId === String(req.user.id) && (!sinceDate || new Date(event.occurredAt) >= sinceDate));
  const eventCountByPost = new Map();
  const watchByPost = new Map();
  const followsByPost = new Map();
  for (const event of events) {
    if (!postIds.has(String(event.postId))) continue;
    const key = `${String(event.postId)}:${event.eventType}`;
    eventCountByPost.set(key, (eventCountByPost.get(key) || 0) + 1);
    if (event.eventType === 'media_watch') watchByPost.set(String(event.postId), (watchByPost.get(String(event.postId)) || 0) + Number(event.durationMs || 0));
    if (event.eventType === 'creator_follow') followsByPost.set(String(event.postId), (followsByPost.get(String(event.postId)) || 0) + 1);
  }
  const eventCount = (postId, type) => eventCountByPost.get(`${String(postId)}:${type}`) || 0;
  const individual = posts.map((post) => ({
    id: String(post.id),
    type: post.type,
    name: post.nameIt || post.text?.split('\n')[0]?.slice(0, 100) || `${post.type} post`,
    views: lifetime ? Number(post.viewCount || 0) : eventCount(post.id, 'post_view'),
    hugs: lifetime ? Number(post.hugCount || 0) : eventCount(post.id, 'post_hug'),
    throws: lifetime ? Number(post.throwCount || 0) : eventCount(post.id, 'post_throw'),
    thoughts: lifetime ? Number(post.commentCount || 0) : eventCount(post.id, 'post_thought'),
    watchingSeconds: Math.round((watchByPost.get(String(post.id)) || 0) / 1000),
    followersGained: followsByPost.get(String(post.id)) || 0,
    createdAt: post.createdAt,
  })).sort((a, b) => b.views + b.hugs * 2 + b.thoughts * 3 - (a.views + a.hugs * 2 + a.thoughts * 3));
  res.json({
    periodDays: lifetime ? null : days,
    period: {
      mode: lifetime ? 'lifetime' : 'days',
      since: lifetime ? (req.user.createdAt || posts.at(-1)?.createdAt || null) : sinceDate.toISOString(),
      until: new Date().toISOString(),
    },
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
