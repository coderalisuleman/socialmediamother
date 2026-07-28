export function isWatchTimePost(postOrType) {
  const type = typeof postOrType === 'string' ? postOrType : postOrType?.type;
  return type === 'video' || type === 'short-video';
}

export function positiveAnalyticsCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? count : 0;
}
