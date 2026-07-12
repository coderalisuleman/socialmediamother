import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { config } from '../config.js';
import { User } from '../models/User.js';
import { Post } from '../models/Post.js';
import { Follow } from '../models/Follow.js';
import { Reaction } from '../models/Reaction.js';
import { OtpChallenge } from '../models/OtpChallenge.js';
import { Comment } from '../models/Comment.js';
import { AppError } from '../utils/errors.js';
import { escapeRegex } from '../utils/normalize.js';

const memory = {
  users: new Map(),
  posts: new Map(),
  follows: new Map(),
  reactions: new Map(),
  comments: new Map(),
  otps: new Map()
};

const nowIso = () => new Date().toISOString();
const makeId = () => crypto.randomUUID().replaceAll('-', '');
const clone = (value) => value == null ? value : structuredClone(value);
const followKey = (follower, followed) => `${follower}:${followed}`;
const reactionKey = (user, post) => `${user}:${post}`;
const comparableId = (value) => String(value?._id || value?.id || value);

const asPlainComment = (document) => {
  if (!document) return null;
  // Keep BSON ObjectIds intact until they are normalized to strings below.
  // structuredClone turns ObjectId instances from lean queries into plain
  // objects, which previously broke every authenticated write after signup.
  const value = typeof document.toObject === 'function' ? document.toObject() : { ...document };
  value.id = comparableId(value);
  value.post = comparableId(value.post);
  delete value._id;
  delete value.__v;
  if (value.author) value.author = asPlainUser(value.author);
  return value;
};

const asPlainUser = (document) => {
  if (!document) return null;
  const value = typeof document.toObject === 'function' ? document.toObject() : { ...document };
  value.id = comparableId(value);
  delete value._id;
  delete value.__v;
  return value;
};

const asPlainPost = (document) => {
  if (!document) return null;
  const value = typeof document.toObject === 'function' ? document.toObject() : { ...document };
  value.id = comparableId(value);
  delete value._id;
  delete value.__v;
  if (value.author) value.author = asPlainUser(value.author);
  value.media = (value.media || []).map((item) => ({
    ...(typeof item.toObject === 'function' ? item.toObject() : item),
    fileId: comparableId(item.fileId)
  }));
  return value;
};

const memoryUser = (data) => ({
  id: makeId(),
  fullName: data.fullName,
  username: data.username,
  passwordHash: data.passwordHash,
  email: data.email || null,
  phone: data.phone || null,
  verifiedEmail: Boolean(data.verifiedEmail),
  verifiedPhone: Boolean(data.verifiedPhone),
  gender: data.gender || 'prefer-not-to-say',
  bio: data.bio || '',
  profileImageFileId: data.profileImageFileId || null,
  followerCount: 0,
  followingCount: 0,
  typePreferences: { text: 0, photo: 0, video: 0, 'short-video': 0 },
  lastSeenAt: nowIso(),
  createdAt: nowIso(),
  updatedAt: nowIso()
});

export const storeMode = () => config.storageMode;

export const createUser = async (data) => {
  if (config.storageMode === 'mongodb') return asPlainUser(await User.create(data));
  for (const user of memory.users.values()) {
    if (user.username === data.username || (data.email && user.email === data.email) || (data.phone && user.phone === data.phone)) {
      throw new AppError(409, 'Username, email, or phone is already in use', 'ALREADY_EXISTS');
    }
  }
  const user = memoryUser(data);
  memory.users.set(user.id, user);
  return clone(user);
};

export const findUserById = async (id, { includePassword = false } = {}) => {
  if (!id) return null;
  if (config.storageMode === 'mongodb') {
    if (!mongoose.isValidObjectId(id)) return null;
    const query = User.findById(id);
    if (includePassword) query.select('+passwordHash');
    return asPlainUser(await query.lean());
  }
  const user = memory.users.get(String(id));
  if (!user) return null;
  const result = clone(user);
  if (!includePassword) delete result.passwordHash;
  return result;
};

