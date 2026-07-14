import { getToken } from './api';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const SESSION_KEY = 'mother.analytics.session';
const MAX_QUEUE = 200;
let queue = [];
let flushing = false;
let lastPostContext = null;

function sessionId() {
  try {
    let value = sessionStorage.getItem(SESSION_KEY);
    if (!value) {
      value = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, value);
    }
    return value;
  } catch {
    return crypto.randomUUID();
  }
}

export function trackAnalytics(eventType, details = {}) {
  if (eventType === 'post_view' && details.postId) lastPostContext = { postId: details.postId, postAuthorId: details.postAuthorId };
  const attributed = eventType === 'creator_follow' && !details.postId && lastPostContext?.postAuthorId === details.targetId
    ? { ...details, ...lastPostContext }
    : details;
  const event = {
    sessionId: sessionId(),
    eventType,
    path: window.location.pathname,
    targetType: attributed.targetType || '',
    targetId: attributed.targetId || '',
    postId: attributed.postId || '',
    postAuthorId: attributed.postAuthorId || '',
    durationMs: Math.max(0, Number(attributed.durationMs || 0)),
    metadata: attributed.metadata || {},
    occurredAt: new Date().toISOString(),
  };
  queue.push(event);
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
  if (queue.length >= 20) flushAnalytics();
}

export async function flushAnalytics({ keepalive = false } = {}) {
  if (flushing || !queue.length) return;
  const events = queue.splice(0, 50);
  flushing = true;
  try {
    const token = getToken();
    const response = await fetch(`${API_BASE}/analytics/events`, {
      method: 'POST',
      keepalive,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ events }),
    });
    if (!response.ok) throw new Error('Analytics batch rejected');
  } catch {
    queue = [...events, ...queue].slice(0, MAX_QUEUE);
  } finally {
    flushing = false;
  }
}

export function startAnalytics() {
  const startedAt = performance.now();
  let lastPath = window.location.pathname;
  trackAnalytics('session_start', { metadata: { network: navigator.onLine ? 'online' : 'offline' } });
  const interval = window.setInterval(() => flushAnalytics(), 5000);
  const click = (event) => {
    const target = event.target?.closest?.('button, a, [role="tab"]');
    if (!target) return;
    trackAnalytics('interaction', {
      targetType: target.tagName.toLowerCase(),
      targetId: target.getAttribute('aria-label') || target.getAttribute('role') || target.className?.toString().split(' ')[0] || '',
      metadata: { action: 'click', element: target.tagName.toLowerCase() },
    });
  };
  const visibility = () => {
    trackAnalytics('visibility', { metadata: { visibility: document.visibilityState } });
    if (document.hidden) flushAnalytics({ keepalive: true });
  };
  const connection = () => trackAnalytics('connection', { metadata: { network: navigator.onLine ? 'online' : 'offline' } });
  const finish = () => {
    trackAnalytics('session_end', { durationMs: performance.now() - startedAt, metadata: { reason: 'page-leave' } });
    flushAnalytics({ keepalive: true });
  };
  document.addEventListener('click', click, true);
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('online', connection);
  window.addEventListener('offline', connection);
  window.addEventListener('pagehide', finish);

  return {
    page(path) {
      if (!path || path === lastPath) return;
      lastPath = path;
      trackAnalytics('page_view');
    },
    stop() {
      window.clearInterval(interval);
      document.removeEventListener('click', click, true);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('online', connection);
      window.removeEventListener('offline', connection);
      window.removeEventListener('pagehide', finish);
      finish();
    },
  };
}
