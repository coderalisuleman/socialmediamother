import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.RENDER = 'false';
process.env.MONGODB_URI = ' ';
process.env.ALLOW_MEMORY_STORAGE = 'true';

const [
  { createApp },
  { createPost, createUser, memorySnapshot, setFollowing },
  { signAccessToken },
] = await Promise.all([
  import('../app.js'),
  import('../services/store.js'),
  import('../services/tokens.js'),
]);

const createTestUser = (username) => createUser({
  fullName: username,
  username,
  passwordHash: 'not-used-in-this-test',
  gender: 'prefer-not-to-say',
});

const createTextPost = (author, text) => createPost({
  author: author.id,
  type: 'text',
  text,
  nameIt: '',
  detail: '',
  links: [],
  media: [],
});

test('following feed is empty without follows and never includes the viewer own posts', async (t) => {
  const memory = memorySnapshot();
  for (const collection of Object.values(memory)) collection.clear();
  t.after(() => {
    for (const collection of Object.values(memory)) collection.clear();
  });

  const viewer = await createTestUser('feed-viewer');
  const followed = await createTestUser('feed-followed');
  const stranger = await createTestUser('feed-stranger');
  await Promise.all([
    createTextPost(viewer, 'viewer post'),
    createTextPost(followed, 'followed post'),
    createTextPost(stranger, 'stranger post'),
  ]);

  const app = createApp();
  const server = await new Promise((resolve, reject) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
    listening.once('error', reject);
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const token = signAccessToken(viewer);
  const url = `http://127.0.0.1:${server.address().port}/api/feed?scope=following&limit=10`;
  const requestFeed = async () => {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(response.status, 200);
    return response.json();
  };

  const emptyFeed = await requestFeed();
  assert.equal(emptyFeed.scope, 'following');
  assert.equal(emptyFeed.fallbackReason, null);
  assert.deepEqual(emptyFeed.posts, []);

  await setFollowing(viewer.id, followed.id, true);
  const followedFeed = await requestFeed();
  assert.deepEqual(followedFeed.posts.map((post) => post.author.username), ['feed-followed']);
  assert.equal(followedFeed.posts[0].author.viewerWantsToBeWithThem, true);
});