export const findUserByIdentifier = async (identifier, { includePassword = false } = {}) => {
  const normalized = String(identifier || '').trim().toLowerCase();
  const username = normalized.replace(/^@/, '');
  if (config.storageMode === 'mongodb') {
    const conditions = [{ username }];
    if (normalized.includes('@') && !normalized.startsWith('@')) conditions.push({ email: normalized });
    if (normalized.startsWith('+')) conditions.push({ phone: normalized.replace(/[\s()-]/g, '') });
    const query = User.findOne({ $or: conditions });
    if (includePassword) query.select('+passwordHash');
    return asPlainUser(await query.lean());
  }
  const user = [...memory.users.values()].find((item) =>
    item.username === username || item.email === normalized || item.phone === normalized.replace(/[\s()-]/g, '')
  );
  if (!user) return null;
  const result = clone(user);
  if (!includePassword) delete result.passwordHash;
  return result;
};

export const updateUser = async (id, changes) => {
  if (config.storageMode === 'mongodb') {
    return asPlainUser(await User.findByIdAndUpdate(id, { $set: changes }, { new: true, runValidators: true }).lean());
  }
  const user = memory.users.get(String(id));
  if (!user) return null;
  Object.assign(user, clone(changes), { updatedAt: nowIso() });
  return clone(user);
};

export const createOtp = async (data) => {
  if (config.storageMode === 'mongodb') {
    const challenge = await OtpChallenge.create(data);
    return { id: comparableId(challenge), ...data };
  }
  const challenge = { id: makeId(), ...clone(data), attempts: 0, consumedAt: null, createdAt: nowIso() };
  memory.otps.set(challenge.id, challenge);
  return clone(challenge);
};

export const findRecentOtp = async (channel, destination, since) => {
  if (config.storageMode === 'mongodb') {
    const value = await OtpChallenge.findOne({
      channel,
      destination,
      consumedAt: null,
      createdAt: { $gte: since }
    }).sort({ createdAt: -1 }).lean();
    return value ? { ...value, id: comparableId(value) } : null;
  }
  return [...memory.otps.values()]
    .filter((item) => item.channel === channel && item.destination === destination && !item.consumedAt && new Date(item.createdAt) >= since)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0] || null;
};

export const getOtp = async (id, { includeCodeHash = false } = {}) => {
  if (config.storageMode === 'mongodb') {
    if (!mongoose.isValidObjectId(id)) return null;
    const query = OtpChallenge.findById(id);
    if (includeCodeHash) query.select('+codeHash');
    const value = await query.lean();
    return value ? { ...value, id: comparableId(value) } : null;
  }
  const value = memory.otps.get(String(id));
  if (!value) return null;
  const result = clone(value);
  if (!includeCodeHash) delete result.codeHash;
  return result;
};

export const updateOtp = async (id, changes) => {
  if (config.storageMode === 'mongodb') return OtpChallenge.findByIdAndUpdate(id, { $set: changes }, { new: true }).lean();
  const value = memory.otps.get(String(id));
  if (!value) return null;
  Object.assign(value, clone(changes));
  return clone(value);
};

export const reserveOtpAttempt = async (id) => {
  const now = new Date();
  if (config.storageMode === 'mongodb') {
    if (!mongoose.isValidObjectId(id)) return null;
    const value = await OtpChallenge.findOneAndUpdate(
      { _id: id, consumedAt: null, expiresAt: { $gt: now }, attempts: { $lt: 5 } },
      { $inc: { attempts: 1 } },
      { new: true }
    ).select('+codeHash').lean();
    return value ? { ...value, id: comparableId(value) } : null;
  }
  const value = memory.otps.get(String(id));
  if (!value || value.consumedAt || new Date(value.expiresAt).getTime() <= now.getTime() || value.attempts >= 5) return null;
  value.attempts += 1;
  return clone(value);
};

export const consumeOtp = async (id) => {
  const consumedAt = new Date();
  if (config.storageMode === 'mongodb') {
    if (!mongoose.isValidObjectId(id)) return null;
    const value = await OtpChallenge.findOneAndUpdate(
      { _id: id, consumedAt: null },
      { $set: { consumedAt } },
      { new: true }
    ).lean();
    return value ? { ...value, id: comparableId(value) } : null;
  }
  const value = memory.otps.get(String(id));
  if (!value || value.consumedAt) return null;
  value.consumedAt = consumedAt.toISOString();
  return clone(value);
};

