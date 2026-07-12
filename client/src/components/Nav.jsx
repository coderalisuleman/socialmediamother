import { Search, X } from 'lucide-react';

function FeedSwitch({ feedMode, onFeedMode }) {
  return (
    <div className="feed-switch" aria-label="Choose whose posts to see">
      <button type="button" className={feedMode === 'everyone' ? 'active' : ''} onClick={() => onFeedMode('everyone')} aria-pressed={feedMode === 'everyone'}>
        Everyones Every Post
      </button>
      <button type="button" className={feedMode === 'following' ? 'active' : ''} onClick={() => onFeedMode('following')} aria-pressed={feedMode === 'following'}>
        The People To with I want To be There Posts
      </button>
    </div>
  );
}

export default function Nav({ query, onQuery, feedMode, onFeedMode, onHome, onCreate, onLogin, onLogout }) {
  return (
    <header className="top-shell">
      <nav className="top-nav" aria-label="Main navigation">
        <a href="/" className="brand-link" aria-label="Social Media Mother home" onClick={(event) => { event.preventDefault(); onHome?.(); }}>
          <img src="/icon-192.png" alt="" width="44" height="44" />
          <span className="brand-word">Social Media Mother</span>
        </a>

        <div className="nav-control-grid">
          <FeedSwitch feedMode={feedMode} onFeedMode={onFeedMode} />
          <label className="smart-search">
            <Search size={19} aria-hidden="true" />
            <span className="sr-only">Search people and posts</span>
            <input type="search" value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search..." autoComplete="off" />
            {query && <button type="button" onClick={() => onQuery('')} aria-label="Clear search"><X size={17} /></button>}
          </label>
          <div className="account-actions" aria-label="Account actions">
            <button type="button" className="nav-action" onClick={onCreate}>Account Create</button>
            <button type="button" className="nav-action login-action" onClick={onLogin}>Account-in</button>
            <button type="button" className="nav-action account-out-action" onClick={onLogout}>Account-out</button>
          </div>
        </div>
      </nav>
    </header>
  );
}
