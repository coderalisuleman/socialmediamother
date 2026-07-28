import {
  MEDIA_BUFFER_CACHE_NAME,
  MEDIA_BUFFER_CACHE_PREFIX,
  MEDIA_BUFFER_MAX_BYTES,
  MEDIA_BUFFER_MAX_ENTRIES,
  boundByteRange,
  cachedChunkCanServe,
  mediaChunkCacheUrl,
  parseByteRange,
  parseContentRange,
  parseMediaChunkCacheUrl,
} from './media-buffer-policy.js';

const CACHE_META = {
  start: 'x-mother-media-start',
  end: 'x-mother-media-end',
  total: 'x-mother-media-total',
  cachedAt: 'x-mother-media-cached-at',
};

const isMediaRequest = (request) => {
  if (request.method !== 'GET' || !parseByteRange(request.headers.get('range'))) return false;
  const url = new URL(request.url);
  return request.destination === 'video'
    || (url.origin === self.location.origin && url.pathname.startsWith('/api/files/'));
};

const rangeResponse = (body, { start, end, total, contentType, etag }) => new Response(body, {
  status: 206,
  statusText: 'Partial Content',
  headers: {
    'Accept-Ranges': 'bytes',
    'Content-Type': contentType || 'video/mp4',
    'Content-Length': String(end - start + 1),
    'Content-Range': `bytes ${start}-${end}/${total}`,
    ...(etag ? { ETag: etag } : {}),
  },
});

async function cachedResponse(cache, request, range) {
  const keys = await cache.keys();
  let best = null;
  for (const key of keys) {
    const chunk = parseMediaChunkCacheUrl(key.url);
    if (!cachedChunkCanServe(chunk, request.url, range.start)) continue;
    if (!best || chunk.end < best.chunk.end) best = { key, chunk };
  }
  if (!best) return null;

  const stored = await cache.match(best.key);
  if (!stored) return null;
  const total = Number(stored.headers.get(CACHE_META.total));
  if (!Number.isSafeInteger(total) || total <= best.chunk.end) return null;

  const requestedEnd = range.end == null ? best.chunk.end : Math.min(range.end, best.chunk.end);
  const offset = range.start - best.chunk.start;
  const length = requestedEnd - range.start + 1;
  const buffer = await stored.arrayBuffer();
  if (offset < 0 || offset + length > buffer.byteLength) return null;

  return rangeResponse(buffer.slice(offset, offset + length), {
    start: range.start,
    end: requestedEnd,
    total,
    contentType: stored.headers.get('content-type'),
    etag: stored.headers.get('etag'),
  });
}

async function pruneCache(cache) {
  const entries = [];
  for (const key of await cache.keys()) {
    const response = await cache.match(key);
    if (!response) continue;
    entries.push({
      key,
      size: Number(response.headers.get('content-length')) || 0,
      cachedAt: Number(response.headers.get(CACHE_META.cachedAt)) || 0,
    });
  }

  entries.sort((left, right) => right.cachedAt - left.cachedAt);
  let keptBytes = 0;
  let keptEntries = 0;
  await Promise.all(entries.map(async (entry) => {
    const fits = keptEntries < MEDIA_BUFFER_MAX_ENTRIES
      && keptBytes + entry.size <= MEDIA_BUFFER_MAX_BYTES;
    if (!fits) {
      await cache.delete(entry.key);
      return;
    }
    keptEntries += 1;
    keptBytes += entry.size;
  }));
}

async function storeChunk(cache, sourceUrl, buffer, metadata, responseHeaders) {
  const stored = new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': responseHeaders.get('content-type') || 'video/mp4',
      'Content-Length': String(buffer.byteLength),
      [CACHE_META.start]: String(metadata.start),
      [CACHE_META.end]: String(metadata.end),
      [CACHE_META.total]: String(metadata.total),
      [CACHE_META.cachedAt]: String(Date.now()),
      ...(responseHeaders.get('etag') ? { ETag: responseHeaders.get('etag') } : {}),
    },
  });
  await cache.put(mediaChunkCacheUrl(sourceUrl, metadata.start, metadata.end), stored);
  await pruneCache(cache);
}

async function fetchAndBuffer(request, range, cache) {
  const bounded = boundByteRange(range);
  const headers = new Headers(request.headers);
  headers.set('Range', `bytes=${bounded.start}-${bounded.end}`);

  let response;
  try {
    response = await fetch(new Request(request.url, {
      method: 'GET',
      headers,
      mode: new URL(request.url).origin === self.location.origin ? 'same-origin' : 'cors',
      credentials: request.credentials,
      redirect: 'follow',
      cache: 'no-store',
    }));
  } catch (error) {
    // A cross-origin CDN without readable CORS can still play while online, but
    // its bytes cannot safely be stored or reconstructed for offline ranges.
    try {
      return await fetch(request);
    } catch {
      throw error;
    }
  }

  const contentRange = response.status === 206
    ? parseContentRange(response.headers.get('content-range'))
    : null;
  if (!response.ok || !contentRange || response.type === 'opaque') return response;

  const buffer = await response.arrayBuffer();
  const actualEnd = contentRange.start + buffer.byteLength - 1;
  if (!buffer.byteLength) throw new Error('The media server returned an empty byte range.');
  if (actualEnd > contentRange.end) {
    return rangeResponse(buffer.slice(0, contentRange.end - contentRange.start + 1), {
      ...contentRange,
      end: contentRange.end,
      contentType: response.headers.get('content-type'),
      etag: response.headers.get('etag'),
    });
  }

  const metadata = { ...contentRange, end: actualEnd };
  try {
    await storeChunk(cache, request.url, buffer, metadata, response.headers);
  } catch {
    // Quota limits and private browsing can disable Cache Storage. Playback
    // should continue with the bytes that were just fetched.
  }
  return rangeResponse(buffer, {
    ...metadata,
    contentType: response.headers.get('content-type'),
    etag: response.headers.get('etag'),
  });
}

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith(MEDIA_BUFFER_CACHE_PREFIX) && name !== MEDIA_BUFFER_CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (!isMediaRequest(event.request)) return;
  const range = parseByteRange(event.request.headers.get('range'));
  event.respondWith((async () => {
    const cache = await caches.open(MEDIA_BUFFER_CACHE_NAME);
    const buffered = await cachedResponse(cache, event.request, range);
    if (buffered) return buffered;
    return fetchAndBuffer(event.request, range, cache);
  })());
});
