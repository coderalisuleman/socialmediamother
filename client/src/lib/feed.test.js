import test from 'node:test';
import assert from 'node:assert/strict';
import { filterFeedPosts } from './feed.js';

test('following feed shows only posts from people the viewer follows', () => {
  const followedPost = { id: 'followed', author: { id: 'person-1', isFollowing: true } };
  const ownPost = { id: 'own', author: { id: 'viewer', isFollowing: false } };
  const strangerPost = { id: 'stranger', author: { id: 'person-2', isFollowing: false } };

  assert.deepEqual(
    filterFeedPosts([followedPost, ownPost, strangerPost], 'following'),
    [followedPost]
  );
  assert.deepEqual(
    filterFeedPosts([followedPost, ownPost, strangerPost], 'everyone'),
    [followedPost, ownPost, strangerPost]
  );
});
