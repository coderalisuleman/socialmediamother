import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpenText, Camera, Download, FileClock, ImagePlus, LoaderCircle, Play, Save, Trash2, UsersRound, X } from 'lucide-react';
import { api, normalizePostShape, normalizeUserShape } from '../lib/api';
import { deletePostDraft, listPostDrafts } from '../lib/drafts';
import { Avatar, FeedCard } from './Feed';

function exactCount(value) {
  return Number(value || 0).toLocaleString('en-US').replaceAll(',', '');
}

function RelationshipScene({ direction, active = false }) {
  const towardMe = direction === 'followers';
  return (
    <svg className={`relationship-scene ${towardMe ? 'toward-me' : 'toward-other'} ${active ? 'is-active' : ''}`} viewBox="0 0 210 92" aria-hidden="true">
      <path className="relationship-ground" d="M8 79c36-7 64 4 98 0s61-2 96 1" />
      {towardMe ? (
        <>
          <g className="scene-person scene-me standing" transform="translate(91 13)"><circle cx="14" cy="11" r="10" /><path d="M7 24c2-6 12-6 15 0l4 27H3Z" /><path d="m8 50-4 24m17-24 5 24M6 31-1 49m24-18 8 17" /></g>
          {[12, 47, 151, 181].map((x, index) => <g className={`scene-person scene-other runner runner-${index + 1}`} transform={`translate(${x} ${25 + (index % 2) * 8})`} key={x}><circle cx="8" cy="8" r="7" /><path d="M5 18c2-4 7-4 10 0l3 19H2Z" /><path d="m5 36-5 13m15-13 7 11M4 24l-8 6m19-6 7 5" /></g>)}
          <text className="scene-label label-me" x="105" y="88">me</text><text className="scene-label label-other" x="20" y="18">others</text>
        </>
      ) : (
        <>
          <g className="scene-person scene-other standing" transform="translate(160 13)"><circle cx="14" cy="11" r="10" /><path d="M7 24c2-6 12-6 15 0l4 27H3Z" /><path d="m8 50-4 24m17-24 5 24M6 31-1 49m24-18 8 17" /></g>
          <g className="scene-person scene-me runner runner-me" transform="translate(45 32)"><circle cx="10" cy="9" r="8" /><path d="M6 20c2-5 9-5 12 0l4 22H2Z" /><path d="m7 41-7 18m18-18 11 14M5 27l-12 7m25-7 11 5" /></g>
          <path className="scene-motion" d="M16 48h22m-27 9h27" />
          <text className="scene-label label-me" x="50" y="88">me</text><text className="scene-label label-other" x="164" y="88">other</text>
        </>
      )}
    </svg>
  );
}

const postFilters = [
  ['text', 'My Text Posts'],
  ['photo', 'My Photo Posts'],
  ['video', 'My Video Posts'],
  ['short-video', 'My Short Video Posts'],
  ['drafts', 'Saved till and complete later'],
  ['fans', 'Fans-behaviour'],
];

function CreatorFansBehaviour() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.creatorAnalytics().then((payload) => active && setReport(payload)).catch((loadError) => active && setError(loadError.message || 'Fans-behaviour could not be gathered.')).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  if (loading) return <div className="profile-post-loading"><LoaderCircle className="spin" /> Reading fans’ behaviour…</div>;
  if (error) return <p className="form-error" role="alert">{error}</p>;
  const totals = report?.totals || {};
  const metric = (label, value) => <article><strong>{Number(value || 0).toLocaleString('en-US').replaceAll(',', '')}</strong><span>{label}</span></article>;
  const exportPdf = () => {
    document.body.classList.add('printing-fans-behaviour');
    const cleanup = () => document.body.classList.remove('printing-fans-behaviour');
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 1500);
  };

  return (
    <div className="fans-report">
      <header><div className="reading-report-art"><BookOpenText size={32} /><span>♥</span></div><div><h2>Fans-behaviour</h2><p>Collective and individual behaviour from the last {report?.periodDays || 90} days.</p></div><button type="button" className="draft-save-button" onClick={exportPdf}><Download size={16} /> Export this report as PDF</button></header>
      <div className="fans-metrics">{metric('post formats', totals.posts)}{metric('viewers', totals.views)}{metric('hugs', totals.hugs)}{metric('throws', totals.throws)}{metric('sent thoughts', totals.thoughts)}{metric('watching seconds', totals.watchingSeconds)}{metric('people with you now', report?.followers)}</div>
      <section className="individual-performance"><h3>Every post by itself</h3>{report?.individual?.length ? report.individual.map((post) => <article key={post.id}><div><strong>{post.name}</strong><small>{post.type.replace('-', ' ')} · {new Date(post.createdAt).toLocaleDateString()}</small></div><span><b>{post.views}</b> viewers</span><span><b>{post.hugs}</b> hugs</span><span><b>{post.throws}</b> throws</span><span><b>{post.thoughts}</b> thoughts</span><span><b>{post.watchingSeconds}</b> watch seconds</span><span><b>{post.followersGained}</b> people gained</span></article>) : <p>No published posts have behaviour to read yet.</p>}</section>
    </div>
  );
}

