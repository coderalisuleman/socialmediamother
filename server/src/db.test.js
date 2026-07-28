import assert from 'node:assert/strict';
import test from 'node:test';
import { isLegacyAnalyticsExpiryIndex, resolveMongoSrvSeedUri } from './db.js';

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

test('resolves Atlas seed hosts without requiring a TXT DNS response', async () => {
  const uri = await resolveMongoSrvSeedUri(
    'mongodb+srv://person:p%40ss@example.mongodb.net/social?retryWrites=true&w=majority',
    {
      resolveSrv: async (name) => {
        assert.equal(name, '_mongodb._tcp.example.mongodb.net');
        return [
          { name: 'second.example.mongodb.net.', port: 27018, priority: 20 },
          { name: 'first.example.mongodb.net.', port: 27017, priority: 10 },
        ];
      },
    },
  );

  assert.equal(
    uri,
    'mongodb://person:p%40ss@first.example.mongodb.net:27017,second.example.mongodb.net:27018/social?retryWrites=true&w=majority&tls=true&authSource=admin',
  );
});
