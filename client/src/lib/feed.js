export function filterFeedPosts(posts, feedMode) {
  if (feedMode !== 'following') return posts;
  return posts.filter((post) => post.author?.isFollowing === true);
}
