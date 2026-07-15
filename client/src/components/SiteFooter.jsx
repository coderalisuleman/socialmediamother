import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

function YoutubeMark() {
  return (
    <svg viewBox="0 0 32 22" aria-hidden="true" className="youtube-mark">
      <rect width="32" height="22" rx="6" fill="#ff0033" />
      <path d="M13 6.3 22 11l-9 4.7V6.3Z" fill="#fff" />
    </svg>
  );
}

export function MissionNote({ compact = false }) {
  return (
    <div className={`mission-note ${compact ? 'compact' : ''}`}>
      <p><strong>Mission:</strong> this is a free place where anyone, from anywhere, can post their thoughts as text, photos, videos or short videos.</p>
      <p className="owner-line">
        <a className="owner-link" href="https://youtube.com/@coderalisuleman" target="_blank" rel="noreferrer" aria-label="Owner Coder Ali Suleman on YouTube">
          <span><strong>Owner:</strong> Coder Ali Suleman</span>
          <YoutubeMark />
        </a>
      </p>
      <p><strong>Copyrights:</strong> 2026 Vibe Coder Ali Suleman</p>
    </div>
  );
}

export default function SiteFooter() {
  const [hidden, setHidden] = useState(false);
  return (
    <div className={`site-footer-shell ${hidden ? 'footer-hidden' : ''}`}>
      <button type="button" className="site-footer-toggle" onClick={() => setHidden((value) => !value)} aria-expanded={!hidden} aria-label={hidden ? 'See footer' : 'Hide footer'} title={hidden ? 'See' : 'Hide'}>
        {hidden ? <ChevronUp size={25} /> : <ChevronDown size={25} />}
        <span className="control-tooltip">{hidden ? 'See' : 'Hide'}</span>
      </button>
      <footer className="site-footer">
      <a href="/" className="footer-identity" aria-label="Social Media Mother home">
        <span className="brand-hug-picture footer-hug-picture" style={{ '--brand-picture-size': '64px' }}>
          <img src="/icon-192.png" alt="Social Media Mother" width="64" height="64" loading="lazy" />
          <i className="love-particle love-one">♥</i><i className="love-particle love-two">♥</i><i className="love-particle love-three">♥</i>
        </span>
        <span>Social Media Mother</span>
      </a>
      <MissionNote compact />
      </footer>
    </div>
  );
}
