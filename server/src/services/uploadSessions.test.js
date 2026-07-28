import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import {
  assembleUploadSession,
  cancelUploadSession,
  createUploadSession,
  getUploadSession,
  storeUploadChunk,
  UPLOAD_CHUNK_BYTES,
} from './uploadSessions.js';

test('assembly preserves resumable progress until explicit cleanup', async () => {
  const ownerId = 'upload-test-owner';
  const source = Buffer.alloc(UPLOAD_CHUNK_BYTES + 37, 7);
  const session = await createUploadSession(ownerId, [{ name: 'piece.bin', type: 'application/octet-stream', size: source.length }]);
  await storeUploadChunk({ sessionId: session.id, ownerId, fileIndex: 0, chunkIndex: 0, data: source.subarray(0, UPLOAD_CHUNK_BYTES) });
  const saved = await getUploadSession(session.id, ownerId);
  assert.deepEqual(saved.files[0].receivedChunks, [0]);
  assert.equal(saved.totalBytes, source.length);
  const progress = await storeUploadChunk({ sessionId: session.id, ownerId, fileIndex: 0, chunkIndex: 1, data: source.subarray(UPLOAD_CHUNK_BYTES) });
  assert.equal(progress.receivedBytes, source.length);
  const files = await assembleUploadSession(session.id, ownerId);
  try {
    assert.equal(files.length, 1);
    assert.deepEqual(await fs.readFile(files[0].path), source);

    const followUp = await getUploadSession(session.id, ownerId);
    assert.deepEqual(followUp.files[0].receivedChunks, [0, 1]);

    const retriedFiles = await assembleUploadSession(session.id, ownerId);
    assert.deepEqual(await fs.readFile(retriedFiles[0].path), source);

    assert.equal(await cancelUploadSession(session.id, ownerId), true);
    await assert.rejects(
      getUploadSession(session.id, ownerId),
      (error) => error?.code === 'UPLOAD_SESSION_NOT_FOUND'
    );
  } finally {
    await Promise.all(files.map((file) => fs.rm(file.path, { force: true })));
    await cancelUploadSession(session.id, ownerId);
  }
});

test('cancel removes a private unfinished upload session', async () => {
  const session = await createUploadSession('cancel-owner', [{ name: 'cancel.bin', type: 'application/octet-stream', size: 10 }]);
  await storeUploadChunk({ sessionId: session.id, ownerId: 'cancel-owner', fileIndex: 0, chunkIndex: 0, data: Buffer.alloc(10) });
  assert.equal(await cancelUploadSession(session.id, 'cancel-owner'), true);
  assert.equal(await cancelUploadSession(session.id, 'cancel-owner'), false);
});
