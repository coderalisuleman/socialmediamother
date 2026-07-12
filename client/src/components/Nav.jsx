import { LogIn, LogOut, Search, UserPlus, UsersRound, X } from 'lucide-react';
import { BrandMark } from './IconArt';

function FeedSwitch({ feedMode, onFeedMode }) {
  return (
    <div className="feed-switch" aria-label="Choose whose posts to see">
      <button
        type="button"
        className={feedMode === 'everyone' ? 'active' : ''}
        onClick={() => onFeedMode('everyone')}
        aria-pressed={feedMode === 'everyone'}
      >
        Everyone
      </button>
      <button
        type="button"
        className={feedMode === 'following' ? 'active' : ''}
        onClick={() => onFeedMode('following')}
        aria-pressed={feedMode === 'following'}
      >
        <UsersRound size={15} /> My people
      </button>
    </div>
  );
}

export default function Nav({ query, onQuery, feedMode, onFeedMode, user, onHome, onCreate, onLogin, onLogout }) {
  return (
    <header className="top-shell">
      <nav className="top-nav" aria-label="Main navigation">
        <div className="nav-left">
          <a href="/" className="brand-link" aria-label="Mother home" onClick={(event) => { event.preventDefault(); onHome?.(); }}>
            <BrandMark small />
            <span className="brand-word">mother<span>.</span></span>
          </a>
          <button type="button" className="nav-action desktop-only" onClick={onCreate}>
            <UserPlus size={16} /> Make your account
          </button>
          {user && (
            <button type="button" className="nav-action quiet desktop-only" onClick={onLogout}>
              <LogOut size={16} /> Account out
            </button>
          )}
        </div>

        <label className="smart-search">
          <Search size={19} aria-hidden="true" />
          <span className="sr-only">Search people and posts</span>
          <input
            type="search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Find a person, @username or a post…"
            autoComplete="off"
          />
          {query && (
            <button type="button" onClick={() => onQuery('')} aria-label="Clear search">
              <X size={17} />
            </button>
          )}
          <kbd>/</kbd>
        </label>

        <div className="nav-right">
          <FeedSwitch feedMode={feedMode} onFeedMode={onFeedMode} />
          <button type="button" className="nav-action login-action" onClick={onLogin}>
            <LogIn size={16} /> <span>{user ? `@${user.username}` : 'Account in'}</span>
          </button>
        </div>
      </nav>
      <div className="mobile-nav-row">
        <button type="button" className="nav-action" onClick={onCreate}>
          <UserPlus size={15} /> Join
        </button>
        <FeedSwitch feedMode={feedMode} onFeedMode={onFeedMode} />
        <button type="button" className="nav-action" onClick={user ? onLogout : onLogin}>
          {user ? <LogOut size={15} /> : <LogIn size={15} />} {user ? 'Out' : 'In'}
        </button>
      </div>
    </header>
  );
}
