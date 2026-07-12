import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateUploadProgress, formatBytes, formatRemainingTime } from './uploadProgress.js';

test('formats upload sizes from bytes through gigabytes', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1536), '1.50 KB');
  assert.equal(formatBytes(5 * 1024 * 1024), '5.00 MB');
  assert.equal(formatBytes(2.5 * 1024 * 1024 * 1024), '2.50 GB');
});

test('formats useful remaining-time labels', () => {
  assert.equal(formatRemainingTime(0), 'Less than 1 second');
  assert.equal(formatRemainingTime(9.1), '10 sec');
  assert.equal(formatRemainingTime(75), '1 min 15 sec');
  assert.equal(formatRemainingTime(3900), '1 hr 5 min');
});

test('calculates real byte progress, speed, and time left', () => {
  const megabyte = 1024 * 1024;
  const progress = calculateUploadProgress(5 * megabyte, 10 * megabyte, 5000);
  assert.equal(progress.percent, 50);
  assert.equal(progress.bytesPerSecond, megabyte);
  assert.equal(progress.remainingSeconds, 5);
  assert.equal(progress.status, 'uploading');

  const complete = calculateUploadProgress(10 * megabyte, 10 * megabyte, 8000);
  assert.equal(complete.percent, 100);
  assert.equal(complete.remainingSeconds, 0);
  assert.equal(complete.status, 'processing');
});
