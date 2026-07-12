import { Youtube } from 'lucide-react';

export function MissionNote({ compact = false }) {
  return (
    <div className={`mission-note ${compact ? 'compact' : ''}`}>
      <p><strong>Mission:</strong> this is a free place where anyone, from anywhere, can post their thoughts as text, photos, videos or short videos.</p>
      <p className="owner-line">
        <strong>Owner:</strong> Coder Ali Suleman
        <a href="https://youtube.com/@coderalisuleman" target="_blank" rel="noreferrer" aria-label="Coder Ali Suleman on YouTube">
          <Youtube size={17} fill="currentColor" />
        </a>
      </p>
      <p><strong>Copyrights:</strong> 2026 Vibe Coder Ali Suleman</p>
    </div>
  );
}

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <p className="footer-brand">mother<span>.</span></p>
        <p>Make a little room for every kind of human thought.</p>
      </div>
      <MissionNote compact />
    </footer>
  );
}