export default function ProfilePage({ person, isOwn, startEditing = false, onAvatar, onDeleteAvatar, onProfileDetails, onFollow, onEditingChange, onDirtyChange, onPerson, onPost, onDeletePost, onResumeDraft, viewer, onRequireAuth, fallbackPosts = [] }) {
  const [editing, setEditing] = useState(startEditing);
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [relationshipView, setRelationshipView] = useState(null);
  const [relationshipPeople, setRelationshipPeople] = useState([]);
  const [relationshipLoading, setRelationshipLoading] = useState(false);
  const [postType, setPostType] = useState('text');
  const [profilePosts, setProfilePosts] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [profileDetails, setProfileDetails] = useState({ fullName: '', username: '', email: '', phone: '' });
  const [detailsSaving, setDetailsSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    setEditing(startEditing);
    setRelationshipView(null);
    setRelationshipPeople([]);
    setPostType('text');
    setProfileDetails({
      fullName: person?.fullName || person?.name || '',
      username: person?.username || '',
      email: person?.email || '',
      phone: person?.phone || '',
    });
  }, [person?.username, startEditing]);

  const profileDirty = Boolean(editing && (
    file
    || profileDetails.fullName !== (person?.fullName || person?.name || '')
    || profileDetails.username !== (person?.username || '')
    || profileDetails.email !== (person?.email || '')
    || profileDetails.phone !== (person?.phone || '')
  ));

  useEffect(() => {
    onDirtyChange?.(profileDirty);
  }, [onDirtyChange, profileDirty]);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const matchingFallback = useMemo(() => fallbackPosts
    .filter((post) => post.author?.username === person?.username && post.type === postType)
    .map(normalizePostShape), [fallbackPosts, person?.username, postType]);

  useEffect(() => {
    if (!person?.username) return undefined;
    let active = true;
    setPostsLoading(true);
    if (postType === 'drafts') {
      listPostDrafts(person.username).then((items) => {
        if (active) setDrafts(items);
      }).catch((loadError) => {
        if (active) {
          setDrafts([]);
          setError(loadError.message || 'Your saved drafts could not be opened.');
        }
      }).finally(() => active && setPostsLoading(false));
      return () => { active = false; };
    }
    if (postType === 'fans') {
      setPostsLoading(false);
      return () => { active = false; };
    }
    api.listUserPosts(person.username, postType).then((payload) => {
      if (active) setProfilePosts(payload.posts || []);
    }).catch(() => {
      if (active) setProfilePosts(matchingFallback);
    }).finally(() => active && setPostsLoading(false));
    return () => { active = false; };
  }, [matchingFallback, person?.username, postType]);

  if (!person) return <main className="profile-page profile-page-loading"><LoaderCircle className="spin" /> Loading profile…</main>;
  const shownPerson = preview ? { ...person, avatar: preview } : person;

  const showRelationships = async (direction) => {
    setRelationshipView(direction);
    setRelationshipLoading(true);
    setError('');
    try {
      const payload = await api.listRelationshipPeople(person.username, direction);
      setRelationshipPeople((payload?.people || []).map(normalizeUserShape));
    } catch (loadError) {
      setRelationshipPeople([]);
      setError(loadError.message || 'Those people could not be gathered.');
    } finally {
      setRelationshipLoading(false);
    }
  };

  const save = async () => {
    if (!file) return;
    setSaving(true);
    setError('');
    try {
      await onAvatar(file);
      setFile(null);
      setEditing(false);
      onDirtyChange?.(false);
      onEditingChange?.(false);
    } catch (saveError) {
      setError(saveError.message || 'That photo could not be changed.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    setError('');
    try {
      await onDeleteAvatar();
      setFile(null);
      setEditing(false);
      onDirtyChange?.(false);
      onEditingChange?.(false);
    } catch (removeError) {
      setError(removeError.message || 'That photo could not be removed.');
    } finally {
      setSaving(false);
    }
  };

  const saveDetails = async () => {
    setDetailsSaving(true);
    setError('');
    try {
      await onProfileDetails?.({
        fullName: profileDetails.fullName.trim(),
        username: profileDetails.username.trim(),
        email: profileDetails.email.trim(),
        phone: profileDetails.phone.trim(),
      });
      onDirtyChange?.(false);
    } catch (detailsError) {
      setError(detailsError.message || 'Those account details could not be changed.');
    } finally {
      setDetailsSaving(false);
    }
  };

  return (
    <main className="profile-page" id="main-content">
      <section className="profile-page-card">
        <div className={`profile-sky ${editing ? 'editing-profile-sky' : ''}`}>
          {editing ? (
            <div className="change-profile-picture-preview"><Avatar person={shownPerson} size="hero" /><strong>Change profile picture</strong></div>
          ) : (
            <>
              <div className="profile-orbit orbit-one" /><div className="profile-orbit orbit-two" />
              <div className="profile-avatar-top"><Avatar person={shownPerson} size="hero" /></div>
              <div className="profile-name-side"><p><strong>Name:</strong><span>{person.name}</span></p><p><strong>Username:</strong><span>@{person.username}</span></p></div>
              <div className={`profile-relationship-stage ${person.isFollowing ? 'viewer-connected' : ''}`}>
                <div className="relationship-side">
                  <button type="button" className="relationship-scene-button followers-scene" onClick={() => showRelationships('followers')} aria-label={`${exactCount(person.followers)} people want to be with ${isOwn ? 'you' : person.name}`}>
                    <RelationshipScene direction="followers" />
                    <span><strong>{exactCount(person.followers)}</strong><small>The people who want to be with {isOwn ? 'me' : 'them'}</small></span>
                  </button>
                </div>
                <div className="relationship-side">
                  <button type="button" className="relationship-scene-button following-scene" onClick={() => showRelationships('following')} aria-label={`${exactCount(person.following)} people ${isOwn ? 'you want' : `${person.name} wants`} to be with`}>
                    <RelationshipScene direction="following" active={!isOwn && person.isFollowing} />
                    <span><strong>{exactCount(person.following)}</strong><small>The people {isOwn ? 'I' : 'they'} want to be with</small></span>
                  </button>
                  {!isOwn && <button type="button" className={`profile-follow-click ${person.isFollowing ? 'following' : ''}`} onClick={() => onFollow(person)} aria-pressed={Boolean(person.isFollowing)}>Click here</button>}
                </div>
              </div>
              {person.bio && <p className="profile-bio">{person.bio}</p>}
              {isOwn && <button type="button" className="secondary-button profile-change" onClick={() => {
                const next = !editing;
                if (!editing || !profileDirty) setEditing(next);
                onEditingChange?.(next);
              }}><Camera size={16} /> Change profile photo</button>}
            </>
          )}
        </div>

        {relationshipView && (
          <section className="relationship-list" aria-live="polite">
            <header>
              <div><UsersRound size={18} /><strong>{relationshipView === 'followers' ? 'The people who want to be with me' : 'The people I want to be with'}</strong></div>
              <button type="button" onClick={() => setRelationshipView(null)} aria-label="Close people list"><X size={17} /></button>
            </header>
            {relationshipLoading ? <p><LoaderCircle className="spin" size={18} /> Gathering people…</p> : relationshipPeople.length ? (
              <div>{relationshipPeople.map((item) => <article key={item.id || item.username}><Avatar person={item} /><span><strong>{item.name}</strong><small>@{item.username}</small></span></article>)}</div>
            ) : <p>No people are in this wing yet.</p>}
          </section>
        )}

        {isOwn && editing && (
          <div className="avatar-editor">
            <div className="profile-details-editor">
              <label><span>Full name</span><input value={profileDetails.fullName} maxLength="100" onChange={(event) => setProfileDetails((current) => ({ ...current, fullName: event.target.value }))} /></label>
              <label><span>Username</span><div className="username-input"><b>@</b><input value={profileDetails.username} maxLength="40" onChange={(event) => setProfileDetails((current) => ({ ...current, username: event.target.value.toLowerCase().replace(/[^a-z]/g, '') }))} /></div></label>
              <label><span>Phone number</span><input type="tel" value={profileDetails.phone} placeholder="+923254695657" onChange={(event) => setProfileDetails((current) => ({ ...current, phone: event.target.value.replace(/[^\d+\s()-]/g, '') }))} /></label>
              <label><span>Email address</span><input type="email" value={profileDetails.email} placeholder="you@example.com" onChange={(event) => setProfileDetails((current) => ({ ...current, email: event.target.value }))} /></label>
              <button type="button" className="primary-button" onClick={saveDetails} disabled={detailsSaving || !profileDetails.fullName || !profileDetails.username}>{detailsSaving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />} Save account details</button>
            </div>
            <div className="avatar-drop" onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
              event.preventDefault();
              const next = [...event.dataTransfer.files].find((item) => item.type.startsWith('image/'));
              if (next) setFile(next);
            }}>
              <ImagePlus size={24} />
              <div><strong>Drop a photo here</strong></div>
              <span className="profile-upload-or">OR</span>
              <button type="button" className="secondary-button" onClick={() => inputRef.current?.click()}>Choose photo</button>
              <input ref={inputRef} className="visually-hidden-file" type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            </div>
            <p className="avatar-delete-note">Deleting your photo brings back your name on a solid blue background.</p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="form-actions">
              {person.avatar && <button type="button" className="danger-button" onClick={remove} disabled={saving}><Trash2 size={16} /> Delete photo</button>}
              <button type="button" className="primary-button" onClick={save} disabled={!file || saving}>{saving ? <LoaderCircle className="spin" size={16} /> : <Camera size={16} />} Save change</button>
            </div>
          </div>
        )}
      </section>

      {!editing && <section className="profile-posts" aria-labelledby="profile-posts-title">
        <h2 id="profile-posts-title" className="sr-only">{isOwn ? 'My posts' : `${person.name}'s posts`}</h2>
        <div className="profile-post-tabs" role="tablist" aria-label="Choose a post format">
          {postFilters.filter(([type]) => isOwn || !['drafts', 'fans'].includes(type)).map(([type, label]) => <button type="button" role="tab" aria-selected={postType === type} className={postType === type ? 'active' : ''} key={type} onClick={() => setPostType(type)}>{isOwn ? label : label.replace('My', `${person.name}'s`)}</button>)}
        </div>
        {postsLoading ? <div className="profile-post-loading"><LoaderCircle className="spin" /> Gathering posts…</div> : postType === 'drafts' ? (
          drafts.length ? <div className="draft-list">{drafts.map((draft) => (
            <article className="draft-card" key={draft.id}>
              <span className="draft-format"><FileClock size={20} /><b>{draft.type.replace('-', ' ')}</b></span>
              <div><strong>{draft.type === 'text' ? draft.text?.split('\n')[0] || 'Unfinished text post' : draft.name || `Unfinished ${draft.type}`}</strong><small>Saved {new Date(draft.updatedAt).toLocaleString()}</small><p>{draft.files?.length ? `${draft.files.length} selected ${draft.files.length === 1 ? 'file' : 'files'}` : 'No media selected yet'}</p></div>
              <div className="draft-actions"><button type="button" className="primary-button" onClick={() => onResumeDraft?.(draft)}><Play size={15} /> Complete it</button><button type="button" className="danger-button" onClick={async () => { await deletePostDraft(draft.id); setDrafts((current) => current.filter((item) => item.id !== draft.id)); }}><Trash2 size={15} /> Delete</button></div>
            </article>
          ))}</div> : <div className="profile-post-empty">No saved things to complete later.</div>
        ) : postType === 'fans' ? (
          <CreatorFansBehaviour />
        ) : profilePosts.length ? (
          <div className="feed-column">{profilePosts.map((post, index) => <FeedCard key={post.id} post={post} onPerson={onPerson} onPost={onPost} onDelete={async (item) => { await onDeletePost?.(item); setProfilePosts((current) => current.filter((candidate) => candidate.id !== item.id)); }} viewer={viewer} onRequireAuth={onRequireAuth} priority={index === 0} />)}</div>
        ) : <div className="profile-post-empty">No {postType.replace('-', ' ')} posts yet.</div>}
      </section>}
    </main>
  );
}
