import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useDebouncedValue } from '../lib/hooks';
import { Avatar, FeedCard, FeedSkeleton, LoadMore } from './Feed';

const filters = ['all', 'people', 'text', 'photo', 'video', 'short-video'];
const contentTypeLabels = { all: 'All', people: 'People', text: 'Text', photo: 'Photo', video: 'Video', 'short-video': 'Short video' };

function normalize(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function scorePerson(person, query) {
  const q = normalize(query);
  const username = normalize(person.username).replace(/^@/, '');
  const name = normalize(person.name);
  let score = 0;
  if (q.includes(`by @${username}`)) score += 1000;
  else if (q.includes(`@${username}`)) score += 800;
  if (q.includes(`by ${name}`)) score += 500;
  else if (q.includes(name)) score += 260;
  q.split(/[^a-z0-9@]+/).filter(Boolean).forEach((token) => {
    if (`@${username}`.startsWith(token) || username.startsWith(token.replace('@', ''))) score += 90;
    if (name.split(' ').some((part) => part.startsWith(token))) score += 55;
  });
  return score;
}

function scorePost(post, query) {
  const q = normalize(query);
  const title = normalize(post.name || post.text?.split('\n')[0]);
  const username = normalize(post.author?.username).replace(/^@/, '');
  const authorName = normalize(post.author?.name);
  const haystack = normalize([
    post.name,
    post.text,
    post.detail,
    ...(post.tags || []),
    ...(post.links || []),
    post.link,
    ...(post.media || []).map((item) => item.name || item.alt),
  ].filter(Boolean).join(' '));
  const contentQuery = q.replace(/\bby\s+@?[a-z]{1,40}(?=\s|$)/g, '').replace(/@[a-z]{1,40}/g, '').trim();
  const contentTokens = contentQuery.split(/[^a-z0-9]+/).filter(Boolean);
  if (contentTokens.length && !contentTokens.every((token) => haystack.includes(token))) return 0;
  let score = 0;
  if (q.includes(`by @${username}`)) score += 1200;
  else if (q.includes(`@${username}`)) score += 900;
  if (q.includes(`by ${authorName}`)) score += 600;
  else if (q.includes(authorName)) score += 240;
  if (title && q.includes(title)) score += 420;
  if (title && title.includes(q)) score += 300;
  q.split(/[^a-z0-9@]+/).filter((token) => token !== 'by').forEach((token) => {
    if (haystack.includes(token)) score += 55;
    if (title.includes(token)) score += 50;
  });
  score += Math.log10(Number(post.hugs || 0) + 1) * 2;
  return score;
}

function localResults(query, people, posts) {
  const rankedPeople = people.map((person) => ({ ...person, _score: scorePerson(person, query) })).filter((person) => person._score > 0).sort((a, b) => b._score - a._score);
  const rankedPosts = posts.map((post) => ({ ...post, _score: scorePost(post, query) })).filter((post) => post._score > 0).sort((a, b) => b._score - a._score);
  return { people: rankedPeople, posts: rankedPosts };
}

export default function SearchPanel({ query, people, posts, onPerson, onDeletePost, viewer, onRequireAuth }) {
  const debounced = useDebouncedValue(query, 260);
  const [filter, setFilter] = useState('all');
  const [remote, setRemote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!debounced.trim()) return;
    let active = true;
    setLoading(true);
    api.search({ q: debounced, type: filter === 'people' ? 'all' : filter, limit: 30 })
      .then((payload) => {
        if (!active) return;
        setRemote({
          people: payload?.people || payload?.users || [],
          posts: payload?.posts || payload?.items || [],
          nextCursor: payload?.nextCursor || null,
        });
      })
      .catch(() => {
        if (active) setRemote(null);
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [debounced, filter]);

  const results = useMemo(() => {
    const value = remote || localResults(debounced, people, posts);
    return {
      people: ['all', 'people'].includes(filter) ? (value.people || []) : [],
      posts: filter === 'people' ? [] : (value.posts || []).filter((post) => filter === 'all' || post.type === filter),
    };
  }, [debounced, filter, people, posts, remote]);

  const loadMoreResults = async () => {
    if (!remote?.nextCursor || loadingMore || filter === 'people') return;
    setLoadingMore(true);
    try {
      const payload = await api.search({ q: debounced, type: filter, cursor: remote.nextCursor, limit: 30 });
      setRemote((current) => current ? {
        ...current,
        posts: [...current.posts, ...(payload?.posts || []).filter((item) => !current.posts.some((post) => post.id === item.id))],
        nextCursor: payload?.nextCursor || null,
      } : current);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <main className="search-page" id="main-content">
      <h1 className="sr-only">Search results</h1>
      <div className="search-filters" role="tablist" aria-label="Filter search results">
        {filters.map((item) => (
          <button key={item} type="button" role="tab" aria-selected={filter === item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>
            {contentTypeLabels[item]}
          </button>
        ))}
      </div>

      {loading && !remote ? <FeedSkeleton /> : (
        <>
          {results.people.length === 0 && results.posts.length === 0 && <p className="search-empty-line" role="status">“{query.trim()}” is not uploaded here.</p>}
          {results.people.length > 0 && (
            <section className="people-results" aria-label="People">
              <div className="people-grid">
                {results.people.slice(0, filter === 'people' ? 20 : 6).map((person) => (
                  <article className="person-result" key={person.id || person.username}>
                    <button type="button" className="person-result-main" onClick={() => onPerson(person)}>
                      <Avatar person={person} size="large" />
                      <span><strong>{person.name}</strong><small>@{person.username}</small></span>
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}

          {results.posts.length > 0 && <section className="post-results" aria-label="Posts">
            <div className="feed-column search-feed">
              {results.posts.map((post, index) => <FeedCard post={post} key={post.id} onPerson={onPerson} onDelete={onDeletePost} viewer={viewer} onRequireAuth={onRequireAuth} priority={index === 0} />)}
              {remote?.nextCursor && <LoadMore loading={loadingMore} done={false} onClick={loadMoreResults} />}
            </div>
          </section>}
        </>
      )}
    </main>
  );
}
