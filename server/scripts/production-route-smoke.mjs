import assert from 'node:assert/strict';
import { once } from 'node:events';

// Reproduce the exact dashboard mistake that caused Render to return the API
// 404 at `/`: NODE_ENV was manually set to development. RENDER=true must still
// make the hosted service serve the production Vite build.
process.env.NODE_ENV = 'development';
process.env.RENDER = 'true';
process.env.RENDER_EXTERNAL_URL = 'https://socialmediamother.onrender.com';
delete process.env.PUBLIC_URL;
process.env.HOST = '0.0.0.0';
process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:1/production-route-smoke';
process.env.JWT_SECRET ||= 'production-route-smoke-secret-longer-than-thirty-two-characters';

const [{ createApp }, { config }] = await Promise.all([
  import('../src/app.js'),
  import('../src/config.js')
]);
const server = createApp().listen(0, config.host);
await once(server, 'listening');

assert.equal(config.host, '0.0.0.0');
assert.equal(config.nodeEnv, 'development');
assert.equal(config.isRender, true);
assert.equal(config.isProduction, true);
assert.equal(config.publicUrl, 'https://socialmediamother.onrender.com');
assert.equal(server.address().address, '0.0.0.0');

const origin = `http://127.0.0.1:${server.address().port}`;
const get = async (pathname, redirect = 'follow', accept = 'text/html') => {
  const response = await fetch(`${origin}${pathname}`, { redirect, headers: { Accept: accept } });
  return { response, body: await response.text() };
};

try {
  const home = await get('/');
  assert.equal(home.response.status, 200);
  assert.match(home.body, /<link rel="canonical" href="https:\/\/socialmediamother\.onrender\.com\/">/);
  assert.match(home.body, /<meta name="robots" content="index, follow, max-image-preview:large">/);

  for (const pathname of ['/createaccount', '/accountin', '/jasmine/setting', '/jasmine/upload/text-post']) {
    const page = await get(pathname);
    assert.equal(page.response.status, 200, pathname);
    assert.equal(page.response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive', pathname);
    assert.match(page.body, new RegExp(`<link rel="canonical" href="https://socialmediamother\\.onrender\\.com${pathname.replaceAll('/', '\\/')}">`), pathname);
    assert.match(page.body, /<meta name="robots" content="noindex, nofollow, noarchive">/, pathname);
  }

  const unknown = await get('/unknown/path');
  assert.equal(unknown.response.status, 200);
  assert.equal(unknown.response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');

  const apiRoot = await get('/api');
  assert.equal(apiRoot.response.status, 404);
  assert.match(apiRoot.response.headers.get('content-type') || '', /application\/json/);

  const oldProfile = await get('/u/jasmine?from=old', 'manual');
  assert.equal(oldProfile.response.status, 301);
  assert.equal(oldProfile.response.headers.get('location'), '/jasmine?from=old');

  const oldPost = await get('/p/abc123?from=old', 'manual');
  assert.equal(oldPost.response.status, 301);
  assert.equal(oldPost.response.headers.get('location'), '/post/abc123?from=old');

  const mixedCase = await get('/Jasmine', 'manual');
  assert.equal(mixedCase.response.status, 308);
  assert.equal(mixedCase.response.headers.get('location'), '/jasmine');

  const robots = await get('/robots.txt', 'follow', 'text/plain');
  assert.equal(robots.response.status, 200);
  assert.match(robots.body, /Disallow: \/createaccount/);
  assert.match(robots.body, /Disallow: \/\*\/upload/);

  console.log('Render-hosted friendly-route smoke test passed.');
} finally {
  server.close();
  await once(server, 'close');
}
