import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import {
  assembleUploadSession,
  cancelUploadSession,
  createUploadSession,
  storeUploadChunk,
  UPLOAD_CHUNK_BYTES,
} from './uploadSessions.js';

test('stores resumable pieces and assembles the original bytes', async () => {
  const ownerId = 'upload-test-owner';
  const source = Buffer.alloc(UPLOAD_CHUNK_BYTES + 37, 7);
  const session = await createUploadSession(ownerId, [{ name: 'piece.bin', type: 'application/octet-stream', size: source.length }]);
  await storeUploadChunk({ sessionId: session.id, ownerId, fileIndex: 0, chunkIndex: 0, data: source.subarray(0, UPLOAD_CHUNK_BYTES) });
  const progress = await storeUploadChunk({ sessionId: session.id, ownerId, fileIndex: 0, chunkIndex: 1, data: source.subarray(UPLOAD_CHUNK_BYTES) });
  assert.equal(progress.receivedBytes, source.length);
  const files = await assembleUploadSession(session.id, ownerId);
  try {
    assert.equal(files.length, 1);
    assert.deepEqual(await fs.readFile(files[0].path), source);
  } finally {
    await Promise.all(files.map((file) => fs.rm(file.path, { force: true })));
  }
});

test('cancel removes a private unfinished upload session', async () => {
  const session = await createUploadSession('cancel-owner', [{ name: 'cancel.bin', type: 'application/octet-stream', size: 10 }]);
  await storeUploadChunk({ sessionId: session.id, ownerId: 'cancel-owner', fileIndex: 0, chunkIndex: 0, data: Buffer.alloc(10) });
  assert.equal(await cancelUploadSession(session.id, 'cancel-owner'), true);
  assert.equal(await cancelUploadSession(session.id, 'cancel-owner'), false);
});
