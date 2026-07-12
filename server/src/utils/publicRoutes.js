const USERNAME_PATTERN = /^[a-z]{1,40}$/;
const POST_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

export const RESERVED_USERNAMES = Object.freeze([
  'accountin',
  'api',
  'assets',
  'brand',
  'createaccount',
  'explore',
  'favicon',
  'feed',
  'health',
  'home',
  'login',
  'logout',
  'manifest',
  'notifications',
  'post',
  'posts',
  'robots',
  'search',
  'setting',
  'settings',
  'signup',
  'sitemap',
  'static',
  'upload'
]);

const reservedUsernames = new Set(RESERVED_USERNAMES);
const uploadFormats = new Set(['text-post', 'photo-post', 'video-post', 'short-video-post']);

export const isReservedUsername = (value) => reservedUsernames.has(String(value || '').trim().toLowerCase());

export const isPublicUsername = (value) => {
  const username = String(value || '').trim().replace(/^@/, '').toLowerCase();
  return USERNAME_PATTERN.test(username) && !isReservedUsername(username);
};

const decodeSegment = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};

const privateRoute = (page, path, username = null, format = null) => ({
  kind: 'private', page, path, username, format
});

export const classifyPagePath = (value) => {
  const pathname = String(value || '/').split('?')[0].split('#')[0];
  const rawSegments = pathname.split('/').filter(Boolean);
  const segments = rawSegments.map(decodeSegment);
  if (segments.some((segment) => segment == null || segment.includes('/'))) return { kind: 'unknown' };

  if (segments.length === 0) return { kind: 'home', path: '/' };

  if (segments.length === 1) {
    const segment = segments[0].toLowerCase();
    if (segment === 'createaccount') return privateRoute('createaccount', '/createaccount');
    if (segment === 'accountin') return privateRoute('accountin', '/accountin');
    if (isPublicUsername(segment)) return { kind: 'profile', username: segment, path: `/${segment}` };
    return { kind: 'unknown' };
  }

  if (segments.length === 2 && segments[0].toLowerCase() === 'post' && POST_ID_PATTERN.test(segments[1])) {
    return { kind: 'post', postId: segments[1], path: `/post/${encodeURIComponent(segments[1])}` };
  }

  const username = segments[0].toLowerCase();
  if (!isPublicUsername(username)) return { kind: 'unknown' };

  if (segments.length === 2 && segments[1].toLowerCase() === 'setting') {
    return privateRoute('setting', `/${username}/setting`, username);
  }

  if (segments.length === 2 && segments[1].toLowerCase() === 'upload') {
    return privateRoute('upload', `/${username}/upload`, username);
  }

  if (segments.length === 3 && segments[1].toLowerCase() === 'upload') {
    const format = segments[2].toLowerCase();
    if (uploadFormats.has(format)) {
      return privateRoute('upload-format', `/${username}/upload/${format}`, username, format);
    }
  }

  return { kind: 'unknown' };
};

export const profilePath = (username) => {
  const normalized = String(username || '').trim().replace(/^@/, '').toLowerCase();
  return isPublicUsername(normalized) ? `/${normalized}` : null;
};

export const postPath = (postId) => {
  const normalized = String(postId || '').trim();
  return POST_ID_PATTERN.test(normalized) ? `/post/${encodeURIComponent(normalized)}` : null;
};
