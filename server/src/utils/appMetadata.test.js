import test from 'node:test';
import assert from 'node:assert/strict';
import { injectMetadata, metadataForRoute } from '../app.js';
import { initializeStore, listSitemapEntities } from '../services/store.js';
import { classifyPagePath } from './publicRoutes.js';

await initializeStore();

test('creates canonical public metadata for friendly profile and post routes', async () => {
  const profile = await metadataForRoute(classifyPagePath('/jasmine'));
  assert.equal(profile.url, 'https://socialmediamother.onrender.com/jasmine');
  assert.equal(profile.type, 'profile');
  assert.match(profile.robots, /^index/);

  const entries = await listSitemapEntities();
  const post = await metadataForRoute(classifyPagePath(`/post/${entries.posts[0].id}`));
  assert.equal(post.url, `https://socialmediamother.onrender.com/post/${entries.posts[0].id}`);
  assert.equal(post.type, 'article');
  assert.match(post.robots, /^index/);
});

test('keeps account, settings, and upload routes out of search results', async () => {
  for (const pathname of [
    '/createaccount',
    '/accountin',
    '/jasmine/setting',
    '/jasmine/upload',
    '/jasmine/upload/short-video-post'
  ]) {
    const route = classifyPagePath(pathname);
    const metadata = await metadataForRoute(route);
    assert.equal(metadata.url, `https://socialmediamother.onrender.com${route.path}`);
    assert.equal(metadata.robots, 'noindex, nofollow, noarchive');
  }
});

test('replaces inherited SEO tags instead of duplicating them', async () => {
  const html = '<html><head><title>Old</title><meta name="description" content="Old"><meta name="robots" content="index"><link rel="canonical" href="https://old.example"><meta property="og:title" content="Old"></head><body></body></html>';
  const metadata = await metadataForRoute(classifyPagePath('/createaccount'));
  const output = injectMetadata(html, metadata);

  assert.equal((output.match(/<title>/g) || []).length, 1);
  assert.equal((output.match(/name="description"/g) || []).length, 1);
  assert.equal((output.match(/name="robots"/g) || []).length, 1);
  assert.equal((output.match(/rel="canonical"/g) || []).length, 1);
  assert.match(output, /noindex, nofollow, noarchive/);
  assert.match(output, /https:\/\/socialmediamother\.onrender\.com\/createaccount/);
});
