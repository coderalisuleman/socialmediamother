import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Info, Link2, MessageCircle, Pause, Pencil, Play, Send, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';
import { useInView, useReducedMotion } from '../lib/hooks';
import { postPath } from '../lib/routes';
import { HugIcon, OceanWave, PersonSilhouette, ThrowIcon } from './IconArt';

export function Avatar({ person, size = 'medium' }) {
  const initials = person?.name?.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'M';
  if (person?.avatar) {
    return <img className={`avatar avatar-${size}`} src={person.avatar} alt="" loading="lazy" />;
  }
  return (
    <span className={`avatar avatar-${size} avatar-fallback`} aria-hidden="true">
      <PersonSilhouette gender={person?.gender} />
      <b>{initials}</b>
    </span>
  );
}

function VideoSlide({ item, active, inView }) {
  const videoRef = useRef(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active && inView && !paused) video.play().catch(() => {});
    else video.pause();
  }, [active, inView, paused]);

  return (
    <div className="video-wrap">
      <video
        ref={videoRef}
        src={item.src}
        poster={item.poster}
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={item.alt || 'Post video'}
      />
      <button type="button" className="media-play" onClick={() => setPaused((value) => !value)} aria-label={paused ? 'Play video' : 'Pause video'}>
        {paused ? <Play size={18} fill="currentColor" /> : <Pause size={18} fill="currentColor" />}
      </button>
      <span className="muted-chip">Muted</span>
    </div>
  );
}

