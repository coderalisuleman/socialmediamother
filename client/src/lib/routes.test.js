import assert from 'node:assert/strict';
import test from 'node:test';
import {
  feedPath,
  parseAppLocation,
  postPath,
  profilePath,
  searchPath,
  settingPath,
  uploadPath,
} from './routes.js';

const locationFor = (pathname, search = '') => ({ pathname, search, hash: '' });

test('builds every public and private friendly path', () => {
  assert.equal(profilePath('@Jasmine'), '/jasmine');
  assert.equal(settingPath('jasmine'), '/jasmine/setting');
  assert.equal(uploadPath('jasmine'), '/jasmine/upload');
  assert.equal(uploadPath('jasmine', 'text'), '/jasmine/upload/text-post');
  assert.equal(uploadPath('jasmine', 'photo'), '/jasmine/upload/photo-post');
  assert.equal(uploadPath('jasmine', 'video'), '/jasmine/upload/video-post');
  assert.equal(uploadPath('jasmine', 'short-video'), '/jasmine/upload/short-video-post');
  assert.equal(feedPath('everyone'), '/feed/everyone');
  assert.equal(feedPath('following', 'jasmine'), '/jasmine/feed/following');
  assert.equal(searchPath('slow living'), '/search?search=slow%20living');
  assert.equal(postPath('post-1'), '/post/post-1');
});

test('parses direct account, profile, settings, upload, feed, search, and post links', () => {
  assert.deepEqual(parseAppLocation(locationFor('/createaccount')), { kind: 'create-account' });
  assert.deepEqual(parseAppLocation(locationFor('/accountin')), { kind: 'account-in' });
  assert.deepEqual(parseAppLocation(locationFor('/Jasmine/')), { kind: 'profile', username: 'jasmine' });
  assert.deepEqual(parseAppLocation(locationFor('/jasmine/setting')), { kind: 'setting', username: 'jasmine' });
  assert.deepEqual(parseAppLocation(locationFor('/jasmine/upload')), { kind: 'upload', username: 'jasmine', uploadMode: null });
  assert.deepEqual(parseAppLocation(locationFor('/jasmine/upload/text-post')), { kind: 'upload', username: 'jasmine', uploadMode: 'text' });
  assert.deepEqual(parseAppLocation(locationFor('/jasmine/upload/photo-post')), { kind: 'upload', username: 'jasmine', uploadMode: 'photo' });
  assert.deepEqual(parseAppLocation(locationFor('/jasmine/upload/video-post')), { kind: 'upload', username: 'jasmine', uploadMode: 'video' });
  assert.deepEqual(parseAppLocation(locationFor('/jasmine/upload/short-video-post')), { kind: 'upload', username: 'jasmine', uploadMode: 'short-video' });
  assert.deepEqual(parseAppLocation(locationFor('/jasmine/feed/following')), { kind: 'feed', feedMode: 'following', username: 'jasmine' });
  assert.deepEqual(parseAppLocation(locationFor('/search', '?search=slow%20living')), { kind: 'search', query: 'slow living' });
  assert.deepEqual(parseAppLocation(locationFor('/post/post-1')), { kind: 'post', postId: 'post-1' });
});

test('keeps legacy links compatible and platform names out of profile routes', () => {
  assert.deepEqual(parseAppLocation(locationFor('/u/jasmine')), {
    kind: 'profile', username: 'jasmine', legacy: true, canonicalPath: '/jasmine'
  });
  assert.deepEqual(parseAppLocation(locationFor('/p/post-1')), {
    kind: 'post', postId: 'post-1', legacy: true, canonicalPath: '/post/post-1'
  });
  assert.equal(parseAppLocation(locationFor('/upload')).kind, 'not-found');
  assert.equal(profilePath('createaccount'), '/');
});
