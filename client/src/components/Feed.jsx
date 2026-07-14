import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Info, Link2, MessageCircle, Pencil, Play, Send, Square, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';
import { trackAnalytics } from '../lib/analytics';
import { useInView, useReducedMotion } from '../lib/hooks';
import { postPath } from '../lib/routes';
import { HugIcon, OceanWave, PersonSilhouette, ThrowIcon } from './IconArt';

export function Avatar({ person, size = 'medium' }) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [avatarLoaded, setAvatarLoaded] = useState(false);
  useEffect(() => {
    setAvatarFailed(false);
    setAvatarLoaded(false);
  }, [person?.avatar]);
  const initials = person?.name?.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'M';
  if (person?.avatar && !avatarFailed) {
    return <img className={`avatar avatar-${size} ${avatarLoaded ? 'asset-ready' : 'asset-loading'}`} src={person.avatar} alt="" loading="lazy" onLoad={() => setAvatarLoaded(true)} onError={() => setAvatarFailed(true)} />;
  }
  return (
    <span className={`avatar avatar-${size} avatar-fallback`} aria-hidden="true">
      <PersonSilhouette gender={person?.gender} />
      <b>{initials}</b>
    </span>
  );
}

function DrumSoundIcon({ soundOn }) {
  return (
    <svg className="drum-sound-icon" viewBox="0 0 34 30" aria-hidden="true">
      <ellipse cx="17" cy="12" rx="10" ry="4" />
      <path d="M7 12v10c0 3 20 3 20 0V12" />
      <path d="M9 17h16M12 14v10m10-10v10" />
      {soundOn && <g className="drum-sticks"><path d="m7 3 10 9M27 3 17 12" /><circle cx="7" cy="3" r="1.6" /><circle cx="27" cy="3" r="1.6" /></g>}
    </svg>
  );
}

function HumanRopeIcon({ expanded }) {
  return (
    <svg className={`human-rope-icon ${expanded ? 'is-expanded' : ''}`} viewBox="0 0 42 32" aria-hidden="true">
      <path className="stretch-rope rope-left" d={expanded ? 'M1 10 14 13' : 'M8 12c2 0 3 1 6 1'} />
      <path className="stretch-rope rope-right" d={expanded ? 'M28 13 41 10' : 'M28 13c3 0 4-1 6-1'} />
      {expanded && <><circle className="stretch-rope-end" cx="2" cy="10" r="1.5" /><circle className="stretch-rope-end" cx="40" cy="10" r="1.5" /></>}
      <circle className="stretch-head" cx="21" cy="6" r="4" />
      <path className="stretch-body" d="M17 13c1-3 2-4 4-4s3 1 4 4l1 9-3 1-1-7v13h-3V16l-1 7-3-1 2-9Z" />
      <path className="stretch-arm arm-left" d="M18 13h-4" />
      <path className="stretch-arm arm-right" d="M24 13h4" />
      <circle className="stretch-hand" cx="14" cy="13" r="1.6" />
      <circle className="stretch-hand" cx="28" cy="13" r="1.6" />
      <path className="stretch-leg" d="m20 29-4 2m6-2 4 2" />
    </svg>
  );
}

function TreasureIcon({ open }) {
  return (
    <svg className={`treasure-icon ${open ? 'open' : ''}`} viewBox="0 0 42 35" aria-hidden="true">
      <path className="treasure-lid" d="M5 15V11C5 6 10 3 21 3s16 3 16 8v4H5Z" />
      <path className="treasure-box" d="M4 15h34v16H4z" />
      <path className="treasure-bands" d="M11 5v26m20-26v26M4 21h34" />
      <circle className="treasure-lock" cx="21" cy="22" r="3" />
    </svg>
  );
}

