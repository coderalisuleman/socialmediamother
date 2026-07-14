import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyPagePath,
  isPublicUsername,
  isReservedUsername,
  postPath,
  profilePath
} from './publicRoutes.js';
import { cleanUsername } from './normalize.js';

test('keeps special pages out of the public username namespace', () => {
  for (const username of ['createaccount', 'accountin', 'humanbehaviour', 'post', 'api', 'health', 'search']) {
    assert.equal(isReservedUsername(username), true);
    assert.equal(isPublicUsername(username), false);
    assert.equal(profilePath(username), null);
  }
  assert.equal(isPublicUsername('jasmine'), true);
  assert.equal(isPublicUsername('r'), true);
  assert.equal(profilePath('@Jasmine'), '/jasmine');
  assert.throws(
    () => cleanUsername('createaccount'),
    (error) => error?.code === 'RESERVED_USERNAME' && error?.status === 422
  );
});

test('classifies every supported friendly page route', () => {
  assert.deepEqual(classifyPagePath('/'), { kind: 'home', path: '/' });
  assert.deepEqual(classifyPagePath('/Jasmine/'), { kind: 'profile', username: 'jasmine', path: '/jasmine' });
  assert.deepEqual(classifyPagePath('/createaccount'), {
    kind: 'private', page: 'createaccount', path: '/createaccount', username: null, format: null
  });
  assert.deepEqual(classifyPagePath('/accountin'), {
    kind: 'private', page: 'accountin', path: '/accountin', username: null, format: null
  });
  assert.deepEqual(classifyPagePath('/humanbehaviour'), {
    kind: 'private', page: 'humanbehaviour', path: '/humanbehaviour', username: null, format: null
  });
  assert.deepEqual(classifyPagePath('/jasmine/setting'), {
    kind: 'private', page: 'setting', path: '/jasmine/setting', username: 'jasmine', format: null
  });
  assert.deepEqual(classifyPagePath('/jasmine/upload'), {
    kind: 'private', page: 'upload', path: '/jasmine/upload', username: 'jasmine', format: null
  });
  assert.deepEqual(classifyPagePath('/jasmine/upload/text-post'), {
    kind: 'private', page: 'upload-format', path: '/jasmine/upload/text-post', username: 'jasmine', format: 'text-post'
  });
  assert.deepEqual(classifyPagePath('/jasmine/upload/photo-post'), {
    kind: 'private', page: 'upload-format', path: '/jasmine/upload/photo-post', username: 'jasmine', format: 'photo-post'
  });
  assert.deepEqual(classifyPagePath('/jasmine/upload/video-post'), {
    kind: 'private', page: 'upload-format', path: '/jasmine/upload/video-post', username: 'jasmine', format: 'video-post'
  });
  assert.deepEqual(classifyPagePath('/jasmine/upload/short-video-post'), {
    kind: 'private', page: 'upload-format', path: '/jasmine/upload/short-video-post', username: 'jasmine', format: 'short-video-post'
  });
  assert.deepEqual(classifyPagePath('/post/abc_123'), { kind: 'post', postId: 'abc_123', path: '/post/abc_123' });
});

test('rejects unsafe, ambiguous, and unsupported paths', () => {
  for (const pathname of [
    '/api',
    '/post',
    '/post/with%2Fslash',
    '/jasmine/settings',
    '/jasmine/upload/story-post',
    '/jasmine/upload/text-post/extra',
    '/name-with-dash'
  ]) {
    assert.equal(classifyPagePath(pathname).kind, 'unknown');
  }
  assert.equal(postPath('abc_123'), '/post/abc_123');
  assert.equal(postPath('../bad'), null);
});
