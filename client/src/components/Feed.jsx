import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Link2, Pause, Play, UserPlus } from 'lucide-react';
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
  const [reaction, setReaction] = useState(post.reaction || null);
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
    setCounts((current) => ({
      hug: Math.max(0, current.hug + (final === 'hug' ? 1 : 0) - (previous === 'hug' ? 1 : 0)),
      throw: Math.max(0, current.throw + (final === 'throw' ? 1 : 0) - (previous === 'throw' ? 1 : 0)),
    }));
    try {
      const payload = await api.reactToPost(post.id, final);
      const confirmed = payload?.post;
      if (confirmed) {
        setReaction(payload.reaction ?? confirmed.viewerReaction ?? null);
        setCounts({
          hug: Number(confirmed.hugCount || 0),
          throw: Number(confirmed.throwCount || 0),
        });
      }
    } catch (error) {
      if (error?.status) {
        setReaction(previous);
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
        <span className="tooltip">Not for me</span>
        <ThrowIcon filled={reaction === 'throw'} />
        <span><strong>{counts.throw.toLocaleString('en-US').replaceAll(',', '')}</strong><small>throws</small></span>
      </button>
    </div>
  );
}

export function FeedCard({ post, onFollow, onPerson, onPost, viewer, onRequireAuth, priority = false }) {
  const isText = post.type === 'text';
  const [cardRef, cardInView] = useInView({ rootMargin: '0px', threshold: 0.6 });
  const viewRecorded = useRef(false);
  const isOwnPost = Boolean(viewer && (
    String(post.author?.id || '') === String(viewer.id || '')
    || post.author?.username === viewer.username
  ));

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
        {!isOwnPost && (
          <button type="button" className={`follow-mini ${post.author?.isFollowing ? 'following' : ''}`} onClick={() => onFollow?.(post.author)}>
            {post.author?.isFollowing ? 'With them' : <><UserPlus size={15} /> Be with</>}
          </button>
        )}
      </header>

      {isText ? (
        <div className="text-post-body">
          <p className="text-thought">{post.text}</p>
        </div>
      ) : (
        <MediaCarousel media={post.media} short={post.type === 'short-video'} priority={priority} />
      )}

      <div className="post-copy">
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
      </div>
      <ReactionBar post={post} viewer={viewer} onRequireAuth={onRequireAuth} />
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
