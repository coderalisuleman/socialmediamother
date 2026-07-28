import assert from 'node:assert/strict';
import test from 'node:test';
import { isLegacyAnalyticsExpiryIndex } from './db.js';

test('recognizes only the old expiring analytics createdAt index', () => {
  assert.equal(isLegacyAnalyticsExpiryIndex({
    name: 'createdAt_1',
    key: { createdAt: 1 },
    expireAfterSeconds: 60 * 60 * 24 * 180,
  }), true);
  assert.equal(isLegacyAnalyticsExpiryIndex({
    name: 'occurredAt_1',
    key: { occurredAt: 1 },
    expireAfterSeconds: 60,
  }), false);
  assert.equal(isLegacyAnalyticsExpiryIndex({
    name: 'createdAt_1_sessionId_1',
    key: { createdAt: 1, sessionId: 1 },
    expireAfterSeconds: 60,
  }), false);
  assert.equal(isLegacyAnalyticsExpiryIndex({
    name: 'createdAt_1',
    key: { createdAt: 1 },
  }), false);
});
