import fs from 'node:fs';
import { promises as fsPromises } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import { config } from '../config.js';
import { mongoConnection } from '../db.js';
import { AppError } from '../utils/errors.js';

const memoryFiles = new Map();
let bucket;

const getBucket = () => {
  if (!bucket) bucket = new GridFSBucket(mongoConnection().db, { bucketName: 'uploads', chunkSizeBytes: 255 * 1024 });
  return bucket;
};

const normalizeName = (name) => String(name || 'upload').replace(/[\r\n"\\]/g, '_').slice(0, 180);

export const saveUploadedFile = async (file, { ownerId, purpose = 'post' } = {}) => {
  if (!file?.path) throw new AppError(422, 'No uploaded file was received', 'FILE_REQUIRED');
  const filename = normalizeName(file.originalname);
  try {
    if (config.storageMode === 'mongodb') {
      const upload = getBucket().openUploadStream(filename, {
        contentType: file.mimetype || 'application/octet-stream',
        metadata: { ownerId: new mongoose.Types.ObjectId(ownerId), purpose }
      });
      await pipeline(fs.createReadStream(file.path), upload);
      return {
        fileId: String(upload.id), filename, contentType: file.mimetype || 'application/octet-stream', size: file.size
      };
    }

    const id = new mongoose.Types.ObjectId().toString();
    const chunks = [];
    for await (const chunk of fs.createReadStream(file.path, { highWaterMark: 255 * 1024 })) {
      chunks.push(chunk);
      await new Promise((resolve) => setImmediate(resolve));
    }
    const data = Buffer.concat(chunks);
    memoryFiles.set(id, {
      id, filename, contentType: file.mimetype || 'application/octet-stream', size: data.length,
      data, ownerId: String(ownerId), purpose, uploadDate: new Date()
    });
    return { fileId: id, filename, contentType: file.mimetype || 'application/octet-stream', size: data.length };
  } finally {
    await fsPromises.rm(file.path, { force: true }).catch(() => {});
  }
};

export const deleteFile = async (fileId) => {
  if (!fileId) return;
  if (config.storageMode === 'mongodb') {
    if (!mongoose.isValidObjectId(fileId)) return;
    await getBucket().delete(new mongoose.Types.ObjectId(fileId)).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
    return;
  }
  memoryFiles.delete(String(fileId));
};

export const getFileInfo = async (fileId) => {
  if (config.storageMode === 'mongodb') {
    if (!mongoose.isValidObjectId(fileId)) return null;
    const row = await mongoConnection().db.collection('uploads.files').findOne({ _id: new mongoose.Types.ObjectId(fileId) });
    return row ? {
      id: String(row._id), filename: row.filename, contentType: row.contentType || 'application/octet-stream',
      size: row.length, uploadDate: row.uploadDate, ownerId: row.metadata?.ownerId ? String(row.metadata.ownerId) : null,
      purpose: row.metadata?.purpose
    } : null;
  }
  const row = memoryFiles.get(String(fileId));
  if (!row) return null;
  const { data: _data, ...info } = row;
  return info;
};

const parseRange = (header, size) => {
  if (!header) return null;
  if (header.includes(',')) throw new AppError(416, 'Multiple byte ranges are not supported', 'INVALID_RANGE');
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2])) throw new AppError(416, 'Invalid byte range', 'INVALID_RANGE');
  let start;
  let end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= size) {
    throw new AppError(416, 'Requested byte range is outside the file', 'RANGE_NOT_SATISFIABLE');
  }
  return { start, end: Math.min(end, size - 1) };
};

export const streamFile = async (req, res) => {
  const info = await getFileInfo(req.params.fileId);
  if (!info) throw new AppError(404, 'File not found', 'FILE_NOT_FOUND');
  let range;
  try {
    range = parseRange(req.get('range'), info.size);
  } catch (error) {
    res.set('Content-Range', `bytes */${info.size}`);
    throw error;
  }

  const start = range?.start ?? 0;
  const end = range?.end ?? info.size - 1;
  const length = end - start + 1;
  res.status(range ? 206 : 200);
  res.set({
    'Accept-Ranges': 'bytes',
    'Content-Type': info.contentType,
    'Content-Length': String(length),
    // Avoid invalid response headers for perfectly valid Arabic/CJK/emoji filenames.
    'Content-Disposition': 'inline',
    'Cache-Control': 'public, max-age=31536000, immutable',
    ETag: `"${info.id}-${info.size}"`,
    ...(range ? { 'Content-Range': `bytes ${start}-${end}/${info.size}` } : {})
  });
  if (req.method === 'HEAD') return res.end();

  if (config.storageMode === 'mongodb') {
    const stream = getBucket().openDownloadStream(new mongoose.Types.ObjectId(info.id), { start, end: end + 1 });
    stream.on('error', (error) => res.destroy(error));
    stream.pipe(res);
  } else {
    res.end(memoryFiles.get(String(info.id)).data.subarray(start, end + 1));
  }
};

export const removeFiles = async (ids) => {
  await Promise.allSettled(ids.filter(Boolean).map(deleteFile));
};
