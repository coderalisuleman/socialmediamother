import { AppError } from './errors.js';

export const encodeCursor = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

export const decodeCursor = (cursor, fallback = null) => {
  if (!cursor) return fallback;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new AppError(400, 'The pagination cursor is invalid', 'INVALID_CURSOR');
  }
};

export const pageLimit = (value, fallback = 12, max = 40) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) ? Math.max(1, Math.min(parsed, max)) : fallback;
};

export async function* inChunks(items, chunkSize = 25) {
  for (let index = 0; index < items.length; index += chunkSize) {
    yield items.slice(index, index + chunkSize);
    await new Promise((resolve) => setImmediate(resolve));
  }
}

export function* windowItems(items, offset = 0, limit = items.length) {
  const end = Math.min(items.length, offset + limit);
  for (let index = offset; index < end; index += 1) yield items[index];
}
