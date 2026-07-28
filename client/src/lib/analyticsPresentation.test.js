import test from 'node:test';
import assert from 'node:assert/strict';
import { isWatchTimePost, positiveAnalyticsCount } from './analyticsPresentation.js';

test('watch time belongs only to video and short-video posts', () => {
  assert.equal(isWatchTimePost('text'), false);
  assert.equal(isWatchTimePost({ type: 'photo' }), false);
  assert.equal(isWatchTimePost({ type: 'video' }), true);
  assert.equal(isWatchTimePost('short-video'), true);
});

test('zero, negative, and invalid analytics counts remain hidden', () => {
  assert.equal(positiveAnalyticsCount(0), 0);
  assert.equal(positiveAnalyticsCount(-4), 0);
  assert.equal(positiveAnalyticsCount('not-a-number'), 0);
  assert.equal(positiveAnalyticsCount('17'), 17);
});
