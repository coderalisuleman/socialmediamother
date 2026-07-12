import express from 'express';
import { promises as fsPromises } from 'node:fs';
import { asyncHandler, AppError, assert } from '../utils/errors.js';
import { decodeCursor, encodeCursor, pageLimit } from '../utils/cursor.js';
import { cleanUsername } from '../utils/normalize.js';
import {
  findUserByIdentifier, findUserById, isFollowing, listPostsByAuthor,
  listRelationshipUsers, setFollowing, updateUser
} from '../services/store.js';
import { privateUser, publicPost, publicUser } from '../services/serializers.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { deleteFile, saveUploadedFile } from '../services/files.js';
import { hasValidMediaSignature } from '../utils/media.js';

export const usersRouter = express.Router();
const allowedProfileImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

const userFromParam = async (value) => {
  let username;
  try { username = cleanUsername(value); } catch { return null; }
  const user = await findUserByIdentifier(username);
  return user?.username === username ? user : null;
};

usersRouter.patch('/me', requireAuth, asyncHandler(async (req, res) => {
  const changes = {};
  if ('fullName' in req.body) {
    assert(typeof req.body.fullName === 'string' && req.body.fullName.trim().length >= 1 && req.body.fullName.trim().length <= 100,
      422, 'Full name must be 1–100 characters', 'INVALID_FULL_NAME');
    changes.fullName = req.body.fullName.trim();
  }
  if ('bio' in req.body) {
    assert(typeof req.body.bio === 'string' && req.body.bio.length <= 500, 422, 'Bio must be at most 500 characters', 'INVALID_BIO');
    changes.bio = req.body.bio.trim();
  }
  if ('gender' in req.body) {
    assert(['female', 'male', 'other', 'prefer-not-to-say'].includes(req.body.gender), 422, 'Choose a valid gender', 'INVALID_GENDER');
    changes.gender = req.body.gender;
  }
  const user = await updateUser(req.user.id, changes);
  res.json({ user: privateUser(user) });
}));

usersRouter.post('/me/profile-image', requireAuth, upload.single('image'), asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError(422, 'Choose an image to upload', 'IMAGE_REQUIRED');
  if (!allowedProfileImageTypes.has(req.file.mimetype)) {
    await fsPromises.rm(req.file.path, { force: true });
    throw new AppError(422, 'Profile photo must be an image', 'INVALID_IMAGE_TYPE');
  }
  if (!await hasValidMediaSignature(req.file)) {
    await fsPromises.rm(req.file.path, { force: true });
    throw new AppError(415, 'Profile photo does not match its declared image type', 'INVALID_IMAGE_SIGNATURE');
  }
  const saved = await saveUploadedFile(req.file, { ownerId: req.user.id, purpose: 'profile-image' });
  const oldFileId = req.user.profileImageFileId;
  try {
    const user = await updateUser(req.user.id, { profileImageFileId: saved.fileId });
    if (oldFileId) await deleteFile(oldFileId).catch(() => {});
    res.status(201).json({ user: privateUser(user) });
  } catch (error) {
    await deleteFile(saved.fileId).catch(() => {});
    throw error;
  }
}));

usersRouter.delete('/me/profile-image', requireAuth, asyncHandler(async (req, res) => {
  const oldFileId = req.user.profileImageFileId;
  const user = await updateUser(req.user.id, { profileImageFileId: null });
  if (oldFileId) await deleteFile(oldFileId).catch(() => {});
  res.json({ user: privateUser(user) });
}));

usersRouter.get('/:username', optionalAuth, asyncHandler(async (req, res) => {
  const user = await userFromParam(req.params.username);
  if (!user) throw new AppError(404, 'Person not found', 'USER_NOT_FOUND');
  const viewerFollows = await isFollowing(req.user?.id, user.id);
  res.json({ user: publicUser(user, { viewerFollows }) });
}));

usersRouter.get('/:username/posts', optionalAuth, asyncHandler(async (req, res) => {
  const user = await userFromParam(req.params.username);
  if (!user) throw new AppError(404, 'Person not found', 'USER_NOT_FOUND');
  const limit = pageLimit(req.query.limit);
  const cursor = decodeCursor(req.query.cursor);
  const rows = await listPostsByAuthor(user.id, { before: cursor, limit, type: req.query.type });
  const hasMore = rows.length > limit;
  const posts = rows.slice(0, limit);
  const tail = posts.at(-1);
  const viewerFollows = await isFollowing(req.user?.id, user.id);
  res.json({
    user: publicUser(user, { viewerFollows }),
    posts: posts.map((post) => publicPost(post, { viewerFollowsAuthor: viewerFollows })),
    nextCursor: hasMore && tail ? encodeCursor({ createdAt: tail.createdAt, id: tail.id }) : null
  });
}));

const relationshipHandler = async (req, res) => {
  const target = await userFromParam(req.params.username);
  if (!target) throw new AppError(404, 'Person not found', 'USER_NOT_FOUND');
  const enabled = req.method === 'DELETE' ? false
    : req.body?.state ? req.body.state === 'want-to-be-with'
      : req.body?.wantsToBeWith !== false;
  await setFollowing(req.user.id, target.id, enabled);
  const refreshed = await findUserById(target.id);
  const me = await findUserById(req.user.id);
  res.json({
    viewerWantsToBeWithThem: enabled,
    person: publicUser(refreshed, { viewerFollows: enabled }),
    me: privateUser(me)
  });
};

usersRouter.put('/:username/relationship', requireAuth, asyncHandler(relationshipHandler));
usersRouter.post('/:username/follow', requireAuth, asyncHandler(relationshipHandler));
usersRouter.delete('/:username/follow', requireAuth, asyncHandler(relationshipHandler));

const listRelationships = (direction) => asyncHandler(async (req, res) => {
  const user = await userFromParam(req.params.username);
  if (!user) throw new AppError(404, 'Person not found', 'USER_NOT_FOUND');
  const limit = pageLimit(req.query.limit, 30, 50);
  const { offset = 0 } = decodeCursor(req.query.cursor, {});
  const rows = await listRelationshipUsers(user.id, direction, { offset, limit });
  const hasMore = rows.length > limit;
  res.json({
    people: rows.slice(0, limit).map((item) => publicUser(item)),
    nextCursor: hasMore ? encodeCursor({ offset: offset + limit }) : null,
    count: direction === 'followers' ? Number(user.followerCount || 0) : Number(user.followingCount || 0)
  });
});

usersRouter.get('/:username/people-who-want-to-be-with-me', optionalAuth, listRelationships('followers'));
usersRouter.get('/:username/people-i-want-to-be-with', optionalAuth, listRelationships('following'));
