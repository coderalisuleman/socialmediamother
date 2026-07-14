import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { AppError, assert } from '../utils/errors.js';
import { config } from '../config.js';

export const UPLOAD_CHUNK_BYTES = 2 * 1024 * 1024;
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const sessions = new Map();

const cleanName = (value) => String(value || 'upload').replace(/[\r\n"\\/]/g, '_').slice(0, 180);
const chunkPath = (sessionId, fileIndex, chunkIndex) => path.join(os.tmpdir(), `mother-${sessionId}-${fileIndex}-${chunkIndex}.chunk`);
const assembledPath = (sessionId, fileIndex) => path.join(os.tmpdir(), `mother-${sessionId}-${fileIndex}.upload`);

const removePaths = async (paths) => Promise.allSettled(paths.filter(Boolean).map((item) => fs.rm(item, { force: true })));

const cleanupExpired = async () => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (session.expiresAt > now) continue;
    sessions.delete(id);
    await removePaths([...session.chunkPaths]);
  }
};

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
  const session = {
    id,
    ownerId: String(ownerId),
    files,
    totalBytes,
    chunkPaths: new Set(),
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  sessions.set(id, session);
  return { id, chunkSize: UPLOAD_CHUNK_BYTES, totalBytes, expiresAt: new Date(session.expiresAt).toISOString() };
};

export const storeUploadChunk = async ({ sessionId, ownerId, fileIndex, chunkIndex, data }) => {
  const session = ownedSession(sessionId, ownerId);
  const file = session.files[fileIndex];
  assert(file, 404, 'Upload file not found', 'UPLOAD_FILE_NOT_FOUND');
  assert(Number.isInteger(chunkIndex) && chunkIndex >= 0 && chunkIndex < file.totalChunks, 422, 'Invalid upload piece', 'INVALID_UPLOAD_CHUNK');
  const expectedBytes = Math.min(UPLOAD_CHUNK_BYTES, file.size - chunkIndex * UPLOAD_CHUNK_BYTES);
  assert(Buffer.isBuffer(data) && data.length === expectedBytes, 422, 'The upload piece has the wrong size', 'INVALID_UPLOAD_CHUNK_SIZE');
  if (!file.received.has(chunkIndex)) {
    const destination = chunkPath(session.id, fileIndex, chunkIndex);
    await fs.writeFile(destination, data, { flag: 'wx' }).catch(async (error) => {
      if (error.code !== 'EEXIST') throw error;
      await fs.writeFile(destination, data);
    });
    session.chunkPaths.add(destination);
    file.received.add(chunkIndex);
  }
  const receivedBytes = session.files.reduce((total, item) => total + [...item.received]
    .reduce((sum, index) => sum + Math.min(UPLOAD_CHUNK_BYTES, item.size - index * UPLOAD_CHUNK_BYTES), 0), 0);
  return { receivedBytes, totalBytes: session.totalBytes };
};

export const assembleUploadSession = async (sessionId, ownerId) => {
  const session = ownedSession(sessionId, ownerId);
  assert(session.files.every((file) => file.received.size === file.totalChunks), 409, 'The upload is not complete yet', 'UPLOAD_INCOMPLETE');
  const assembled = [];
  try {
    for (let fileIndex = 0; fileIndex < session.files.length; fileIndex += 1) {
      const file = session.files[fileIndex];
      const destination = assembledPath(session.id, fileIndex);
      await fs.writeFile(destination, Buffer.alloc(0));
      for (let chunkIndex = 0; chunkIndex < file.totalChunks; chunkIndex += 1) {
        await fs.appendFile(destination, await fs.readFile(chunkPath(session.id, fileIndex, chunkIndex)));
      }
      assembled.push({
        path: destination,
        originalname: file.name,
        mimetype: file.type,
        size: file.size,
      });
    }
    sessions.delete(session.id);
    await removePaths([...session.chunkPaths]);
    return assembled;
  } catch (error) {
    await removePaths(assembled.map((file) => file.path));
    throw error;
  }
};

export const cancelUploadSession = async (sessionId, ownerId) => {
  const session = sessions.get(String(sessionId));
  if (!session || String(session.ownerId) !== String(ownerId)) return false;
  sessions.delete(session.id);
  await removePaths([...session.chunkPaths]);
  return true;
};
