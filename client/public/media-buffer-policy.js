export const MEDIA_BUFFER_CACHE_PREFIX = 'mother-media-buffer-';
export const MEDIA_BUFFER_CACHE_NAME = `${MEDIA_BUFFER_CACHE_PREFIX}v1`;
export const MEDIA_BUFFER_CHUNK_BYTES = 1024 * 1024;
export const MEDIA_BUFFER_MAX_BYTES = 48 * 1024 * 1024;
export const MEDIA_BUFFER_MAX_ENTRIES = 96;
export const MEDIA_BUFFER_CACHE_PARAMETER = '__mother_media_chunk';

export function parseByteRange(header) {
  const match = /^bytes=(\d+)-(\d*)$/i.exec(String(header || '').trim());
  if (!match) return null;
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : null;
  if (!Number.isSafeInteger(start) || start < 0) return null;
  if (end != null && (!Number.isSafeInteger(end) || end < start)) return null;
  return { start, end };
}

export function boundByteRange(range, chunkBytes = MEDIA_BUFFER_CHUNK_BYTES) {
  if (!range || !Number.isSafeInteger(chunkBytes) || chunkBytes < 1) return null;
  const chunkEnd = range.start + chunkBytes - 1;
  return {
    start: range.start,
    end: range.end == null ? chunkEnd : Math.min(range.end, chunkEnd),
  };
}

export function parseContentRange(header) {
  const match = /^bytes\s+(\d+)-(\d+)\/(\d+|\*)$/i.exec(String(header || '').trim());
  if (!match || match[3] === '*') return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  const total = Number(match[3]);
  if (![start, end, total].every(Number.isSafeInteger) || start < 0 || end < start || total <= end) return null;
  return { start, end, total };
}

export function mediaChunkCacheUrl(sourceUrl, start, end) {
  const url = new URL(sourceUrl);
  url.searchParams.set(MEDIA_BUFFER_CACHE_PARAMETER, `${start}-${end}`);
  return url.href;
}

export function parseMediaChunkCacheUrl(cacheUrl) {
  try {
    const url = new URL(cacheUrl);
    const range = /^(\d+)-(\d+)$/.exec(url.searchParams.get(MEDIA_BUFFER_CACHE_PARAMETER) || '');
    if (!range) return null;
    const start = Number(range[1]);
    const end = Number(range[2]);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end < start) return null;
    url.searchParams.delete(MEDIA_BUFFER_CACHE_PARAMETER);
    return { sourceUrl: url.href, start, end };
  } catch {
    return null;
  }
}

export function cachedChunkCanServe(chunk, sourceUrl, requestedStart) {
  if (!chunk || !Number.isSafeInteger(requestedStart)) return false;
  try {
    return chunk.sourceUrl === new URL(sourceUrl).href
      && chunk.start <= requestedStart
      && chunk.end >= requestedStart;
  } catch {
    return false;
  }
}
