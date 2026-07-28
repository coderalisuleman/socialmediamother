import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MEDIA_BUFFER_CHUNK_BYTES,
  boundByteRange,
  cachedChunkCanServe,
  mediaChunkCacheUrl,
  parseByteRange,
  parseContentRange,
  parseMediaChunkCacheUrl,
} from '../../public/media-buffer-policy.js';

test('accepts only a single explicit-start byte range', () => {
  assert.deepEqual(parseByteRange('bytes=0-'), { start: 0, end: null });
  assert.deepEqual(parseByteRange('bytes=120-900'), { start: 120, end: 900 });
  assert.equal(parseByteRange('bytes=-500'), null);
  assert.equal(parseByteRange('bytes=0-2,5-9'), null);
  assert.equal(parseByteRange('items=0-2'), null);
});

test('caps open and large media requests to one bounded chunk', () => {
  assert.deepEqual(boundByteRange({ start: 0, end: null }), {
    start: 0,
    end: MEDIA_BUFFER_CHUNK_BYTES - 1,
  });
  assert.deepEqual(boundByteRange({ start: 10, end: 20 }), { start: 10, end: 20 });
  assert.deepEqual(boundByteRange({ start: 10, end: MEDIA_BUFFER_CHUNK_BYTES * 2 }), {
    start: 10,
    end: MEDIA_BUFFER_CHUNK_BYTES + 9,
  });
});

test('validates content ranges before caching response bytes', () => {
  assert.deepEqual(parseContentRange('bytes 0-99/200'), { start: 0, end: 99, total: 200 });
  assert.equal(parseContentRange('bytes 0-200/200'), null);
  assert.equal(parseContentRange('bytes */200'), null);
  assert.equal(parseContentRange(''), null);
});

test('cache keys retain the source URL and identify a chunk that covers playback', () => {
  const source = 'https://cdn.example.test/video.mp4?token=signed';
  const key = mediaChunkCacheUrl(source, 100, 199);
  const chunk = parseMediaChunkCacheUrl(key);
  assert.deepEqual(chunk, { sourceUrl: source, start: 100, end: 199 });
  assert.equal(cachedChunkCanServe(chunk, source, 100), true);
  assert.equal(cachedChunkCanServe(chunk, source, 150), true);
  assert.equal(cachedChunkCanServe(chunk, source, 200), false);
  assert.equal(cachedChunkCanServe(chunk, 'https://cdn.example.test/other.mp4', 150), false);
});
