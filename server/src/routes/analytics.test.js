import test from 'node:test';
import assert from 'node:assert/strict';
import { friendlyAnalyticsEventType } from './analytics.js';

test('describes post views by their real post format', () => {
  assert.equal(friendlyAnalyticsEventType({ eventType: 'post_view', metadata: { format: 'text' } }), 'text_post_view');
  assert.equal(friendlyAnalyticsEventType({ eventType: 'post_view', metadata: { format: 'photo' } }), 'photo_post_view');
  assert.equal(friendlyAnalyticsEventType({ eventType: 'post_view', metadata: { format: 'video' } }), 'video_post_view');
  assert.equal(friendlyAnalyticsEventType({ eventType: 'post_view', metadata: { format: 'short-video' } }), 'short_video_post_view');
});

test('turns browser connection and visibility events into plain actions', () => {
  assert.equal(friendlyAnalyticsEventType({ eventType: 'connection', metadata: { network: 'online' } }), 'internet_connected');
  assert.equal(friendlyAnalyticsEventType({ eventType: 'connection', metadata: { network: 'offline' } }), 'internet_disconnected');
  assert.equal(friendlyAnalyticsEventType({ eventType: 'visibility', metadata: { visibility: 'visible' } }), 'returned_to_page');
  assert.equal(friendlyAnalyticsEventType({ eventType: 'visibility', metadata: { visibility: 'hidden' } }), 'switched_away_from_page');
});
