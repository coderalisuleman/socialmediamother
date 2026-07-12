import { inChunks } from '../utils/cursor.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const scorePost = (post, viewer) => {
  const ageHours = Math.max(0, (Date.now() - new Date(post.createdAt).getTime()) / 3_600_000);
  const recency = Math.exp(-ageHours / 42) * 8;
  const positiveEngagement = Math.log1p((post.hugCount || 0) * 2 + (post.viewCount || 0) * 0.12);
  const negativeEngagement = Math.log1p(post.throwCount || 0) * 0.7;
  const preference = clamp(Number(viewer?.typePreferences?.[post.type] || 0), -5, 15) * 0.7;
  const authorId = String(post.author?.id || post.author?._id || '');
  const followsAuthor = viewer?.followingIds?.some((id) => String(id) === authorId);
  const authorAffinity = followsAuthor ? 3.5 : authorId && authorId === String(viewer?.id) ? 0.8 : 0;
  return recency + positiveEngagement - negativeEngagement + preference + authorAffinity;
};

export const rankFeedChunk = async (posts, viewer) => {
  const scored = [];
  for await (const chunk of inChunks(posts, 25)) {
    for (const post of chunk) scored.push({ post, score: scorePost(post, viewer) });
  }
  scored.sort((a, b) => b.score - a.score || new Date(b.post.createdAt) - new Date(a.post.createdAt));

  // Avoid an otherwise repetitive run from one author while preserving score order.
  for (let index = 1; index < scored.length; index += 1) {
    if (scored[index].post.author?.id === scored[index - 1].post.author?.id) {
      const alternative = scored.findIndex((item, candidateIndex) => candidateIndex > index && item.post.author?.id !== scored[index - 1].post.author?.id);
      if (alternative > index) [scored[index], scored[alternative]] = [scored[alternative], scored[index]];
    }
  }
  return scored;
};