export const setFollowing = async (followerId, followedId, enabled) => {
  if (String(followerId) === String(followedId)) {
    throw new AppError(422, 'You cannot follow yourself', 'SELF_RELATIONSHIP');
  }
  if (config.storageMode === 'mongodb') {
    if (enabled) {
      const result = await Follow.updateOne(
        { follower: followerId, followed: followedId },
        { $setOnInsert: { follower: followerId, followed: followedId } },
        { upsert: true }
      );
      if (result.upsertedCount) {
        await Promise.all([
          User.updateOne({ _id: followerId }, { $inc: { followingCount: 1 } }),
          User.updateOne({ _id: followedId }, { $inc: { followerCount: 1 } })
        ]);
      }
    } else {
      const result = await Follow.deleteOne({ follower: followerId, followed: followedId });
      if (result.deletedCount) {
        await Promise.all([
          User.updateOne({ _id: followerId }, [{ $set: { followingCount: { $max: [0, { $subtract: ['$followingCount', 1] }] } } }]),
          User.updateOne({ _id: followedId }, [{ $set: { followerCount: { $max: [0, { $subtract: ['$followerCount', 1] }] } } }])
        ]);
      }
    }
    return enabled;
  }

  const key = followKey(followerId, followedId);
  const exists = memory.follows.has(key);
  if (enabled && !exists) {
    memory.follows.set(key, { follower: followerId, followed: followedId, createdAt: nowIso() });
    const follower = memory.users.get(String(followerId));
    const followed = memory.users.get(String(followedId));
    follower.followingCount += 1;
    followed.followerCount += 1;
  } else if (!enabled && exists) {
    memory.follows.delete(key);
    const follower = memory.users.get(String(followerId));
    const followed = memory.users.get(String(followedId));
    follower.followingCount = Math.max(0, follower.followingCount - 1);
    followed.followerCount = Math.max(0, followed.followerCount - 1);
  }
  return enabled;
};

export const isFollowing = async (followerId, followedId) => {
  if (!followerId || !followedId) return false;
  if (config.storageMode === 'mongodb') return Boolean(await Follow.exists({ follower: followerId, followed: followedId }));
  return memory.follows.has(followKey(followerId, followedId));
};

export const getFollowingIds = async (userId) => {
  if (config.storageMode === 'mongodb') {
    return (await Follow.find({ follower: userId }).select('followed').lean()).map((item) => comparableId(item.followed));
  }
  return [...memory.follows.values()].filter((item) => item.follower === String(userId)).map((item) => item.followed);
};

