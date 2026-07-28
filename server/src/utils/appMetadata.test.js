import test from 'node:test';
import assert from 'node:assert/strict';
import { injectMetadata, metadataForRoute } from '../app.js';
import { classifyPagePath } from './publicRoutes.js';

test('creates canonical public metadata for the real home feed', async () => {
  const home = await metadataForRoute(classifyPagePath('/'));
  assert.equal(home.url, 'https://socialmediamother.onrender.com/');
  assert.equal(home.type, 'website');
  assert.equal(home.image, '/brand/me-click-og.png');
  assert.match(home.imageAlt, /human finger pressing it/);
  assert.match(home.robots, /^index/);
});

test('keeps account, settings, and upload routes out of search results', async () => {
  for (const pathname of [
    '/createaccount',
    '/accountin',
    '/analytics',
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

test('uses analytics as the canonical whole-web analytics team address', async () => {
  const direct = await metadataForRoute(classifyPagePath('/analytics'));
  assert.equal(direct.url, 'https://socialmediamother.onrender.com/analytics');
  assert.match(direct.title, /Analytics team/);
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
  assert.match(output, /twitter:image:alt/);
  assert.match(output, /brand\/me-click-og\.png/);
});
