import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronLeft, ChevronRight, Facebook, Github, Globe2, Image as ImageIcon, Info, Instagram, Linkedin, MessageCircle, Pencil, Play, Send, Smartphone, Square, Trash2, Video, X } from 'lucide-react';
import { api } from '../lib/api';
import { trackAnalytics } from '../lib/analytics';
import { useInView, useReducedMotion } from '../lib/hooks';
import { describeExternalLinks } from '../lib/platformLinks';
import { HugIcon, OceanWave, PersonSilhouette, ThrowIcon } from './IconArt';

export function Avatar({ person, size = 'medium' }) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  useEffect(() => {
    setAvatarFailed(false);
  }, [person?.avatar]);
  const initials = person?.name?.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'M';
  if (person?.avatar && !avatarFailed) {
    return <img className={`avatar avatar-${size}`} src={person.avatar} alt="" loading={size === 'small' ? 'lazy' : 'eager'} decoding="async" onError={() => setAvatarFailed(true)} />;
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

function PictureScreenIcon({ expanded }) {
  return (
    <svg className={`picture-screen-icon ${expanded ? 'is-expanded' : ''}`} viewBox="0 0 44 38" aria-hidden="true">
      <rect className="picture-screen-body" x={expanded ? 2 : 11} y={expanded ? 5 : 2} width={expanded ? 40 : 22} height={expanded ? 28 : 34} rx="4" />
      <circle className="picture-screen-sun" cx={expanded ? 32 : 27} cy="12" r="3" />
      <path className="picture-screen-land" d={expanded ? 'M7 28 16 18l7 7 6-6 8 9Z' : 'M14 30 20 21l4 5 4-4 3 8Z'} />
      {!expanded && <circle className="picture-screen-home" cx="22" cy="33" r="1.3" />}
    </svg>
  );
}

function FilesFolderIcon({ open }) {
  return (
    <svg className={`files-folder-icon ${open ? 'open' : ''}`} viewBox="0 0 46 38" aria-hidden="true">
      <path className="folder-paper paper-back" d="M15 4h22v24H15z" />
      <path className="folder-paper paper-middle" d="M10 7h24v23H10z" />
      <path className="folder-tab" d="M3 12V8h15l4 4h21v21H3Z" />
      <path className="folder-front" d="M3 16h40l-4 18H7Z" />
      <path className="folder-lines" d="M15 11h13m-13 5h17" />
    </svg>
  );
}

function TelescopeZoomIcon() {
  return (
    <svg className="telescope-zoom-icon" viewBox="0 0 72 56" aria-hidden="true">
      <defs><linearGradient id="scopeBody" x1="0" x2="1"><stop stopColor="#eefaff" /><stop offset=".2" stopColor="#79cce8" /><stop offset=".62" stopColor="#315b6b" /><stop offset="1" stopColor="#14252d" /></linearGradient><radialGradient id="scopeLens"><stop stopColor="#fff" /><stop offset=".35" stopColor="#8ce7ff" /><stop offset=".7" stopColor="#247694" /><stop offset="1" stopColor="#10242e" /></radialGradient></defs>
      <ellipse className="scope-shadow" cx="38" cy="51" rx="27" ry="3" />
      <g className="scope-body" transform="rotate(-17 35 22)">
        <path className="scope-main-tube" d="M15 12h42v19H15Z" fill="url(#scopeBody)" />
        <path className="scope-eyepiece" d="M5 17h12v9H5l-3-2v-5Z" />
        <ellipse className="scope-lens-rim" cx="58" cy="21.5" rx="7" ry="11.5" />
        <ellipse className="scope-lens" cx="59" cy="21.5" rx="4.8" ry="8.5" fill="url(#scopeLens)" />
        <path className="scope-ring" d="M21 12v19m29-19v19" />
        <path className="scope-focus-knob" d="M28 31v6h9v-6" />
      </g>
      <circle className="scope-star star-one" cx="62" cy="6" r="2" /><path className="scope-star star-two" d="m68 14 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" />
      <path className="scope-stand" d="M35 34v7m0-2L18 53m17-14 17 14m-17-14v15" />
    </svg>
  );
}

function CameraFilmIcon() {
  return (
    <svg className="film-camera-icon" viewBox="0 0 58 50" aria-hidden="true">
      <defs><linearGradient id="cameraBody" x1="0" x2="1"><stop stopColor="#6d452f" /><stop offset=".48" stopColor="#2f201a" /><stop offset="1" stopColor="#17110e" /></linearGradient></defs>
      <circle cx="18" cy="13" r="9" /><circle cx="37" cy="12" r="8" /><circle cx="18" cy="13" r="3" /><circle cx="37" cy="12" r="2.7" />
      <path d="M8 21h38v24H8Z" fill="url(#cameraBody)" /><rect x="13" y="26" width="18" height="13" rx="2" /><path d="m46 27 10-5v22l-10-5Z" />
      <circle className="camera-film-wheel wheel-one" cx="18" cy="13" r="6" /><circle className="camera-film-wheel wheel-two" cx="37" cy="12" r="5" />
    </svg>
  );
}

function MediaLoading({ kind }) {
  const Icon = kind === 'photo' ? ImageIcon : kind === 'short-video' ? Smartphone : Video;
  return <div className={`media-format-loading loading-${kind}`} role="status"><Icon size={34} /><strong>Loading<span className="loading-dots" aria-hidden="true">...</span></strong></div>;
}

function PlatformIcon({ platform, size = 18 }) {
  if (platform === 'youtube') return <svg className="platform-custom-icon platform-youtube-mark" style={{ width: size, height: size }} viewBox="0 0 28 20" aria-hidden="true"><rect width="28" height="20" rx="5" /><path className="youtube-play" d="m11 5 9 5-9 5Z" /></svg>;
  if (platform === 'instagram') return <Instagram size={size} />;
  if (platform === 'facebook') return <Facebook size={size} fill="currentColor" />;
  if (platform === 'linkedin') return <Linkedin size={size} fill="currentColor" />;
  if (platform === 'github') return <Github size={size} fill="currentColor" />;
  if (platform === 'tiktok') return <svg className="platform-custom-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3v11.2a4.3 4.3 0 1 1-3.4-4.2v3a1.5 1.5 0 1 0 .4 1V3h3c.5 2 1.8 3.3 4 3.8v3a8 8 0 0 1-4-1.7V3Z" /></svg>;
  if (platform === 'x') return <svg className="platform-custom-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h4.6l4.2 5.6L17.7 4H20l-6.2 7.2L20 20h-4.6l-4.6-6.1L5.5 20H3.2l6.6-7.7L4 4Zm3.4 2 9 12h1.7l-9-12H7.4Z" /></svg>;
  return <Globe2 size={size} />;
}

function formatMediaTime(value) {
  const total = Math.max(0, Math.floor(Number(value) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${String(hours).padStart(2, '0')} : ${String(minutes).padStart(2, '0')} : ${String(seconds).padStart(2, '0')}`;
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

function ImageSlide({ item, index, preview, priority, zoom, pan }) {
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
        style={{ transform: `translate(${pan.x}%, ${pan.y}%) scale(${zoom})` }}
      />
      {status === 'loading' && <MediaLoading kind="photo" />}
      {status === 'error' && <AssetError message="This photo could not be loaded." onRetry={() => { setStatus('loading'); setRetryKey((value) => value + 1); }} />}
    </div>
  );
}

function VideoSlide({ item, active, inView, controlsVisible, analyticsContext, muted }) {
  const videoRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const [status, setStatus] = useState('loading');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    if (active && inView && !paused) video.play().catch(() => {});
    else video.pause();
  }, [active, inView, muted, paused]);

  const seekAndPlay = (value) => {
    const next = Math.min(Math.max(0, Number(value) || 0), duration || 0);
    const video = videoRef.current;
    if (video) {
      video.currentTime = next;
      video.play().catch(() => {});
    }
    setCurrentTime(next);
    setPaused(false);
  };

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
      {status === 'loading' && <MediaLoading kind={analyticsContext?.format === 'short-video' ? 'short-video' : 'video'} />}
      {status === 'error' && <AssetError message="This video could not be loaded." onRetry={() => { setStatus('loading'); setRetryKey((value) => value + 1); }} />}
      {controlsVisible && status !== 'error' && <button type="button" className="media-play" onClick={(event) => { event.stopPropagation(); setPaused((value) => !value); }} aria-label={paused ? 'Play video' : 'Stop video'}>
        {paused ? <Play size={22} fill="currentColor" /> : <Square size={20} fill="currentColor" />}
      </button>}
      {controlsVisible && status !== 'error' && (
        <div className="video-time-controls" onClick={(event) => event.stopPropagation()}>
          <div className="video-time-readout"><strong>{formatMediaTime(currentTime)}</strong><span>of</span><strong>{formatMediaTime(duration)}</strong></div>
          <div className={`camera-film-timeline ${paused ? 'is-paused' : ''}`} style={{ '--film-progress': `${duration ? (currentTime / duration) * 100 : 0}%` }}>
            <span className="film-camera" aria-hidden="true"><CameraFilmIcon /></span>
            <span className="film-strip" aria-hidden="true">
              <i className="film-watched" />
              {Array.from({ length: 9 }, (_, frame) => <b key={frame}><em /></b>)}
            </span>
            <input
              className="video-seek"
              type="range"
              min="0"
              max={Math.max(duration, 0.1)}
              step="0.1"
              value={Math.min(currentTime, Math.max(duration, 0.1))}
              aria-label="Drag the camera film to choose the video time"
              onPointerDown={(event) => { event.currentTarget.setPointerCapture?.(event.pointerId); seekAndPlay(event.currentTarget.value); }}
              onInput={(event) => seekAndPlay(event.currentTarget.value)}
              onChange={(event) => seekAndPlay(event.currentTarget.value)}
            />
          </div>
        </div>
      )}
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
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [boundaryNotice, setBoundaryNotice] = useState('');
  const [orientationMode, setOrientationMode] = useState('auto');
  const [deviceOrientation, setDeviceOrientation] = useState(() => window.matchMedia?.('(orientation: portrait)').matches ? 'portrait' : 'landscape');
  const [muted, setMuted] = useState(true);
  const [containerRef, inView] = useInView();
  const reducedMotion = useReducedMotion();
  const touchStart = useRef(null);
  const pinchStart = useRef(null);
  const current = media[index];
  const shownOrientation = orientationMode === 'auto' ? deviceOrientation : orientationMode;

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

  useEffect(() => {
    const update = () => setDeviceOrientation(window.matchMedia?.('(orientation: portrait)').matches ? 'portrait' : 'landscape');
    window.addEventListener('resize', update);
    screen.orientation?.addEventListener?.('change', update);
    return () => {
      window.removeEventListener('resize', update);
      screen.orientation?.removeEventListener?.('change', update);
    };
  }, []);

  const move = (direction) => {
    if (!media.length) return;
    setIndex((value) => (value + direction + media.length) % media.length);
  };

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setBoundaryNotice('');
  }, [index]);

  const zoomLimit = (value = zoom) => Math.max(0, ((value - 1) / value) * 48);
  const changeZoom = (nextZoom) => {
    const next = Math.min(3, Math.max(1, Number(nextZoom)));
    const limit = zoomLimit(next);
    setZoom(next);
    if (next > 1) setCarouselPaused(true);
    setPan((value) => ({
      x: Math.min(limit, Math.max(-limit, value.x)),
      y: Math.min(limit, Math.max(-limit, value.y)),
    }));
  };
  const movePhoto = (axis, amount) => {
    const limit = zoomLimit();
    if (!limit) return;
    setCarouselPaused(true);
    setPan((value) => {
      const requested = value[axis] + amount;
      const moved = Math.min(limit, Math.max(-limit, requested));
      if (moved === value[axis] || moved !== requested) setBoundaryNotice('Fully moved in this direction.');
      else setBoundaryNotice('');
      return { ...value, [axis]: moved };
    });
  };

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
      className={`media-carousel ${short ? 'short-carousel' : ''} ${controlsVisible ? 'controls-visible' : ''} orientation-${shownOrientation}`}
      onClick={() => {
        if (preview) return;
        if (current.type !== 'video' && media.length > 1) setCarouselPaused(true);
        setControlsVisible((value) => {
          if (value) setToolboxOpen(false);
          return !value;
        });
      }}
      onTouchStart={(event) => {
        if (current.type !== 'video' && event.touches.length === 2) {
          const [first, second] = event.touches;
          pinchStart.current = { distance: Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY), zoom };
          touchStart.current = null;
          setCarouselPaused(true);
          return;
        }
        touchStart.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchMove={(event) => {
        if (!pinchStart.current || event.touches.length !== 2) return;
        event.preventDefault();
        const [first, second] = event.touches;
        const distance = Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
        changeZoom(pinchStart.current.zoom * (distance / Math.max(1, pinchStart.current.distance)));
      }}
      onTouchEnd={(event) => {
        if (pinchStart.current) {
          if (event.touches.length < 2) pinchStart.current = null;
          return;
        }
        if (touchStart.current == null) return;
        const distance = event.changedTouches[0].clientX - touchStart.current;
        if (Math.abs(distance) > 45) move(distance > 0 ? -1 : 1);
        touchStart.current = null;
      }}
    >
      <div className="media-stage">
        {current.type === 'video' ? (
          <VideoSlide item={current} active inView={inView || preview} controlsVisible={controlsVisible} muted={muted} analyticsContext={preview ? null : { postId, postAuthorId, targetType: 'post', targetId: postId, format: postFormat }} />
        ) : (
          <ImageSlide item={current} index={index} preview={preview} priority={priority} zoom={zoom} pan={pan} />
        )}
        {boundaryNotice && <div className="media-boundary-notice" role="status"><span>{boundaryNotice}</span><button type="button" onClick={(event) => { event.stopPropagation(); setBoundaryNotice(''); }} aria-label="Close movement message"><X size={16} /></button></div>}
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
        {!preview && controlsVisible && <button type="button" className={`media-toolbox-trigger ${toolboxOpen ? 'active' : ''}`} onClick={(event) => { event.stopPropagation(); if (current.type !== 'video') setCarouselPaused(true); setToolboxOpen((value) => !value); }} aria-expanded={toolboxOpen} aria-label="More options"><FilesFolderIcon open={toolboxOpen} /><span>More options</span></button>}
        {!preview && controlsVisible && toolboxOpen && (
          <div className="media-toolbox" onClick={(event) => event.stopPropagation()}>
            <header><strong>More options</strong><button type="button" onClick={() => setToolboxOpen(false)} aria-label="Close more options"><X size={18} /></button></header>
            <button type="button" className={`media-fullscreen ${fullscreen ? 'active' : ''}`} onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit full screen' : 'View media full screen'}><PictureScreenIcon expanded={fullscreen} /><span>{fullscreen ? 'Exit full screen' : 'Full screen'}</span></button>
            <div className="orientation-control" aria-label="Choose post posture">
              <button type="button" className={orientationMode === 'portrait' ? 'active' : ''} onClick={() => setOrientationMode('portrait')}><span className="posture-screen stand" /><b>Stand posture</b></button>
              <button type="button" className={orientationMode === 'landscape' ? 'active' : ''} onClick={() => setOrientationMode('landscape')}><span className="posture-screen sleep" /><b>Sleep posture</b></button>
              <button type="button" className={orientationMode === 'auto' ? 'active' : ''} onClick={() => setOrientationMode('auto')}><Smartphone size={18} /><b>Follow device</b></button>
            </div>
            {current.type === 'video' ? (
              <button type="button" className={`media-sound ${muted ? 'muted' : 'sound-on'}`} onClick={() => setMuted((value) => !value)} aria-label={muted ? 'Turn sound on' : 'Mute video'} title={muted ? 'Turn sound on' : 'Mute video'}><DrumSoundIcon soundOn={!muted} /><span>{muted ? 'Sound off' : 'Sound on'}</span></button>
            ) : (
              <div className="media-zoom-control">
                <TelescopeZoomIcon />
                <span>Photo zoom <b>{Math.round(zoom * 100)}%</b></span>
                <input type="range" min="1" max="3" step="0.05" value={zoom} onChange={(event) => changeZoom(event.target.value)} aria-label="Zoom photo in or out" />
                <div className={`photo-pan-pad ${zoom === 1 ? 'disabled' : ''}`} aria-label="Move around the zoomed photo">
                  <button type="button" className="pan-up" onClick={() => movePhoto('y', 6)} disabled={zoom === 1} aria-label="Move photo down to see higher"><ArrowUp size={18} /></button>
                  <button type="button" className="pan-left" onClick={() => movePhoto('x', 6)} disabled={zoom === 1} aria-label="Move photo right to see the left side"><ArrowLeft size={18} /></button>
                  <button type="button" className="pan-reset" onClick={() => setPan({ x: 0, y: 0 })} disabled={zoom === 1} aria-label="Center the zoomed photo"><span /></button>
                  <button type="button" className="pan-right" onClick={() => movePhoto('x', -6)} disabled={zoom === 1} aria-label="Move photo left to see the right side"><ArrowRight size={18} /></button>
                  <button type="button" className="pan-down" onClick={() => movePhoto('y', -6)} disabled={zoom === 1} aria-label="Move photo up to see lower"><ArrowDown size={18} /></button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {media.length > 1 && (
        <div className="page-meter" aria-label={`Item ${index + 1} of ${media.length}`}>
          <span className="page-count">{index + 1}<i />{media.length}</span>
          <div className="page-track">
            <span
              key={`${index}-${inView}`}
              className={inView && !reducedMotion && !preview ? `running ${carouselPaused ? 'paused' : ''}` : ''}
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

export function FeedCard({ post, onPerson, onDelete, viewer, onRequireAuth, priority = false }) {
  const isText = post.type === 'text';
  const own = Boolean(viewer && (String(post.author?.id || '') === String(viewer.id || '') || post.author?.username === viewer.username));
  const externalLinks = describeExternalLinks(post.links?.length ? post.links : post.link ? [post.link] : []);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [externalPlacesOpen, setExternalPlacesOpen] = useState(false);
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
        {externalLinks.length > 0 && <button type="button" className="external-places-trigger" onClick={() => setExternalPlacesOpen(true)}>
          <span className="external-platform-notices" aria-hidden="true">{externalLinks.slice(0, 4).map((link, index) => <i className={`platform-badge platform-${link.id}`} key={`${link.url}-${index}`}><PlatformIcon platform={link.id} size={13} /></i>)}</span>
          <span>Visit their other places</span>
        </button>}
      </div>}
      <div className={`post-action-row ${isText ? 'text-actions' : ''}`}>
        <ReactionBar post={post} viewer={viewer} onRequireAuth={onRequireAuth} />
        <button type="button" className={`speak-button ${commentsOpen ? 'active' : ''}`} onClick={() => setCommentsOpen((value) => !value)}><span className="thought-count"><MessageCircle size={18} /><b>{commentCount.toLocaleString('en-US').replaceAll(',', '')}</b></span><span>Speak on it</span></button>
        {!isText && <button type="button" className={`details-button ${detailsOpen ? 'active' : ''}`} onClick={() => setDetailsOpen((value) => !value)}><Info size={18} /> <span>Full details of it</span></button>}
      </div>
      {commentsOpen && <CommentPanel post={post} viewer={viewer} onRequireAuth={onRequireAuth} onClose={() => setCommentsOpen(false)} onCountChange={setCommentCount} />}
      {externalPlacesOpen && createPortal(
        <div className="external-places-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setExternalPlacesOpen(false); }}>
          <section className="external-places-card" role="dialog" aria-modal="true" aria-labelledby={`external-places-${post.id}`}>
            <header><div><strong id={`external-places-${post.id}`}>All platform links</strong><small>Choose the place you want to open.</small></div><button type="button" onClick={() => setExternalPlacesOpen(false)} aria-label="Close all platform links"><X size={20} /></button></header>
            <div className="external-place-list">{externalLinks.map((link, index) => <a className={`external-place platform-${link.id}`} href={link.url} target="_blank" rel="noreferrer noopener" key={`${link.url}-${index}`}><span><PlatformIcon platform={link.id} size={22} /></span><strong>{link.label}</strong><small>Open</small></a>)}</div>
          </section>
        </div>, document.body
      )}
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
