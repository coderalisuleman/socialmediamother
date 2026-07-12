import { useCallback, useEffect, useState } from 'react';
import { Compass, Sparkles, X } from 'lucide-react';
import Nav from './components/Nav';
import BottomDock from './components/BottomDock';
import UploadModal from './components/UploadModal';
import { CreateAccountModal, LoginModal } from './components/AuthModals';
import ProfilePage from './components/ProfileModal';
import SearchPanel from './components/SearchPanel';
import SiteFooter from './components/SiteFooter';
import { EmptyFeed, FeedCard, FeedSkeleton, LoadMore } from './components/Feed';
import { api, normalizePostShape, normalizePostsResponse, normalizeUserShape, setToken } from './lib/api';
import {
  currentUrlPath,
  fallbackPathForRoute,
  feedPath,
  parseAppLocation,
  postPath,
  profilePath,
  searchPath,
  settingPath,
  uploadPath,
} from './lib/routes';

function readLocalUser() {
  try {
    if (!localStorage.getItem('mother.session')) return null;
    return JSON.parse(localStorage.getItem('mother.local.user')) || null;
  } catch {
    return null;
  }
}

function saveLocalUser(user) {
  if (user) localStorage.setItem('mother.local.user', JSON.stringify(user));
  else localStorage.removeItem('mother.local.user');
}

function normalizeUser(payload, fallback) {
  return normalizeUserShape(payload?.user || payload?.data?.user || (payload?.username ? payload : null) || fallback);
}

