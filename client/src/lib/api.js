const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const TOKEN_KEY = 'mother.session';

export class ApiError extends Error {
  constructor(message, status = 0, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const { timeout = 12000, headers, body, ...rest } = options;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  const token = getToken();
  const isForm = body instanceof FormData;

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...rest,
      body,
      signal: controller.signal,
      headers: {
        ...(isForm ? {} : body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const baseMessage = payload?.error?.message || payload?.message || (typeof payload?.error === 'string' ? payload.error : '') || `Request failed (${response.status})`;
      const validationDetails = Array.isArray(payload?.error?.details) ? payload.error.details.filter(Boolean) : [];
      const message = validationDetails.length ? `${baseMessage}: ${validationDetails.join('; ')}` : baseMessage;
      throw new ApiError(message, response.status, payload);
    }
    return payload;
  } catch (error) {
    if (error.name === 'AbortError') throw new ApiError('The connection took too long. Please try again.');
    if (error instanceof ApiError) throw error;
    throw new ApiError('Mother could not reach the server. Your connection may be offline.');
  } finally {
    window.clearTimeout(timer);
  }
}

function queryString(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value);
  });
  const built = query.toString();
  return built ? `?${built}` : '';
}

export const api = {
  listPosts: ({ feed, ...params } = {}) => request(`/feed${queryString({ scope: feed, ...params })}`),
  getPost: async (postId) => normalizePostShape((await request(`/posts/${encodeURIComponent(postId)}`))?.post),
  getUser: async (username) => normalizeUserShape((await request(`/users/${encodeURIComponent(String(username).replace(/^@/, ''))}`))?.user),
  search: async (params) => normalizeSearchResponse(await request(`/search${queryString(params)}`)),
  createPost: (formData) => request('/posts', { method: 'POST', body: formData, timeout: 10 * 60_000 }),
  reactToPost: (postId, reaction) =>
    request(`/posts/${postId}/reaction`, { method: 'PUT', body: JSON.stringify({ reaction }) }),
  listComments: (postId) => request(`/posts/${encodeURIComponent(postId)}/comments`),
  createComment: (postId, body) => request(`/posts/${encodeURIComponent(postId)}/comments`, { method: 'POST', body: JSON.stringify({ body }) }),
  updateComment: (postId, commentId, body) => request(`/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`, { method: 'PATCH', body: JSON.stringify({ body }) }),
  deleteComment: (postId, commentId) => request(`/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`, { method: 'DELETE' }),
  recordPostView: (postId) => request(`/posts/${postId}/view`, { method: 'POST' }),
  requestOtp: (channel, destination) =>
    request('/auth/otp/request', { method: 'POST', body: JSON.stringify({ channel, destination }) }),
  verifyOtp: (challengeId, code) =>
    request('/auth/otp/verify', { method: 'POST', body: JSON.stringify({ challengeId, code }) }),
  register: (values) => request('/auth/signup', { method: 'POST', body: JSON.stringify(values) }),
  login: (values) => request('/auth/login', { method: 'POST', body: JSON.stringify(values) }),
  me: () => request('/auth/me'),
  logout: async () => {
    try {
      await request('/auth/logout', { method: 'POST' });
    } finally {
      setToken(null);
    }
  },
  updateAvatar: (formData) => request('/users/me/profile-image', { method: 'POST', body: formData, timeout: 30000 }),
  deleteAvatar: () => request('/users/me/profile-image', { method: 'DELETE' }),
  setFollowing: (username, following) =>
    request(`/users/${encodeURIComponent(username)}/follow`, { method: following ? 'POST' : 'DELETE' }),
  listRelationshipPeople: (username, direction, cursor) => request(
    `/users/${encodeURIComponent(username)}/${direction === 'followers' ? 'people-who-want-to-be-with-me' : 'people-i-want-to-be-with'}${queryString({ cursor, limit: 30 })}`,
  ),
  listUserPosts: async (username, type) => {
    const payload = await request(`/users/${encodeURIComponent(username)}/posts${queryString({ type, limit: 50 })}`);
    return { ...payload, posts: (payload?.posts || []).map(normalizePostShape) };
  },
};

function exactNumericCount(value) {
  if (Array.isArray(value)) return value.length;
  return Number(value || 0);
}

export function normalizeUserShape(user) {
  if (!user) return user;
  return {
    ...user,
    id: user.id || user._id || user.username,
    name: user.name || user.fullName || 'Mother member',
    fullName: user.fullName || user.name || 'Mother member',
    username: String(user.username || '').replace(/^@/, ''),
    avatar: user.avatar || user.profileImageUrl || null,
    followers: user.followers ?? exactNumericCount(user.peopleWhoWantToBeWithMe),
    following: user.following ?? exactNumericCount(user.peopleIWantToBeWith),
    isFollowing: user.isFollowing ?? Boolean(user.viewerWantsToBeWithThem),
  };
}

export function normalizePostShape(post) {
  if (!post) return post;
  const rawMedia = post.media || post.mediaItems || post.assets || [];
  const media = rawMedia.map((item) => ({
    ...item,
    src: item.src || item.url,
    type: item.type || (String(item.contentType || '').startsWith('image/') ? 'image' : 'video'),
    alt: item.alt || item.name || post.nameIt || post.name || 'Post media',
  }));
  const rawType = post.type || post.format || post.postType || 'text';
  const type = rawType === 'shortVideo' || rawType === 'short_video' ? 'short-video' : rawType;
  return {
    ...post,
    id: post.id || post._id,
    type,
    author: normalizeUserShape(post.author || post.user || post.owner),
    name: type === 'text' ? '' : post.name || post.nameIt || '',
    detail: post.detail || post.detailOfIt || '',
    links: post.links || post.linksOfYourOtherPlatforms || [],
    link: post.link || post.links?.[0] || post.linksOfYourOtherPlatforms?.[0] || '',
    media,
    hugs: post.hugs ?? Number(post.hugCount || 0),
    throws: post.throws ?? Number(post.throwCount || 0),
    reaction: post.reaction ?? post.viewerReaction ?? null,
    createdAt: formatRelativeTime(post.createdAt),
  };
}

function formatRelativeTime(value) {
  if (!value || /(?:min|hr|day|now|yesterday)/i.test(String(value))) return value || 'now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 50) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr`;
  if (seconds < 172800) return 'Yesterday';
  return `${Math.floor(seconds / 86400)} days`;
}

export function normalizePostsResponse(payload) {
  if (Array.isArray(payload)) return { items: payload.map(normalizePostShape), nextCursor: null };
  const rows = payload?.items || payload?.posts || payload?.data?.posts || (Array.isArray(payload?.data) ? payload.data : []);
  return {
    items: rows.map(normalizePostShape),
    nextCursor: payload?.nextCursor ?? payload?.cursor ?? null,
    fallbackReason: payload?.fallbackReason || payload?.data?.fallbackReason || null,
    scope: payload?.scope || payload?.data?.scope,
  };
}

export function normalizeSearchResponse(payload) {
  return {
    ...payload,
    people: (payload?.people || payload?.users || payload?.data?.people || payload?.data?.users || []).map(normalizeUserShape),
    posts: (payload?.posts || payload?.items || payload?.data?.posts || []).map(normalizePostShape),
  };
}