function MercedesZoomIcon() {
  return (
    <svg className="mercedes-zoom-icon" viewBox="0 0 58 42" aria-hidden="true">
      <circle className="zoom-sun" cx="46" cy="9" r="6" />
      <path className="zoom-sea" d="M2 17c8-4 14 4 22 0s14 4 22 0 8 0 10 0v8H2Z" />
      <path className="zoom-road" d="m18 20 20 0 15 20H5Z" />
      <path className="zoom-lane" d="m28 23 1 5m1 3 2 7" />
      <path className="zoom-car" d="M16 30h25l4 4v4H12v-4l4-4Zm5 0 3-5h11l4 5" />
      <circle className="zoom-wheel" cx="18" cy="38" r="3" /><circle className="zoom-wheel" cx="39" cy="38" r="3" />
      <circle className="zoom-star" cx="29" cy="34" r="2.5" /><path className="zoom-star" d="M29 31.5v5M26.8 35.3l4.4-2.6m0 2.6-4.4-2.6" />
    </svg>
  );
}

function formatMediaTime(value) {
  const total = Math.max(0, Math.floor(Number(value) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${hours ? `${hours}:` : ''}${String(minutes).padStart(hours ? 2 : 1, '0')}:${String(seconds).padStart(2, '0')}`;
}

function AssetError({ message, onRetry }) {
  return (
    <div className="media-error" role="alert">
      <strong>{message}</strong>
      <small>Check your internet connection, then try loading this item again.</small>
      <button type="button" onClick={(event) => { event.stopPropagation(); onRetry(); }}>Retry</button>
    </div>
  );
}

function ImageSlide({ item, index, preview, priority, zoom }) {
  const [status, setStatus] = useState('loading');
  const [retryKey, setRetryKey] = useState(0);
  return (
    <div className={`image-wrap ${status === 'loading' ? 'media-is-loading' : ''}`}>
      <img
        key={retryKey}
        src={item.src}
        alt={item.alt || `Post image ${index + 1}`}
        loading={(preview || priority) && index === 0 ? 'eager' : 'lazy'}
        fetchPriority={(preview || priority) && index === 0 ? 'high' : 'auto'}
        onLoad={() => setStatus('ready')}
        onError={() => setStatus('error')}
        style={{ transform: `scale(${zoom})` }}
      />
      {status === 'loading' && <span className="media-loading-message">Loading photo…</span>}
      {status === 'error' && <AssetError message="This photo could not be loaded." onRetry={() => { setStatus('loading'); setRetryKey((value) => value + 1); }} />}
    </div>
  );
}

function VideoSlide({ item, active, inView, controlsVisible, analyticsContext }) {
  const videoRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [status, setStatus] = useState('loading');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [manual, setManual] = useState({ hours: '', minutes: '', seconds: '' });
  const [retryKey, setRetryKey] = useState(0);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    if (active && inView && !paused) video.play().catch(() => {});
    else video.pause();
  }, [active, inView, muted, paused]);

  useEffect(() => {
    if (!active || !inView || paused || status !== 'ready' || !analyticsContext?.postId) return undefined;
    const startedAt = performance.now();
    return () => {
      const durationMs = performance.now() - startedAt;
      if (durationMs >= 300) trackAnalytics('media_watch', { ...analyticsContext, durationMs, metadata: { format: analyticsContext.format } });
    };
  }, [active, analyticsContext?.format, analyticsContext?.postAuthorId, analyticsContext?.postId, inView, paused, status]);

  return (
    <div className={`video-wrap ${status === 'loading' ? 'media-is-loading' : ''}`}>
      <video
        key={retryKey}
        ref={videoRef}
        src={item.src}
        poster={item.poster}
        muted={muted}
        loop
        playsInline
        preload="metadata"
        aria-label={item.alt || 'Post video'}
        onLoadStart={() => setStatus('loading')}
        onLoadedData={() => setStatus('ready')}
        onLoadedMetadata={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
        onDurationChange={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime || 0)}
        onError={() => setStatus('error')}
      />
      {status === 'loading' && <span className="media-loading-message">Loading video details…</span>}
      {status === 'error' && <AssetError message="This video could not be loaded." onRetry={() => { setStatus('loading'); setRetryKey((value) => value + 1); }} />}
      {controlsVisible && status !== 'error' && <button type="button" className="media-play" onClick={(event) => { event.stopPropagation(); setPaused((value) => !value); }} aria-label={paused ? 'Play video' : 'Stop video'}>
        {paused ? <Play size={22} fill="currentColor" /> : <Square size={20} fill="currentColor" />}
      </button>}
      {controlsVisible && status !== 'error' && (
        <div className="video-time-controls" onClick={(event) => event.stopPropagation()}>
          <div className="video-time-readout"><strong>{formatMediaTime(currentTime)}</strong><span>/</span><strong>{formatMediaTime(duration)}</strong></div>
          <input
            className="video-seek"
            type="range"
            min="0"
            max={Math.max(duration, 0.1)}
            step="0.1"
            value={Math.min(currentTime, Math.max(duration, 0.1))}
            aria-label="Choose the video time"
            style={{ '--watched': `${duration ? (currentTime / duration) * 100 : 0}%` }}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (videoRef.current) videoRef.current.currentTime = next;
              setCurrentTime(next);
            }}
          />
          <div className="manual-time-jump">
            <span>Go exactly to</span>
            {['hours', 'minutes', 'seconds'].map((unit) => <label key={unit}><input type="number" min="0" max={unit === 'hours' ? 999 : 59} inputMode="numeric" value={manual[unit]} onChange={(event) => setManual((value) => ({ ...value, [unit]: event.target.value.replace(/\D/g, '').slice(0, 3) }))} /><small>{unit[0]}</small></label>)}
            <button type="button" onClick={() => {
              const requested = Number(manual.hours || 0) * 3600 + Number(manual.minutes || 0) * 60 + Number(manual.seconds || 0);
              const next = Math.min(Math.max(0, requested), duration || 0);
              if (videoRef.current) videoRef.current.currentTime = next;
              setCurrentTime(next);
            }}>Go</button>
          </div>
        </div>
      )}
      {controlsVisible && status !== 'error' && <button type="button" className={`media-sound ${muted ? 'muted' : 'sound-on'}`} onClick={(event) => { event.stopPropagation(); setMuted((value) => !value); }} aria-label={muted ? 'Turn sound on' : 'Mute video'} title={muted ? 'Turn sound on' : 'Mute video'}><DrumSoundIcon soundOn={!muted} /><span>{muted ? 'Sound off' : 'Sound on'}</span></button>}
    </div>
  );
}

export function MediaCarousel({ media = [], short = false, preview = false, priority = false, postId = '', postAuthorId = '', postFormat = '' }) {
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [toolboxOpen, setToolboxOpen] = useState(false);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [containerRef, inView] = useInView();
  const reducedMotion = useReducedMotion();
  const touchStart = useRef(null);
  const current = media[index];

  useEffect(() => {
    if (!inView || reducedMotion || media.length < 2 || preview || carouselPaused) return undefined;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % media.length), 5600);
    return () => window.clearInterval(timer);
  }, [carouselPaused, inView, media.length, preview, reducedMotion]);

  useEffect(() => {
    if (index >= media.length) setIndex(0);
  }, [index, media.length]);

  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === containerRef.current || document.webkitFullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', update);
    document.addEventListener('webkitfullscreenchange', update);
    return () => {
      document.removeEventListener('fullscreenchange', update);
      document.removeEventListener('webkitfullscreenchange', update);
    };
  }, [containerRef]);

  const move = (direction) => {
    if (!media.length) return;
    setIndex((value) => (value + direction + media.length) % media.length);
  };

  useEffect(() => {
    setZoom(1);
  }, [index]);

  const toggleFullscreen = async () => {
    const node = containerRef.current;
    const active = document.fullscreenElement || document.webkitFullscreenElement;
    try {
      if (active) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else document.webkitExitFullscreen?.();
      } else if (node?.requestFullscreen) {
        await node.requestFullscreen();
      } else if (node?.webkitRequestFullscreen) {
        node.webkitRequestFullscreen();
      } else {
        node?.querySelector('video')?.webkitEnterFullscreen?.();
      }
    } catch {
      // Browsers can reject fullscreen when the user has disabled it.
    }
  };

  if (!current) return null;
  return (
    <div
      ref={containerRef}
      className={`media-carousel ${short ? 'short-carousel' : ''} ${controlsVisible ? 'controls-visible' : ''}`}
      onClick={() => {
        if (preview) return;
        setControlsVisible((value) => {
          if (value) setToolboxOpen(false);
          return !value;
        });
      }}
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
          <VideoSlide item={current} active inView={inView || preview} controlsVisible={controlsVisible} analyticsContext={preview ? null : { postId, postAuthorId, targetType: 'post', targetId: postId, format: postFormat }} />
        ) : (
          <ImageSlide item={current} index={index} preview={preview} priority={priority} zoom={zoom} />
        )}
        {media.length > 1 && (
          <>
            <button type="button" className="page-fold page-fold-left" onClick={(event) => { event.stopPropagation(); move(-1); }} aria-label="Previous item">
              <ChevronLeft size={21} />
            </button>
            <button type="button" className="page-fold page-fold-right" onClick={(event) => { event.stopPropagation(); move(1); }} aria-label="Next item">
              <ChevronRight size={21} />
            </button>
          </>
        )}
        {!preview && controlsVisible && current.type !== 'video' && media.length > 1 && <button type="button" className="media-play carousel-play" onClick={(event) => { event.stopPropagation(); setCarouselPaused((value) => !value); }} aria-label={carouselPaused ? 'Continue photo carousel' : 'Stop photo carousel'}>{carouselPaused ? <Play size={22} fill="currentColor" /> : <Square size={20} fill="currentColor" />}</button>}
        {!preview && controlsVisible && <button type="button" className={`media-toolbox-trigger ${toolboxOpen ? 'active' : ''}`} onClick={(event) => { event.stopPropagation(); setToolboxOpen((value) => !value); }} aria-expanded={toolboxOpen} aria-label="Many things: full screen and zoom"><TreasureIcon open={toolboxOpen} /><span>Many things</span></button>}
        {!preview && controlsVisible && toolboxOpen && (
          <div className="media-toolbox" onClick={(event) => event.stopPropagation()}>
            <header><strong>Many things</strong><button type="button" onClick={() => setToolboxOpen(false)} aria-label="Close many things"><X size={18} /></button></header>
            <button type="button" className={`media-fullscreen ${fullscreen ? 'active' : ''}`} onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit full screen' : 'View media full screen'}><HumanRopeIcon expanded={fullscreen} /><span>{fullscreen ? 'Exit full screen' : 'Full screen'}</span></button>
            <label className="media-zoom-control"><MercedesZoomIcon /><span>Photo zoom <b>{Math.round(zoom * 100)}%</b></span><input type="range" min="1" max="3" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} aria-label="Zoom photo in or out" /></label>
          </div>
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
      trackAnalytics(final ? `post_${final}` : 'post_reaction_removed', { targetType: 'post', targetId: post.id, postId: post.id, postAuthorId: post.author?.id, metadata: { action: final || 'removed', format: post.type } });
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

function CommentPanel({ post, viewer, onRequireAuth, onClose, onCountChange }) {
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
      if (active) {
        const next = payload?.comments || [];
        setComments(next);
        onCountChange?.(next.length);
      }
    }).catch(() => {
      if (active) {
        const next = localComments(post.id);
        setComments(next);
        onCountChange?.(next.length);
      }
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
      trackAnalytics('post_thought', { targetType: 'post', targetId: post.id, postId: post.id, postAuthorId: post.author?.id, metadata: { format: post.type } });
      setComments((current) => {
        const next = [...current, payload.comment];
        onCountChange?.(next.length);
        return next;
      });
    } catch (submitError) {
      if (submitError?.status === 401) {
        onRequireAuth?.();
      } else if (!submitError?.status || submitError.status === 404) {
        const local = { id: `local-comment-${Date.now()}`, body: clean, author: viewer, createdAt: new Date().toISOString(), local: true };
        setComments((current) => {
          const next = [...current, local];
          saveLocalComments(post.id, next.filter((item) => item.local));
          onCountChange?.(next.length);
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
      setComments((current) => {
        const next = current.filter((item) => item.id !== comment.id);
        onCountChange?.(next.length);
        return next;
      });
    } catch (removeError) {
      if (!removeError?.status || removeError.status === 404) {
        setComments((current) => {
          const next = current.filter((item) => item.id !== comment.id);
          saveLocalComments(post.id, next.filter((item) => item.local));
          onCountChange?.(next.length);
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

export function FeedCard({ post, onPerson, onPost, onDelete, viewer, onRequireAuth, priority = false }) {
  const isText = post.type === 'text';
  const own = Boolean(viewer && (String(post.author?.id || '') === String(viewer.id || '') || post.author?.username === viewer.username));
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(Number(post.comments || 0));
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cardRef, cardInView] = useInView({ rootMargin: '0px', threshold: 0.6 });
  const viewRecorded = useRef(false);
  useEffect(() => {
    if (!viewer || !cardInView || viewRecorded.current || !post.id) return undefined;
    const timer = window.setTimeout(() => {
      viewRecorded.current = true;
      api.recordPostView(post.id).catch(() => {});
      trackAnalytics('post_view', { targetType: 'post', targetId: post.id, postId: post.id, postAuthorId: post.author?.id, metadata: { format: post.type } });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [cardInView, post.id, viewer]);

  const removePost = async () => {
    if (!onDelete || deleting) return;
    setDeleting(true);
    try {
      await onDelete(post);
    } finally {
      setDeleting(false);
    }
  };

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
        {own && <button type="button" className="post-delete-trigger" onClick={() => setDeleteConfirm(true)} aria-label="Delete your post" title="Delete your post"><Trash2 size={18} /></button>}
      </header>

      {deleteConfirm && (
        <div className="post-delete-confirm" role="alertdialog" aria-label="Delete this post?">
          <span><Trash2 size={17} /><strong>Delete this post?</strong><small>It will disappear for everyone.</small></span>
          <div><button type="button" onClick={() => setDeleteConfirm(false)} disabled={deleting}>Cancel</button><button type="button" className="delete-confirm-button" onClick={removePost} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</button></div>
        </div>
      )}

      {isText ? (
        <div className="text-post-body">
          <p className="text-thought">{post.text}</p>
        </div>
      ) : (
        <MediaCarousel media={post.media} short={post.type === 'short-video'} priority={priority} postId={post.id} postAuthorId={post.author?.id} postFormat={post.type} />
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
        <button type="button" className={`speak-button ${commentsOpen ? 'active' : ''}`} onClick={() => setCommentsOpen((value) => !value)}><span className="thought-count"><MessageCircle size={18} /><b>{commentCount.toLocaleString('en-US').replaceAll(',', '')}</b></span><span>Speak on it</span></button>
        {!isText && <button type="button" className={`details-button ${detailsOpen ? 'active' : ''}`} onClick={() => setDetailsOpen((value) => !value)}><Info size={18} /> <span>Full details of it</span></button>}
      </div>
      {commentsOpen && <CommentPanel post={post} viewer={viewer} onRequireAuth={onRequireAuth} onClose={() => setCommentsOpen(false)} onCountChange={setCommentCount} />}
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