export const listRelationshipUsers = async (userId, direction, { offset = 0, limit = 30 } = {}) => {
  if (config.storageMode === 'mongodb') {
    const filter = direction === 'followers' ? { followed: userId } : { follower: userId };
    const populatePath = direction === 'followers' ? 'follower' : 'followed';
    const rows = await Follow.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit + 1)
      .populate(populatePath, 'fullName username gender bio profileImageFileId followerCount followingCount').lean();
    return rows.map((row) => asPlainUser(row[populatePath]));
  }
  const rows = [...memory.follows.values()]
    .filter((item) => direction === 'followers' ? item.followed === String(userId) : item.follower === String(userId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return rows.slice(offset, offset + limit + 1).map((item) => {
    const id = direction === 'followers' ? item.follower : item.followed;
    const user = clone(memory.users.get(id));
    delete user.passwordHash;
    return user;
  });
};

export const createPost = async (data) => {
  if (config.storageMode === 'mongodb') {
    const created = await Post.create(data);
    return getPostById(created._id);
  }
  const date = nowIso();
  const post = {
    id: makeId(), ...clone(data), hugCount: 0, throwCount: 0, viewCount: 0,
    deletedAt: null, createdAt: date, updatedAt: date
  };
  memory.posts.set(post.id, post);
  return hydrateMemoryPost(post);
};

const hydrateMemoryPost = (post) => {
  if (!post) return null;
  const value = clone(post);
  const author = clone(memory.users.get(String(value.author)));
  if (author) delete author.passwordHash;
  value.author = author;
  return value;
};

export const getPostById = async (id) => {
  if (config.storageMode === 'mongodb') {
    if (!mongoose.isValidObjectId(id)) return null;
    const post = await Post.findOne({ _id: id, deletedAt: null })
      .populate('author', 'fullName username gender bio profileImageFileId followerCount followingCount').lean();
    return asPlainPost(post);
  }
  const post = memory.posts.get(String(id));
  return post && !post.deletedAt ? hydrateMemoryPost(post) : null;
};

export const softDeletePost = async (id, authorId) => {
  if (config.storageMode === 'mongodb') {
    const post = await Post.findOneAndUpdate(
      { _id: id, author: authorId, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { new: true }
    ).lean();
    return Boolean(post);
  }
  const post = memory.posts.get(String(id));
  if (!post || post.author !== String(authorId) || post.deletedAt) return false;
  post.deletedAt = nowIso();
  return true;
};

export const listPostsByAuthor = async (authorId, { before, limit = 12, type } = {}) => {
  if (config.storageMode === 'mongodb') {
    const filter = { author: authorId, deletedAt: null };
    if (type && type !== 'all') filter.type = type;
    if (before?.createdAt) {
      filter.$or = [
        { createdAt: { $lt: new Date(before.createdAt) } },
        { createdAt: new Date(before.createdAt), _id: { $lt: before.id } }
      ];
    }
    const posts = await Post.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit + 1)
      .populate('author', 'fullName username gender bio profileImageFileId followerCount followingCount').lean();
    return posts.map(asPlainPost);
  }
  return [...memory.posts.values()]
    .filter((post) => !post.deletedAt && post.author === String(authorId) && (!type || type === 'all' || post.type === type))
    .filter((post) => !before?.createdAt || post.createdAt < before.createdAt || (post.createdAt === before.createdAt && post.id < before.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    .slice(0, limit + 1).map(hydrateMemoryPost);
};

export const listFeedCandidates = async ({ authorIds, before, limit }) => {
  if (config.storageMode === 'mongodb') {
    const filter = { deletedAt: null };
    if (authorIds?.length) filter.author = { $in: authorIds };
    if (before?.createdAt) {
      filter.$or = [
        { createdAt: { $lt: new Date(before.createdAt) } },
        { createdAt: new Date(before.createdAt), _id: { $lt: before.id } }
      ];
    }
    const posts = await Post.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit + 1)
      .populate('author', 'fullName username gender bio profileImageFileId followerCount followingCount').lean();
    return posts.map(asPlainPost);
  }
  return [...memory.posts.values()]
    .filter((post) => !post.deletedAt && (!authorIds?.length || authorIds.includes(post.author)))
    .filter((post) => !before?.createdAt || post.createdAt < before.createdAt || (post.createdAt === before.createdAt && post.id < before.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    .slice(0, limit + 1).map(hydrateMemoryPost);
};

export const reactionForPosts = async (userId, postIds) => {
  if (!userId || !postIds.length) return {};
  if (config.storageMode === 'mongodb') {
    const rows = await Reaction.find({ user: userId, post: { $in: postIds } }).lean();
    return Object.fromEntries(rows.map((row) => [comparableId(row.post), row.kind]));
  }
  return Object.fromEntries(postIds.map((postId) => [postId, memory.reactions.get(reactionKey(userId, postId))?.kind]).filter(([, value]) => value));
};

export const setReaction = async (userId, postId, nextKind) => {
  const post = await getPostById(postId);
  if (!post) throw new AppError(404, 'Post not found', 'POST_NOT_FOUND');

  if (config.storageMode === 'mongodb') {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const previous = await Reaction.findOne({ user: userId, post: postId }).session(session).lean();
        const previousKind = previous?.kind || null;
        if (previousKind === nextKind) return;

        if (nextKind) {
          await Reaction.updateOne(
            { user: userId, post: postId },
            { $set: { kind: nextKind }, $setOnInsert: { user: userId, post: postId } },
            { upsert: true, session }
          );
        } else {
          await Reaction.deleteOne({ user: userId, post: postId }).session(session);
        }

        const increments = {};
        if (previousKind) increments[`${previousKind}Count`] = -1;
        if (nextKind) increments[`${nextKind}Count`] = (increments[`${nextKind}Count`] || 0) + 1;
        if (Object.keys(increments).length) {
          await Post.updateOne({ _id: postId }, { $inc: increments }, { session });
        }

        const preferenceDelta = (nextKind === 'hug' ? 1 : nextKind === 'throw' ? -0.3 : 0)
          - (previousKind === 'hug' ? 1 : previousKind === 'throw' ? -0.3 : 0);
        if (preferenceDelta) {
          await User.updateOne(
            { _id: userId },
            { $inc: { [`typePreferences.${post.type}`]: preferenceDelta } },
            { session }
          );
        }
      });
    } finally {
      await session.endSession();
    }
    return { post: await getPostById(postId), reaction: nextKind };
  }

  const key = reactionKey(userId, postId);
  const previousKind = memory.reactions.get(key)?.kind || null;
  const rawPost = memory.posts.get(String(postId));
  if (previousKind && previousKind !== nextKind) rawPost[`${previousKind}Count`] = Math.max(0, rawPost[`${previousKind}Count`] - 1);
  if (nextKind && previousKind !== nextKind) rawPost[`${nextKind}Count`] += 1;
  if (nextKind) memory.reactions.set(key, { user: userId, post: postId, kind: nextKind, updatedAt: nowIso() });
  else memory.reactions.delete(key);
  const user = memory.users.get(String(userId));
  if (user && previousKind !== nextKind) {
    const delta = (nextKind === 'hug' ? 1 : nextKind === 'throw' ? -0.3 : 0)
      - (previousKind === 'hug' ? 1 : previousKind === 'throw' ? -0.3 : 0);
    user.typePreferences[rawPost.type] += delta;
  }
  return { post: hydrateMemoryPost(rawPost), reaction: nextKind };
};

export const listComments = async (postId, { limit = 100 } = {}) => {
  const post = await getPostById(postId);
  if (!post) throw new AppError(404, 'Post not found', 'POST_NOT_FOUND');
  if (config.storageMode === 'mongodb') {
    if (!mongoose.isValidObjectId(postId)) return [];
    const rows = await Comment.find({ post: postId }).sort({ createdAt: 1 }).limit(limit)
      .populate('author', 'fullName username gender bio profileImageFileId followerCount followingCount').lean();
    return rows.map(asPlainComment);
  }
  return [...memory.comments.values()]
    .filter((comment) => comment.post === String(postId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, limit)
    .map((comment) => {
      const value = clone(comment);
      value.author = clone(memory.users.get(value.author));
      if (value.author) delete value.author.passwordHash;
      return value;
    });
};

export const createComment = async (postId, authorId, body) => {
  const post = await getPostById(postId);
  if (!post) throw new AppError(404, 'Post not found', 'POST_NOT_FOUND');
  if (config.storageMode === 'mongodb') {
    const created = await Comment.create({ post: postId, author: authorId, body });
    const populated = await Comment.findById(created._id)
      .populate('author', 'fullName username gender bio profileImageFileId followerCount followingCount').lean();
    return asPlainComment(populated);
  }
  const date = nowIso();
  const comment = { id: makeId(), post: String(postId), author: String(authorId), body, createdAt: date, updatedAt: date };
  memory.comments.set(comment.id, comment);
  const value = clone(comment);
  value.author = clone(memory.users.get(String(authorId)));
  if (value.author) delete value.author.passwordHash;
  return value;
};

export const updateComment = async (commentId, authorId, body) => {
  if (config.storageMode === 'mongodb') {
    if (!mongoose.isValidObjectId(commentId)) return null;
    const row = await Comment.findOneAndUpdate(
      { _id: commentId, author: authorId },
      { $set: { body } },
      { new: true, runValidators: true }
    ).populate('author', 'fullName username gender bio profileImageFileId followerCount followingCount').lean();
    return asPlainComment(row);
  }
  const comment = memory.comments.get(String(commentId));
  if (!comment || comment.author !== String(authorId)) return null;
  comment.body = body;
  comment.updatedAt = nowIso();
  const value = clone(comment);
  value.author = clone(memory.users.get(String(authorId)));
  if (value.author) delete value.author.passwordHash;
  return value;
};

export const deleteComment = async (commentId, authorId) => {
  if (config.storageMode === 'mongodb') {
    if (!mongoose.isValidObjectId(commentId)) return false;
    return Boolean(await Comment.findOneAndDelete({ _id: commentId, author: authorId }));
  }
  const comment = memory.comments.get(String(commentId));
  if (!comment || comment.author !== String(authorId)) return false;
  memory.comments.delete(String(commentId));
  return true;
};

export const recordView = async (userId, postId) => {
  if (config.storageMode === 'mongodb') {
    const post = await Post.findOneAndUpdate({ _id: postId, deletedAt: null }, { $inc: { viewCount: 1 } }, { new: true }).lean();
    if (!post) return null;
    if (userId) await User.updateOne({ _id: userId }, { $inc: { [`typePreferences.${post.type}`]: 0.05 } });
    return post.viewCount;
  }
  const post = memory.posts.get(String(postId));
  if (!post || post.deletedAt) return null;
  post.viewCount += 1;
  if (userId && memory.users.has(String(userId))) memory.users.get(String(userId)).typePreferences[post.type] += 0.05;
  return post.viewCount;
};

export const searchCandidates = async ({ query, type, max = 150 }) => {
  const boundedQuery = String(query || '').trim().slice(0, 160);
  const terms = [boundedQuery, ...boundedQuery.split(/\s+/).filter((term) => term.length >= 2)]
    .map((term) => term.slice(0, 80))
    .filter(Boolean)
    .filter((term, index, all) => all.indexOf(term) === index)
    .slice(0, 10);
  const regexes = terms.map((term) => new RegExp(escapeRegex(term), 'i'));
  const regex = regexes[0] || /$a/;
  if (config.storageMode === 'mongodb') {
    const userQuery = { $or: regexes.flatMap((pattern) => [{ username: pattern }, { fullName: pattern }]) };
    const postQuery = {
      deletedAt: null,
      ...(type && type !== 'all' ? { type } : {}),
      $or: regexes.flatMap((pattern) => [{ nameIt: pattern }, { detail: pattern }, { text: pattern }, { links: pattern }])
    };
    const [users, directPosts] = await Promise.all([
      User.find(userQuery).limit(40).lean(),
      Post.find(postQuery).sort({ createdAt: -1 }).limit(max)
        .populate('author', 'fullName username gender bio profileImageFileId followerCount followingCount').lean()
    ]);
    return { users: users.map(asPlainUser), posts: directPosts.map(asPlainPost) };
  }
  const users = [...memory.users.values()].filter((user) => regexes.some((pattern) => pattern.test(user.username) || pattern.test(user.fullName))).slice(0, 40).map((user) => {
    const value = clone(user); delete value.passwordHash; return value;
  });
  const posts = [...memory.posts.values()]
    .filter((post) => !post.deletedAt && (!type || type === 'all' || post.type === type))
    .filter((post) => [post.nameIt, post.detail, post.text, ...(post.links || [])].some((field) => regexes.some((pattern) => pattern.test(field || ''))))
    .slice(0, max).map(hydrateMemoryPost);
  return { users, posts };
};

export const postsByMatchingAuthors = async ({ usernames = [], names = [], type, max = 100 }) => {
  if (!usernames.length && !names.length) return [];
  if (config.storageMode === 'mongodb') {
    const userConditions = [];
    if (usernames.length) userConditions.push({ username: { $in: usernames } });
    if (names.length) userConditions.push(...names.slice(0, 5).map((name) => ({ fullName: new RegExp(escapeRegex(String(name).slice(0, 80)), 'i') })));
    const users = await User.find({ $or: userConditions }).select('_id').lean();
    if (!users.length) return [];
    const filter = { author: { $in: users.map((user) => user._id) }, deletedAt: null };
    if (type && type !== 'all') filter.type = type;
    return (await Post.find(filter).sort({ createdAt: -1 }).limit(max)
      .populate('author', 'fullName username gender bio profileImageFileId followerCount followingCount').lean()).map(asPlainPost);
  }
  const loweredNames = names.map((name) => name.toLowerCase());
  const ids = [...memory.users.values()]
    .filter((user) => usernames.includes(user.username) || loweredNames.some((name) => user.fullName.toLowerCase().includes(name)))
    .map((user) => user.id);
  return [...memory.posts.values()]
    .filter((post) => !post.deletedAt && ids.includes(post.author) && (!type || type === 'all' || post.type === type))
    .slice(0, max).map(hydrateMemoryPost);
};

export const listSitemapEntities = async () => {
  if (config.storageMode === 'mongodb') {
    const [users, posts] = await Promise.all([
      User.find({}).select('username updatedAt').sort({ updatedAt: -1 }).limit(10_000).lean(),
      Post.find({ deletedAt: null }).select('_id updatedAt').sort({ updatedAt: -1 }).limit(39_000).lean()
    ]);
    return {
      users: users.map((user) => ({ username: user.username, updatedAt: user.updatedAt })),
      posts: posts.map((post) => ({ id: comparableId(post), updatedAt: post.updatedAt }))
    };
  }
  return {
    users: [...memory.users.values()].slice(0, 10_000).map((user) => ({ username: user.username, updatedAt: user.updatedAt })),
    posts: [...memory.posts.values()].filter((post) => !post.deletedAt).slice(0, 39_000)
      .map((post) => ({ id: post.id, updatedAt: post.updatedAt }))
  };
};

export const memorySnapshot = () => config.storageMode === 'memory' ? memory : null;
