import crypto from 'node:crypto';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import { AppError, assert } from '../utils/errors.js';
import { config } from '../config.js';
import { mongoConnection } from '../db.js';
import { UploadSession } from '../models/UploadSession.js';

export const UPLOAD_CHUNK_BYTES = 2 * 1024 * 1024;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const sessions = new Map();
let partsBucket;
const mongoSessionsEnabled = () => config.storageMode === 'mongodb' && mongoose.connection.readyState === 1;

const cleanName = (value) => String(value || 'upload').replace(/[\r\n"\\/]/g, '_').slice(0, 180);
const chunkPath = (sessionId, fileIndex, chunkIndex) => path.join(os.tmpdir(), `mother-${sessionId}-${fileIndex}-${chunkIndex}.chunk`);
const assembledPath = (sessionId, fileIndex) => path.join(os.tmpdir(), `mother-${sessionId}-${fileIndex}.upload`);
const getPartsBucket = () => {
  if (!partsBucket) partsBucket = new GridFSBucket(mongoConnection().db, { bucketName: 'uploadSessionParts', chunkSizeBytes: 255 * 1024 });
  return partsBucket;
};

const removePaths = async (paths) => Promise.allSettled(paths.filter(Boolean).map((item) => fs.rm(item, { force: true })));

const cleanupExpired = async () => {
  const now = Date.now();
  if (mongoSessionsEnabled()) {
    const expired = await UploadSession.find({ expiresAt: { $lte: new Date(now) } }).limit(100).lean();
    await Promise.all(expired.map(async (session) => {
      await removeMongoParts(session);
      await UploadSession.deleteOne({ _id: session._id });
    }));
    return;
  }
  for (const [id, session] of sessions) {
    if (session.expiresAt > now) continue;
    sessions.delete(id);
    await removePaths([...session.chunkPaths]);
  }
};

const removeMongoParts = async (session) => {
  const ids = (session?.files || []).flatMap((file) => (file.parts || []).map((part) => part.fileId)).filter(Boolean);
  await Promise.allSettled(ids.map((id) => getPartsBucket().delete(new mongoose.Types.ObjectId(id))));
};

const publicSession = (session) => ({
  id: session.sessionId || session.id,
  chunkSize: UPLOAD_CHUNK_BYTES,
  totalBytes: Number(session.totalBytes || 0),
  expiresAt: new Date(session.expiresAt).toISOString(),
  files: (session.files || []).map((file) => ({
    name: file.name,
    type: file.type,
    size: Number(file.size),
    receivedChunks: mongoSessionsEnabled()
      ? (file.parts || []).map((part) => Number(part.index)).sort((a, b) => a - b)
      : [...file.received].sort((a, b) => a - b),
  })),
});

const ownedSession = (sessionId, ownerId) => {
  const session = sessions.get(String(sessionId));
  if (!session || String(session.ownerId) !== String(ownerId)) throw new AppError(404, 'Upload session not found', 'UPLOAD_SESSION_NOT_FOUND');
  if (session.expiresAt <= Date.now()) {
    sessions.delete(session.id);
    removePaths([...session.chunkPaths]).catch(() => {});
    throw new AppError(410, 'This paused upload expired. Start it again.', 'UPLOAD_SESSION_EXPIRED');
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return session;
};

const ownedMongoSession = async (sessionId, ownerId) => {
  const session = await UploadSession.findOne({ sessionId: String(sessionId), ownerId });
  if (!session) throw new AppError(404, 'Upload session not found', 'UPLOAD_SESSION_NOT_FOUND');
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    await removeMongoParts(session);
    await UploadSession.deleteOne({ _id: session._id });
    throw new AppError(410, 'This saved upload expired. Its selected files are still in your draft.', 'UPLOAD_SESSION_EXPIRED');
  }
  session.expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await session.save();
  return session;
};

export const createUploadSession = async (ownerId, requestedFiles) => {
  await cleanupExpired();
  assert(Array.isArray(requestedFiles) && requestedFiles.length >= 1, 422, 'Choose at least one file', 'MEDIA_REQUIRED');
  assert(requestedFiles.length <= config.maxFilesPerPost, 413, `Choose at most ${config.maxFilesPerPost} files`, 'TOO_MANY_FILES');
  const files = requestedFiles.map((file, index) => {
    const size = Number(file?.size || 0);
    assert(Number.isSafeInteger(size) && size > 0, 422, `File ${index + 1} has an invalid size`, 'INVALID_FILE_SIZE');
    assert(size <= config.maxUploadBytes, 413, `File ${index + 1} is too large`, 'UPLOAD_TOO_LARGE');
    return {
      name: cleanName(file?.name),
      type: String(file?.type || 'application/octet-stream').slice(0, 120),
      size,
      totalChunks: Math.ceil(size / UPLOAD_CHUNK_BYTES),
      received: new Set(),
    };
  });
  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  assert(totalBytes <= config.maxUploadBytes, 413,
    `A post can contain at most ${Math.floor(config.maxUploadBytes / 1024 / 1024)} MB in total`, 'UPLOAD_TOO_LARGE');

  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  if (mongoSessionsEnabled()) {
    const session = await UploadSession.create({
      sessionId: id,
      ownerId,
      files: files.map(({ received: _received, ...file }) => ({ ...file, parts: [] })),
      totalBytes,
      expiresAt,
    });
    return publicSession(session);
  }
  const session = {
    id,
    ownerId: String(ownerId),
    files,
    totalBytes,
    chunkPaths: new Set(),
    createdAt: Date.now(),
    expiresAt: expiresAt.getTime(),
  };
  sessions.set(id, session);
  return publicSession(session);
};

export const getUploadSession = async (sessionId, ownerId) => {
  const session = mongoSessionsEnabled()
    ? await ownedMongoSession(sessionId, ownerId)
    : ownedSession(sessionId, ownerId);
  return publicSession(session);
};

export const storeUploadChunk = async ({ sessionId, ownerId, fileIndex, chunkIndex, data }) => {
  const session = mongoSessionsEnabled()
    ? await ownedMongoSession(sessionId, ownerId)
    : ownedSession(sessionId, ownerId);
  const file = session.files[fileIndex];
  assert(file, 404, 'Upload file not found', 'UPLOAD_FILE_NOT_FOUND');
  assert(Number.isInteger(chunkIndex) && chunkIndex >= 0 && chunkIndex < file.totalChunks, 422, 'Invalid upload piece', 'INVALID_UPLOAD_CHUNK');
  const expectedBytes = Math.min(UPLOAD_CHUNK_BYTES, file.size - chunkIndex * UPLOAD_CHUNK_BYTES);
  assert(Buffer.isBuffer(data) && data.length === expectedBytes, 422, 'The upload piece has the wrong size', 'INVALID_UPLOAD_CHUNK_SIZE');
  if (mongoSessionsEnabled()) {
    if (!(file.parts || []).some((part) => Number(part.index) === chunkIndex)) {
      const upload = getPartsBucket().openUploadStream(`${session.sessionId}-${fileIndex}-${chunkIndex}.part`, {
        contentType: 'application/octet-stream',
        metadata: { sessionId: session.sessionId, ownerId: session.ownerId, fileIndex, chunkIndex },
      });
      upload.end(data);
      await new Promise((resolve, reject) => {
        upload.once('finish', resolve);
        upload.once('error', reject);
      });
      file.parts.push({ index: chunkIndex, fileId: upload.id });
      await session.save();
    }
  } else if (!file.received.has(chunkIndex)) {
    const destination = chunkPath(session.id, fileIndex, chunkIndex);
    await fs.writeFile(destination, data, { flag: 'wx' }).catch(async (error) => {
      if (error.code !== 'EEXIST') throw error;
      await fs.writeFile(destination, data);
    });
    session.chunkPaths.add(destination);
    file.received.add(chunkIndex);
  }
  const receivedBytes = session.files.reduce((total, item) => {
    const indexes = mongoSessionsEnabled() ? (item.parts || []).map((part) => Number(part.index)) : [...item.received];
    return total + indexes.reduce((sum, index) => sum + Math.min(UPLOAD_CHUNK_BYTES, item.size - index * UPLOAD_CHUNK_BYTES), 0);
  }, 0);
  return { receivedBytes, totalBytes: session.totalBytes };
};

export const assembleUploadSession = async (sessionId, ownerId) => {
  const session = mongoSessionsEnabled()
    ? await ownedMongoSession(sessionId, ownerId)
    : ownedSession(sessionId, ownerId);
  assert(session.files.every((file) => (mongoSessionsEnabled() ? file.parts.length : file.received.size) === file.totalChunks), 409, 'The upload is not complete yet', 'UPLOAD_INCOMPLETE');
  const assembled = [];
  try {
    for (let fileIndex = 0; fileIndex < session.files.length; fileIndex += 1) {
      const file = session.files[fileIndex];
      const destination = assembledPath(session.id, fileIndex);
      await fs.writeFile(destination, Buffer.alloc(0));
      for (let chunkIndex = 0; chunkIndex < file.totalChunks; chunkIndex += 1) {
        if (mongoSessionsEnabled()) {
          const part = file.parts.find((item) => Number(item.index) === chunkIndex);
          await pipeline(getPartsBucket().openDownloadStream(part.fileId), fsSync.createWriteStream(destination, { flags: 'a' }));
        } else {
          await fs.appendFile(destination, await fs.readFile(chunkPath(session.id, fileIndex, chunkIndex)));
        }
      }
      assembled.push({
        path: destination,
        originalname: file.name,
        mimetype: file.type,
        size: file.size,
      });
    }
    return assembled;
  } catch (error) {
    await removePaths(assembled.map((file) => file.path));
    throw error;
  }
};

export const cancelUploadSession = async (sessionId, ownerId) => {
  if (mongoSessionsEnabled()) {
    const session = await UploadSession.findOne({ sessionId: String(sessionId), ownerId });
    if (!session) return false;
    await removeMongoParts(session);
    await UploadSession.deleteOne({ _id: session._id });
    return true;
  }
  const session = sessions.get(String(sessionId));
  if (!session || String(session.ownerId) !== String(ownerId)) return false;
  sessions.delete(session.id);
  await removePaths([...session.chunkPaths]);
  return true;
};
