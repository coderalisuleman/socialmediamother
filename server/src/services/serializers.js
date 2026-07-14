const fileUrl = (fileId) => fileId ? `/api/files/${fileId}` : null;

export const publicUser = (user, { viewerFollows = false } = {}) => {
  if (!user) return null;
  return {
    id: String(user.id || user._id),
    fullName: user.fullName,
    username: user.username,
    handle: `@${user.username}`,
    gender: user.gender,
    bio: user.bio || '',
    profileImageUrl: fileUrl(user.profileImageFileId),
    peopleWhoWantToBeWithMe: Number(user.followerCount || 0),
    peopleIWantToBeWith: Number(user.followingCount || 0),
    viewerWantsToBeWithThem: Boolean(viewerFollows),
    createdAt: user.createdAt
  };
};

export const privateUser = (user) => ({
  ...publicUser(user),
  email: user.email || null,
  phone: user.phone || null,
  verifiedEmail: Boolean(user.verifiedEmail),
  verifiedPhone: Boolean(user.verifiedPhone),
  typePreferences: user.typePreferences || { text: 0, photo: 0, video: 0, 'short-video': 0 }
});

export const publicPost = (post, { viewerReaction = null, viewerFollowsAuthor = false, score } = {}) => ({
  id: String(post.id || post._id),
  type: post.type,
  text: post.text || '',
  nameIt: post.nameIt || '',
  detail: post.detail || '',
  links: post.links || [],
  media: (post.media || []).map((item, index) => ({
    fileId: item.fileId ? String(item.fileId) : null,
    url: item.fileId ? fileUrl(item.fileId) : item.url || null,
    filename: item.filename,
    contentType: item.contentType,
    size: Number(item.size || 0),
    order: item.order ?? index,
    alt: item.alt || ''
  })),
  author: publicUser(post.author, { viewerFollows: viewerFollowsAuthor }),
  hugCount: Number(post.hugCount || 0),
  throwCount: Number(post.throwCount || 0),
  viewCount: Number(post.viewCount || 0),
  commentCount: Number(post.commentCount || 0),
  viewerReaction,
  ...(score != null ? { recommendationScore: Number(score.toFixed(4)) } : {}),
  createdAt: post.createdAt,
  updatedAt: post.updatedAt
});

export const publicComment = (comment) => ({
  id: String(comment.id || comment._id),
  postId: String(comment.post?.id || comment.post?._id || comment.post),
  body: comment.body || '',
  author: publicUser(comment.author),
  createdAt: comment.createdAt,
  updatedAt: comment.updatedAt
});