export function MediaCarousel({ media = [], short = false, preview = false, priority = false }) {
  const [index, setIndex] = useState(0);
  const [containerRef, inView] = useInView();
  const reducedMotion = useReducedMotion();
  const touchStart = useRef(null);
  const current = media[index];

  useEffect(() => {
    if (!inView || reducedMotion || media.length < 2 || preview) return undefined;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % media.length), 5600);
    return () => window.clearInterval(timer);
  }, [inView, media.length, preview, reducedMotion]);

  useEffect(() => {
    if (index >= media.length) setIndex(0);
  }, [index, media.length]);

  const move = (direction) => {
    if (!media.length) return;
    setIndex((value) => (value + direction + media.length) % media.length);
  };

  if (!current) return null;
  return (
    <div
      ref={containerRef}
      className={`media-carousel ${short ? 'short-carousel' : ''}`}
      onTouchStart={(event) => { touchStart.current = event.touches[0].clientX; }}
      onTouchEnd={(event) => {
        if (touchStart.current == null) return;
        const distance = event.changedTouches[0].clientX - touchStart.current;
        if (Math.abs(distance) > 45) move(distance > 0 ? -1 : 1);
        touchStart.current = null;
      }}
    >
      <div className="media-stage">
        {current.type === 'video' ? (
          <VideoSlide item={current} active inView={inView || preview} />
        ) : (
          <img
            src={current.src}
            alt={current.alt || `Post image ${index + 1}`}
            loading={(preview || priority) && index === 0 ? 'eager' : 'lazy'}
            fetchpriority={(preview || priority) && index === 0 ? 'high' : 'auto'}
          />
        )}
        {media.length > 1 && (
          <>
            <button type="button" className="page-fold page-fold-left" onClick={() => move(-1)} aria-label="Previous item">
              <ChevronLeft size={21} />
            </button>
            <button type="button" className="page-fold page-fold-right" onClick={() => move(1)} aria-label="Next item">
              <ChevronRight size={21} />
            </button>
          </>
        )}
      </div>
      {media.length > 1 && (
        <div className="page-meter" aria-label={`Item ${index + 1} of ${media.length}`}>
          <span className="page-count">{index + 1}<i />{media.length}</span>
          <div className="page-track">
            <span
              key={`${index}-${inView}`}
              className={inView && !reducedMotion && !preview ? 'running' : ''}
              style={{ width: preview ? `${((index + 1) / media.length) * 100}%` : undefined }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ReactionBar({ post, viewer, onRequireAuth }) {
  const storageKey = `mother.reaction.${post.id}`;
  const [reaction, setReaction] = useState(() => {
    try { return post.reaction || localStorage.getItem(storageKey) || null; } catch { return post.reaction || null; }
  });
  const [counts, setCounts] = useState({ hug: Number(post.hugs || 0), throw: Number(post.throws || 0) });
  const [pending, setPending] = useState(false);

  const react = async (next) => {
    if (pending) return;
    if (!viewer) {
      onRequireAuth?.();
      return;
    }
    setPending(true);
    const previous = reaction;
    const final = previous === next ? null : next;
    setReaction(final);
    try {
      if (final) localStorage.setItem(storageKey, final);
      else localStorage.removeItem(storageKey);
    } catch { /* Storage can be unavailable in private browsing. */ }
    setCounts((current) => ({
      hug: Math.max(0, current.hug + (final === 'hug' ? 1 : 0) - (previous === 'hug' ? 1 : 0)),
      throw: Math.max(0, current.throw + (final === 'throw' ? 1 : 0) - (previous === 'throw' ? 1 : 0)),
    }));
    try {
      const payload = await api.reactToPost(post.id, final);
      const confirmed = payload?.post;
      if (confirmed) {
        const savedReaction = payload.reaction ?? confirmed.viewerReaction ?? null;
        setReaction(savedReaction);
        try {
          if (savedReaction) localStorage.setItem(storageKey, savedReaction);
          else localStorage.removeItem(storageKey);
        } catch { /* The visual state is still retained in React. */ }
        setCounts({
          hug: Number(confirmed.hugCount || 0),
          throw: Number(confirmed.throwCount || 0),
        });
      }
    } catch (error) {
      if (error?.status && error.status !== 404) {
        setReaction(previous);
        try {
          if (previous) localStorage.setItem(storageKey, previous);
          else localStorage.removeItem(storageKey);
        } catch { /* Ignore storage failures. */ }
        setCounts((current) => ({
          hug: Math.max(0, current.hug - (final === 'hug' ? 1 : 0) + (previous === 'hug' ? 1 : 0)),
          throw: Math.max(0, current.throw - (final === 'throw' ? 1 : 0) + (previous === 'throw' ? 1 : 0)),
        }));
        if (error.status === 401) onRequireAuth?.();
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="reaction-bar">
      <button type="button" className={`reaction hug ${reaction === 'hug' ? 'active' : ''}`} onClick={() => react('hug')} aria-pressed={reaction === 'hug'} disabled={pending}>
        <span className="tooltip">Hug</span>
        <HugIcon filled={reaction === 'hug'} />
        <span><strong>{counts.hug.toLocaleString('en-US').replaceAll(',', '')}</strong><small>hugs</small></span>
      </button>
      <button type="button" className={`reaction throw ${reaction === 'throw' ? 'active' : ''}`} onClick={() => react('throw')} aria-pressed={reaction === 'throw'} disabled={pending}>
        <span className="tooltip">Throw</span>
        <ThrowIcon filled={reaction === 'throw'} />
        <span><strong>{counts.throw.toLocaleString('en-US').replaceAll(',', '')}</strong><small>throws</small></span>
      </button>
    </div>
  );
}

function localComments(postId) {
  try { return JSON.parse(localStorage.getItem(`mother.comments.${postId}`) || '[]'); } catch { return []; }
}

function saveLocalComments(postId, comments) {
  try { localStorage.setItem(`mother.comments.${postId}`, JSON.stringify(comments)); } catch { /* Keep the in-page copy. */ }
}

function CommentPanel({ post, viewer, onRequireAuth, onClose }) {
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editBody, setEditBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.listComments(post.id).then((payload) => {
      if (active) setComments(payload?.comments || []);
    }).catch(() => {
      if (active) setComments(localComments(post.id));
    }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [post.id]);

  const addComment = async (event) => {
    event.preventDefault();
    const clean = body.trim();
    if (!viewer) return onRequireAuth?.();
    if (!clean || pending) return;
    setPending(true);
    setError('');
    try {
      const payload = await api.createComment(post.id, clean);
      setComments((current) => [...current, payload.comment]);
    } catch (submitError) {
      if (submitError?.status === 401) {
        onRequireAuth?.();
      } else if (!submitError?.status || submitError.status === 404) {
        const local = { id: `local-comment-${Date.now()}`, body: clean, author: viewer, createdAt: new Date().toISOString(), local: true };
        setComments((current) => {
          const next = [...current, local];
          saveLocalComments(post.id, next.filter((item) => item.local));
          return next;
        });
      } else setError(submitError.message || 'Your comment could not be sent.');
    } finally {
      setBody('');
      setPending(false);
    }
  };

  const saveEdit = async (comment) => {
    const clean = editBody.trim();
    if (!clean || pending) return;
    setPending(true);
    setError('');
    try {
      if (comment.local) throw Object.assign(new Error('local'), { status: 404 });
      const payload = await api.updateComment(post.id, comment.id, clean);
      setComments((current) => current.map((item) => item.id === comment.id ? payload.comment : item));
    } catch (saveError) {
      if (!saveError?.status || saveError.status === 404) {
        setComments((current) => {
          const next = current.map((item) => item.id === comment.id ? { ...item, body: clean, updatedAt: new Date().toISOString() } : item);
          saveLocalComments(post.id, next.filter((item) => item.local));
          return next;
        });
      } else setError(saveError.message || 'That comment could not be edited.');
    } finally {
      setEditingId(null);
      setEditBody('');
      setPending(false);
    }
  };

  const removeComment = async (comment) => {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      if (comment.local) throw Object.assign(new Error('local'), { status: 404 });
      await api.deleteComment(post.id, comment.id);
      setComments((current) => current.filter((item) => item.id !== comment.id));
    } catch (removeError) {
      if (!removeError?.status || removeError.status === 404) {
        setComments((current) => {
          const next = current.filter((item) => item.id !== comment.id);
          saveLocalComments(post.id, next.filter((item) => item.local));
          return next;
        });
      } else setError(removeError.message || 'That comment could not be deleted.');
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="comment-panel" aria-label="Comments">
      <header><strong>Speak on it</strong><button type="button" onClick={onClose} aria-label="Close comments"><X size={17} /></button></header>
      <form className="comment-compose" onSubmit={addComment}>
        <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength="2000" rows="3" placeholder="Write your comment…" autoFocus />
        <div><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={!body.trim() || pending}><Send size={15} /> Send</button></div>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="comment-list">
        {loading ? <p>Gathering comments…</p> : comments.length ? comments.map((comment) => {
          const own = viewer && (String(comment.author?.id) === String(viewer.id) || comment.author?.username === viewer.username);
          return (
            <article key={comment.id}>
              <Avatar person={comment.author} size="small" />
              <div className="comment-content">
                <strong>{comment.author?.name || comment.author?.fullName || 'Mother member'} <small>@{comment.author?.username}</small></strong>
                {editingId === comment.id ? (
                  <div className="comment-edit"><textarea value={editBody} onChange={(event) => setEditBody(event.target.value)} maxLength="2000" rows="2" /><span><button type="button" onClick={() => setEditingId(null)}>Cancel</button><button type="button" onClick={() => saveEdit(comment)}>Save</button></span></div>
                ) : <p>{comment.body}</p>}
              </div>
              {own && editingId !== comment.id && <div className="comment-tools"><button type="button" onClick={() => { setEditingId(comment.id); setEditBody(comment.body); }} title="Edit comment" aria-label="Edit comment"><Pencil size={15} /></button><button type="button" onClick={() => removeComment(comment)} title="Delete comment" aria-label="Delete comment"><Trash2 size={15} /></button></div>}
            </article>
          );
        }) : <p>No comments yet. You can speak first.</p>}
      </div>
    </section>
  );
}

export function FeedCard({ post, onPerson, onPost, viewer, onRequireAuth, priority = false }) {
  const isText = post.type === 'text';
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [cardRef, cardInView] = useInView({ rootMargin: '0px', threshold: 0.6 });
  const viewRecorded = useRef(false);
  useEffect(() => {
    if (!viewer || !cardInView || viewRecorded.current || !post.id) return undefined;
    const timer = window.setTimeout(() => {
      viewRecorded.current = true;
      api.recordPostView(post.id).catch(() => {});
    }, 900);
    return () => window.clearTimeout(timer);
  }, [cardInView, post.id, viewer]);

  return (
    <article ref={cardRef} className={`feed-card card-${post.type}`}>
      <header className="post-header">
        <button type="button" className="person-line" onClick={() => onPerson?.(post.author)}>
          <Avatar person={post.author} />
          <span>
            <strong>{post.author?.name || 'Mother member'}</strong>
            <small>@{post.author?.username || 'someone'} · {post.createdAt || 'now'}</small>
          </span>
        </button>
      </header>

      {isText ? (
        <div className="text-post-body">
          <p className="text-thought">{post.text}</p>
        </div>
      ) : (
        <MediaCarousel media={post.media} short={post.type === 'short-video'} priority={priority} />
      )}

      {!isText && detailsOpen && <div className="post-copy post-details-copy">
        {!isText && <h2>{post.name}</h2>}
        {post.detail && <p>{post.detail}</p>}
        {post.id && (
          <a
            className="post-permalink"
            href={postPath(post.id)}
            onClick={(event) => {
              if (!onPost || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              onPost(post);
            }}
          >
            Open this post <Link2 size={14} />
          </a>
        )}
        {(post.links?.length ? post.links : post.link ? [post.link] : []).map((link, index) => (
          <a href={link} target="_blank" rel="noreferrer" key={`${link}-${index}`}>
            Visit {index ? 'another' : 'their'} other place <ExternalLink size={14} />
          </a>
        ))}
      </div>}
      <div className={`post-action-row ${isText ? 'text-actions' : ''}`}>
        <ReactionBar post={post} viewer={viewer} onRequireAuth={onRequireAuth} />
        <button type="button" className={`speak-button ${commentsOpen ? 'active' : ''}`} onClick={() => setCommentsOpen((value) => !value)}><MessageCircle size={18} /> <span>Speak on it</span></button>
        {!isText && <button type="button" className={`details-button ${detailsOpen ? 'active' : ''}`} onClick={() => setDetailsOpen((value) => !value)}><Info size={18} /> <span>Full details of it</span></button>}
      </div>
      {commentsOpen && <CommentPanel post={post} viewer={viewer} onRequireAuth={onRequireAuth} onClose={() => setCommentsOpen(false)} />}
    </article>
  );
}

export function FeedSkeleton() {
  return (
    <div className="feed-skeleton" aria-label="Loading posts" aria-busy="true">
      {[0, 1].map((value) => (
        <div className="skeleton-card" key={value}>
          <div className="skeleton-line short" />
          <div className="skeleton-media" />
          <div className="skeleton-line" />
          <div className="skeleton-line medium" />
        </div>
      ))}
    </div>
  );
}

export function EmptyFeed({ following = false, onEveryone }) {
  return (
    <div className="empty-state">
      <span className="empty-orbit"><span>♡</span></span>
      <h2>{following ? 'Your circle is still a quiet room.' : 'Nothing has been placed here yet.'}</h2>
      <p>{following ? 'Be with a few people and their posts will gather here. Until then, everyone is just next door.' : 'You can be the first person to share a thought.'}</p>
      {following && <button type="button" className="primary-button" onClick={onEveryone}>See everyone</button>}
    </div>
  );
}

export function LoadMore({ loading, done, onClick }) {
  if (done) return <p className="feed-end">You reached a quiet shore. More soon.</p>;
  return (
    <button type="button" className="load-more" onClick={onClick} disabled={loading}>
      <OceanWave />
      <span>{loading ? 'Gathering the next wave…' : 'Load more'}</span>
    </button>
  );
}