export default function App() {
  const [route, setRoute] = useState(parseAppLocation);
  const [query, setQuery] = useState(() => parseAppLocation().query || '');
  const [feedMode, setFeedMode] = useState(() => parseAppLocation().feedMode || 'everyone');
  const [posts, setPosts] = useState([]);
  const [people, setPeople] = useState([]);
  const [user, setUser] = useState(readLocalUser);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [done, setDone] = useState(false);
  const [followingFallback, setFollowingFallback] = useState(false);
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState(null);
  const [profileEditing, setProfileEditing] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [focusedPost, setFocusedPost] = useState(null);
  const [accountCreated, setAccountCreated] = useState(false);

  const navigate = useCallback((path, { replace = false, overlay = false } = {}) => {
    const previousPath = currentUrlPath();
    const previousState = window.history.state || {};
    const currentRoute = parseAppLocation();
    const currentRouteIsOverlay = ['create-account', 'account-in', 'upload'].includes(currentRoute.kind);
    const directOverlay = Boolean(previousState.motherDirectOverlay || (!previousState.motherOverlay && currentRouteIsOverlay));
    const state = overlay ? {
      motherOverlay: true,
      motherDirectOverlay: directOverlay,
      motherReturnTo: previousState.motherOverlay
        ? previousState.motherReturnTo
        : directOverlay ? fallbackPathForRoute(currentRoute) : previousPath,
      motherOverlayDepth: directOverlay
        ? 0
        : previousState.motherOverlay
        ? (replace ? previousState.motherOverlayDepth : Number(previousState.motherOverlayDepth || 1) + 1)
        : 1,
    } : {};
    window.history[replace ? 'replaceState' : 'pushState'](state, '', path);
    setRoute(parseAppLocation());
    if (!overlay) window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const closeModal = useCallback(() => {
    if (window.history.state?.motherDirectOverlay) {
      navigate(window.history.state.motherReturnTo || fallbackPathForRoute(parseAppLocation()), { replace: true });
      return;
    }
    const depth = Number(window.history.state?.motherOverlayDepth || 0);
    if (window.history.state?.motherOverlay && depth > 0) {
      window.history.go(-depth);
      return;
    }
    navigate(fallbackPathForRoute(parseAppLocation()), { replace: true });
  }, [navigate]);

  const openOverlay = useCallback((path, options = {}) => {
    navigate(path, { ...options, overlay: true });
  }, [navigate]);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setNotice('');
    setFollowingFallback(false);
    try {
      let payload = normalizePostsResponse(await api.listPosts({ feed: feedMode, limit: 5 }));
      if (feedMode === 'following' && payload.fallbackReason) setFollowingFallback(true);
      if (feedMode === 'following' && payload.items.length === 0 && !payload.fallbackReason) {
        payload = normalizePostsResponse(await api.listPosts({ feed: 'everyone', limit: 5 }));
        setFollowingFallback(true);
      }
      setPosts(payload.items);
      setCursor(payload.nextCursor);
      setDone(!payload.nextCursor);
    } catch (error) {
      setPosts([]);
      setCursor(null);
      setDone(true);
      setFollowingFallback(feedMode === 'following' && !user);
      setNotice(error.message || 'The feed could not be loaded. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  }, [feedMode, user]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    if (!localStorage.getItem('mother.session')) return;
    api.me().then((payload) => {
      const next = normalizeUser(payload, null);
      if (next) {
        setUser(next);
        saveLocalUser(next);
      }
    }).catch((error) => {
      if (error?.status === 401) {
        setToken(null);
        setUser(null);
        saveLocalUser(null);
      }
    });
  }, []);

  useEffect(() => {
    if (!accountCreated) return undefined;
    const timer = window.setTimeout(() => setAccountCreated(false), 2600);
    return () => window.clearTimeout(timer);
  }, [accountCreated]);

  useEffect(() => {
    const onPopState = () => setRoute(parseAppLocation());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    let active = true;

    if (route.legacy && route.canonicalPath) {
      navigate(route.canonicalPath, { replace: true });
      return undefined;
    }

    setQuery(route.kind === 'search' ? route.query || '' : '');
    setFocusedPost(null);

    if (route.kind === 'feed') setFeedMode(route.feedMode || 'everyone');
    if (route.kind === 'home' || route.kind === 'search' || route.kind === 'post' || route.kind === 'not-found') {
      setModal(null);
      setProfileEditing(false);
    }

    if (route.kind === 'create-account') {
      if (user) {
        setModal(null);
        setNotice('You already have an active account. Account-out before creating another one.');
        navigate('/', { replace: true });
        return () => { active = false; };
      }
      setModal('create');
      document.title = 'Make your account | Mother';
    } else if (route.kind === 'account-in') {
      if (user) {
        setModal(null);
        setNotice('You are already account-in.');
        navigate('/', { replace: true });
        return () => { active = false; };
      }
      setModal('login');
      document.title = 'Account in | Mother';
    } else if (route.kind === 'upload') {
      if (!user) {
        setModal('login');
        setProfileEditing(false);
        document.title = 'Account in to upload | Mother';
        return () => { active = false; };
      }
      if (route.username !== user.username) {
        setNotice('Private upload links only open for their own account.');
        navigate(profilePath(route.username), { replace: true });
        return () => { active = false; };
      }
      setModal('upload');
      setProfileEditing(false);
      document.title = `${route.uploadMode ? `Upload ${route.uploadMode.replace('-', ' ')}` : 'Upload'} | Mother`;
    } else if (route.kind === 'profile' || route.kind === 'setting') {
      if (route.kind === 'setting' && !user) {
        setModal('login');
        setProfileEditing(false);
        document.title = 'Account in for settings | Mother';
        return () => { active = false; };
      }
      if (route.kind === 'setting' && route.username !== user.username) {
        setNotice('Settings are private to their own account.');
        navigate(profilePath(route.username), { replace: true });
        return () => { active = false; };
      }
      const editing = route.kind === 'setting';
      setModal(null);
      const localPerson = [user, ...people, ...posts.map((post) => post.author)]
        .find((person) => person?.username === route.username);
      if (localPerson) setSelectedPerson(localPerson);
      else setSelectedPerson((current) => current?.username === route.username ? current : null);
      setProfileEditing(editing);
      document.title = `${editing ? 'Settings' : `@${route.username}`} | Mother`;
      api.getUser(route.username).then((person) => {
        if (active && person) setSelectedPerson(person);
      }).catch(() => {
        if (active && !localPerson) setNotice('That shared profile could not be found.');
      });
    } else if (route.kind === 'post') {
      const localPost = posts.find((post) => String(post.id) === String(route.postId));
      if (localPost) setFocusedPost(localPost);
      document.title = 'A shared post | Mother';
      api.getPost(route.postId).then((post) => {
        if (active && post) setFocusedPost(post);
      }).catch(() => {
        if (active && !localPost) setNotice('That shared post could not be found.');
      });
    } else if (route.kind === 'search') {
      document.title = `${route.query || 'Search'} | Mother`;
    } else if (route.kind === 'feed') {
      document.title = `${route.feedMode === 'following' ? 'My people' : "Everyone's posts"} | Mother`;
    } else {
      document.title = 'Mother | A free place for every kind of post';
      if (route.kind === 'not-found') setNotice('That address does not belong to a page yet. Mother brought you home.');
    }

    return () => { active = false; };
  }, [navigate, people, posts, route, user]);

  useEffect(() => {
    const shortcut = (event) => {
      if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        event.preventDefault();
        document.querySelector('.smart-search input')?.focus();
      }
    };
    document.addEventListener('keydown', shortcut);
    return () => document.removeEventListener('keydown', shortcut);
  }, []);

  const loadMore = async () => {
    if (loadingMore || done) return;
    setLoadingMore(true);
    try {
      const payload = normalizePostsResponse(await api.listPosts({ feed: feedMode, cursor, limit: 5 }));
      setPosts((current) => [...current, ...payload.items.filter((item) => !current.some((post) => post.id === item.id))]);
      setCursor(payload.nextCursor);
      setDone(!payload.nextCursor);
    } catch {
      setNotice('That next wave did not arrive. Check your connection and try once more.');
    } finally {
      setLoadingMore(false);
    }
  };

  const createPost = async (values, onUploadProgress) => {
    const form = new FormData();
    form.append('type', values.type);
    form.append('nameIt', values.type === 'text' ? '' : values.name || '');
    form.append('detail', values.detail || '');
    form.append('text', values.text || '');
    form.append('links', JSON.stringify(values.links || []));
    values.files.forEach((file) => form.append('files', file));

    try {
      const payload = await api.createPost(form, { onUploadProgress });
      const post = normalizePostShape(payload?.post || payload?.data?.post || payload?.data || payload);
      setPosts((current) => [post, ...current]);
      return;
    } catch (error) {
      throw error;
    }
  };

  const register = async (values) => {
    const payload = await api.register({
      ...values,
      gender: values.gender === 'neutral' ? 'prefer-not-to-say' : values.gender,
    });
    if (payload?.token) setToken(payload.token);
    const nextUser = normalizeUser(payload, null);
    if (!nextUser) throw new Error('The account response was incomplete.');
    setUser(nextUser);
    saveLocalUser(nextUser);
    setAccountCreated(true);
    navigate('/');
  };

  const login = async (values) => {
    const payload = await api.login(values);
    if (payload?.token) setToken(payload.token);
    const nextUser = normalizeUser(payload, null);
    if (!nextUser) throw new Error('The account response was incomplete.');
    setUser(nextUser);
    saveLocalUser(nextUser);
  };

  const logout = async () => {
    await api.logout().catch(() => setToken(null));
    setUser(null);
    saveLocalUser(null);
    setFeedMode('everyone');
    setNotice('You are account-out. The public feed is still yours to explore.');
    navigate(feedPath('everyone'));
  };

  const patchPerson = (personId, updater) => {
    setPeople((current) => current.map((person) => person.id === personId ? updater(person) : person));
    setPosts((current) => current.map((post) => post.author?.id === personId ? { ...post, author: updater(post.author) } : post));
    setSelectedPerson((current) => current?.id === personId ? updater(current) : current);
  };

  const follow = async (person) => {
    if (!user) {
      openOverlay('/createaccount');
      return null;
    }
    const nextFollowing = !person.isFollowing;
    const updater = (current) => ({ ...current, isFollowing: nextFollowing, followers: Math.max(0, Number(current.followers || 0) + (nextFollowing ? 1 : -1)) });
    patchPerson(person.id, updater);
    try {
      const payload = await api.setFollowing(person.username, nextFollowing);
      const confirmed = normalizeUserShape(payload?.person);
      if (confirmed) patchPerson(person.id, () => confirmed);
      const confirmedMe = normalizeUserShape(payload?.me);
      if (confirmedMe) {
        setUser(confirmedMe);
        saveLocalUser(confirmedMe);
        setPosts((current) => current.map((post) => post.author?.username === confirmedMe.username
          ? { ...post, author: confirmedMe }
          : post));
      }
      return confirmed || updater(person);
    } catch (error) {
      if (error?.status) {
        patchPerson(person.id, (current) => ({
          ...current,
          isFollowing: Boolean(person.isFollowing),
          followers: Number(person.followers || 0),
        }));
        if (error.status === 401) {
          setToken(null);
          setUser(null);
          saveLocalUser(null);
          openOverlay('/accountin');
        }
        setNotice(error.message || 'That relationship could not be changed.');
      }
      return error?.status ? null : updater(person);
    }
  };

  const openPerson = (person) => {
    if (!person?.username) return;
    setSelectedPerson(person);
    navigate(profilePath(person.username));
  };

  const openMe = (edit = false) => {
    if (!user) {
      openOverlay('/createaccount');
      return;
    }
    setSelectedPerson(user);
    navigate(edit ? settingPath(user.username) : profilePath(user.username));
  };

  const updateAvatar = async (file) => {
    const form = new FormData();
    form.append('image', file);
    let next;
    try {
      const payload = await api.updateAvatar(form);
      next = normalizeUser(payload, null);
    } catch (error) {
      if (error?.status) throw error;
      next = { ...user, avatar: URL.createObjectURL(file) };
    }
    if (!next) next = { ...user, avatar: URL.createObjectURL(file) };
    setUser(next);
    setSelectedPerson(next);
    setPosts((current) => current.map((post) => post.author?.username === next.username
      ? { ...post, author: next }
      : post));
    saveLocalUser(next);
  };

  const deleteAvatar = async () => {
    try {
      await api.deleteAvatar();
    } catch (error) {
      if (error?.status) throw error;
    }
    const next = { ...user, avatar: null };
    setUser(next);
    setSelectedPerson(next);
    setPosts((current) => current.map((post) => post.author?.username === next.username
      ? { ...post, author: next }
      : post));
    saveLocalUser(next);
  };

  const requireAccount = () => {
    if (user) {
      setToken(null);
      setUser(null);
      saveLocalUser(null);
      openOverlay('/accountin');
    } else {
      openOverlay('/createaccount');
    }
  };

  const changeQuery = (value) => {
    setQuery(value);
    const clean = value.trim();
    const currentRoute = parseAppLocation();
    navigate(searchPath(clean), { replace: currentRoute.kind === 'search' });
  };

  const changeFeedMode = (mode) => {
    setFeedMode(mode);
    navigate(feedPath(mode, user?.username));
  };

  const openUpload = (mode = null) => {
    if (!user) {
      openOverlay('/createaccount');
      return;
    }
    openOverlay(uploadPath(user.username, mode));
  };

  const changeUploadMode = (mode) => {
    const username = route.kind === 'upload' ? route.username : user?.username;
    openOverlay(uploadPath(username, mode));
  };

  const changeProfileEditing = (editing) => {
    const username = selectedPerson?.username || user?.username;
    if (!username) return;
    navigate(editing ? settingPath(username) : profilePath(username));
  };

  const openPost = (post) => {
    if (!post?.id) return;
    navigate(postPath(post.id));
  };

  const searchActive = query.trim().length > 0;
  const visiblePosts = focusedPost ? [focusedPost] : posts;
  const profileActive = ['profile', 'setting'].includes(route.kind);

  return (
    <div className="app-shell" id="top">
      <a className="skip-link" href="#main-content">Skip to posts</a>
      <Nav
        query={query}
        onQuery={changeQuery}
        feedMode={feedMode}
        onFeedMode={changeFeedMode}
        user={user}
        onHome={() => navigate('/')}
        onCreate={() => openOverlay('/createaccount')}
        onLogin={() => openOverlay('/accountin')}
        onLogout={logout}
      />

      {notice && (
        <div className="notice-bar" role="status">
          <Sparkles size={16} /> <span>{notice}</span>
          <button type="button" className="notice-close" onClick={() => setNotice('')} aria-label="Dismiss message"><X size={16} /></button>
        </div>
      )}

      {accountCreated && (
        <div className="account-created-layer" role="status" aria-live="assertive">
          <div className="account-created-card"><span>✓</span><strong>Account is created</strong><small>You are now on the main page.</small></div>
        </div>
      )}

      {profileActive ? (
        <ProfilePage
          person={selectedPerson}
          isOwn={Boolean(user && (String(selectedPerson?.id || '') === String(user.id || '') || selectedPerson?.username === user.username))}
          startEditing={profileEditing}
          onAvatar={updateAvatar}
          onDeleteAvatar={deleteAvatar}
          onFollow={follow}
          onEditingChange={changeProfileEditing}
          onPerson={openPerson}
          onPost={openPost}
          viewer={user}
          onRequireAuth={requireAccount}
          fallbackPosts={posts}
        />
      ) : searchActive ? (
        <SearchPanel query={query} people={people} posts={posts} onFollow={follow} onPerson={openPerson} onPost={openPost} viewer={user} onRequireAuth={requireAccount} />
      ) : (
        <main className="home-layout" id="main-content">
          <section className="feed-section" aria-labelledby="feed-title">
            <header className="feed-heading">
              <div>
                <p className="eyebrow"><Compass size={14} /> {focusedPost ? 'A shared post' : feedMode === 'everyone' ? 'The wide world' : 'Your chosen circle'}</p>
                <h1 id="feed-title">{focusedPost ? focusedPost.name || `A ${focusedPost.type} post` : feedMode === 'everyone' ? 'Everyone’s every post' : 'The people I want to be with'}</h1>
                <p>{focusedPost ? `Shared by @${focusedPost.author?.username}.` : followingFallback ? 'Until you choose your people, everyone keeps this space warm.' : feedMode === 'everyone' ? 'A changing mix, shaped by what you enjoy and what people are loving.' : 'Every format, only from the people you chose.'}</p>
              </div>
            </header>

            {loading && !focusedPost ? <FeedSkeleton /> : visiblePosts.length ? (
              <div className="feed-column">
                {visiblePosts.map((post, index) => <FeedCard key={post.id} post={post} onFollow={follow} onPerson={openPerson} onPost={openPost} viewer={user} onRequireAuth={requireAccount} priority={index === 0} />)}
                {!focusedPost && <LoadMore loading={loadingMore} done={done} onClick={loadMore} />}
              </div>
            ) : <EmptyFeed following={feedMode === 'following'} onEveryone={() => changeFeedMode('everyone')} />}
          </section>

          <aside className="right-rail">
            <div className="how-feed-works">
              <p className="eyebrow"><Sparkles size={14} /> Made for your attention</p>
              <h2>A feed that learns gently.</h2>
              <p>What you pause on, hug and choose helps Mother bring closer the things you care about. Loved posts get a little lift, too.</p>
              <div className="feed-logic"><span>your interests</span><i>+</i><span>fresh voices</span><i>+</i><span>people’s hugs</span></div>
            </div>
            <div className="small-mission"><strong>No k. No m.</strong><p>People counts stay whole and exact, because every person is a person—not a shorthand.</p></div>
          </aside>
        </main>
      )}

      <SiteFooter />
      <BottomDock onUpload={() => openUpload()} onChange={() => openMe(true)} onMe={() => openMe(false)} />

      <UploadModal
        open={modal === 'upload'}
        onClose={closeModal}
        onCreate={createPost}
        initialMode={route.kind === 'upload' ? route.uploadMode : null}
        onModeChange={changeUploadMode}
      />
      <CreateAccountModal
        open={modal === 'create'}
        onClose={closeModal}
        onRegister={register}
        onSwitchLogin={() => openOverlay('/accountin', { replace: true })}
      />
      <LoginModal
        open={modal === 'login'}
        onClose={closeModal}
        onLogin={async (values) => {
          await login(values);
          return !['setting', 'upload'].includes(route.kind);
        }}
        onSwitchCreate={() => openOverlay('/createaccount', { replace: true })}
        currentUser={user}
      />
    </div>
  );
}
