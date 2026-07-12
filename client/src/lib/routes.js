const USERNAME_PATTERN = /^[a-z]{1,40}$/i;

export const UPLOAD_MODE_TO_SLUG = {
  text: 'text-post',
  photo: 'photo-post',
  video: 'video-post',
  'short-video': 'short-video-post',
};

const UPLOAD_SLUG_TO_MODE = Object.fromEntries(
  Object.entries(UPLOAD_MODE_TO_SLUG).map(([mode, slug]) => [slug, mode]),
);

// These names belong to the platform itself, so they are never interpreted as profiles.
export const RESERVED_TOP_LEVEL_PATHS = new Set([
  'accountin',
  'api',
  'assets',
  'brand',
  'createaccount',
  'explore',
  'favicon.ico',
  'favicon',
  'feed',
  'health',
  'home',
  'icon-192.png',
  'icon-512.png',
  'login',
  'logout',
  'manifest',
  'manifest.webmanifest',
  'notifications',
  'post',
  'posts',
  'robots.txt',
  'robots',
  'search',
  'setting',
  'settings',
  'signup',
  'sitemap.xml',
  'sitemap',
  'static',
  'upload',
  'u',
  'p',
]);

export function cleanRouteUsername(value) {
  const username = String(value || '').replace(/^@/, '').toLowerCase();
  return USERNAME_PATTERN.test(username) && !RESERVED_TOP_LEVEL_PATHS.has(username) ? username : '';
}

function safeSegment(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function currentUrlPath() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function profilePath(username) {
  const clean = cleanRouteUsername(username);
  return clean ? `/${clean}` : '/';
}

export function settingPath(username) {
  const clean = cleanRouteUsername(username);
  return clean ? `/${clean}/setting` : '/createaccount';
}

export function uploadPath(username, mode = null) {
  const clean = cleanRouteUsername(username);
  if (!clean) return '/createaccount';
  const slug = mode ? UPLOAD_MODE_TO_SLUG[mode] : null;
  return `/${clean}/upload${slug ? `/${slug}` : ''}`;
}

export function feedPath(mode, username) {
  if (mode === 'following') {
    const clean = cleanRouteUsername(username);
    return clean ? `/${clean}/feed/following` : '/feed/following';
  }
  return '/feed/everyone';
}

export function searchPath(query) {
  const clean = String(query || '').trim();
  return clean ? `/search?search=${encodeURIComponent(clean)}` : '/';
}

export function postPath(postId) {
  return postId ? `/post/${encodeURIComponent(String(postId))}` : '/';
}

export function parseAppLocation(location = window.location) {
  const pathname = location.pathname.replace(/\/{2,}/g, '/');
  const segments = pathname.split('/').filter(Boolean).map(safeSegment);
  const query = new URLSearchParams(location.search).get('search') || '';

  if (!segments.length) return { kind: query ? 'search' : 'home', query };
  if (segments.length === 1 && segments[0] === 'createaccount') return { kind: 'create-account' };
  if (segments.length === 1 && segments[0] === 'accountin') return { kind: 'account-in' };
  if (segments[0] === 'search') return { kind: query ? 'search' : 'home', query };

  if (segments[0] === 'feed' && segments.length === 2 && ['everyone', 'following'].includes(segments[1])) {
    return { kind: 'feed', feedMode: segments[1] };
  }

  if (segments[0] === 'post' && segments.length === 2 && segments[1]) {
    return { kind: 'post', postId: segments[1] };
  }

  if (segments[0] === 'u' && segments.length === 2) {
    const username = cleanRouteUsername(segments[1]);
    return username
      ? { kind: 'profile', username, legacy: true, canonicalPath: profilePath(username) }
      : { kind: 'not-found' };
  }

  if (segments[0] === 'p' && segments.length === 2 && segments[1]) {
    return { kind: 'post', postId: segments[1], legacy: true, canonicalPath: postPath(segments[1]) };
  }

  const username = cleanRouteUsername(segments[0]);
  if (!username) return { kind: 'not-found' };
  if (segments.length === 1) return { kind: 'profile', username };
  if (segments.length === 2 && segments[1] === 'setting') return { kind: 'setting', username };
  if (segments.length === 2 && segments[1] === 'upload') return { kind: 'upload', username, uploadMode: null };
  if (segments.length === 3 && segments[1] === 'upload' && UPLOAD_SLUG_TO_MODE[segments[2]]) {
    return { kind: 'upload', username, uploadMode: UPLOAD_SLUG_TO_MODE[segments[2]] };
  }
  if (segments.length === 3 && segments[1] === 'feed' && segments[2] === 'following') {
    return { kind: 'feed', feedMode: 'following', username };
  }
  return { kind: 'not-found' };
}

export function fallbackPathForRoute(route) {
  if (route?.kind === 'setting' || route?.kind === 'upload') return profilePath(route.username);
  return '/';
}
