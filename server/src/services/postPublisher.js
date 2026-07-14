import { promises as fsPromises } from 'node:fs';
import { AppError, assert } from '../utils/errors.js';
import { cleanLinks } from '../utils/normalize.js';
import { inChunks } from '../utils/cursor.js';
import { createPost } from './store.js';
import { removeFiles, saveUploadedFile } from './files.js';
import { config } from '../config.js';
import { hasValidMediaSignature } from '../utils/media.js';

const validTypes = ['text', 'photo', 'video', 'short-video'];
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']);
const allowedVideoTypes = new Set(['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-matroska']);

export const cleanupTemporaryFiles = async (files = []) => {
  await Promise.allSettled(files.map((file) => file?.path && fsPromises.rm(file.path, { force: true })));
};

export const publishPostFiles = async ({ files = [], body = {}, userId }) => {
  const type = body.type;
  try {
    const aggregateBytes = files.reduce((total, file) => total + Number(file.size || 0), 0);
    assert(aggregateBytes <= config.maxUploadBytes, 413,
      `A post can contain at most ${Math.floor(config.maxUploadBytes / 1024 / 1024)} MB in total`, 'UPLOAD_TOO_LARGE');
    assert(validTypes.includes(type), 422, 'type must be text, photo, video, or short-video', 'INVALID_POST_TYPE');
    const text = String(body.text || '').trim();
    const nameIt = String(body.nameIt || '').trim();
    const detail = String(body.detail || '').trim();
    assert(text.length <= 20_000, 422, 'Text must be at most 20,000 characters', 'TEXT_TOO_LONG');
    assert(nameIt.length <= 200, 422, 'nameIt must be at most 200 characters', 'NAME_TOO_LONG');
    assert(detail.length <= 5_000, 422, 'Detail must be at most 5,000 characters', 'DETAIL_TOO_LONG');
    if (type === 'text') {
      assert(text.length > 0, 422, 'Write some text before posting', 'TEXT_REQUIRED');
      assert(files.length === 0, 422, 'Text posts cannot contain media files', 'UNEXPECTED_MEDIA');
    } else {
      assert(nameIt.length > 0, 422, 'nameIt is required for photo and video posts', 'NAME_REQUIRED');
      assert(files.length > 0, 422, 'Choose at least one file', 'MEDIA_REQUIRED');
      const allowedTypes = type === 'photo' ? allowedImageTypes : allowedVideoTypes;
      assert(files.every((file) => allowedTypes.has(file.mimetype)), 415,
        `${type === 'photo' ? 'Photo' : 'Video'} posts contain an unsupported file type`, 'INVALID_MEDIA_TYPE');
      const signatures = await Promise.all(files.map(hasValidMediaSignature));
      assert(signatures.every(Boolean), 415, 'A file does not match its declared media type', 'INVALID_MEDIA_SIGNATURE');
    }

    let altTexts = [];
    if (body.altTexts) {
      try { altTexts = typeof body.altTexts === 'string' ? JSON.parse(body.altTexts) : body.altTexts; } catch { throw new AppError(422, 'altTexts must be a JSON array', 'INVALID_ALT_TEXT'); }
      assert(Array.isArray(altTexts), 422, 'altTexts must be an array', 'INVALID_ALT_TEXT');
    }

    const saved = [];
    try {
      for await (const chunk of inChunks(files, 2)) {
        const batch = await Promise.all(chunk.map((file) => saveUploadedFile(file, { ownerId: userId, purpose: 'post' })));
        saved.push(...batch);
      }
      const media = saved.map((file, order) => ({ ...file, order, alt: String(altTexts[order] || '').slice(0, 300) }));
      return await createPost({
        author: userId, type, text, nameIt, detail,
        links: cleanLinks(body.links), media
      });
    } catch (error) {
      await removeFiles(saved.map((file) => file.fileId));
      throw error;
    }
  } finally {
    await cleanupTemporaryFiles(files);
  }
};
