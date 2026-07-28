import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Download, FileClock, LoaderCircle, Pencil, Play, Save, Search, Trash2 } from 'lucide-react';
import { api, normalizePostShape, normalizeUserShape } from '../lib/api';
import { isWatchTimePost, positiveAnalyticsCount } from '../lib/analyticsPresentation';
import { deletePostDraft, listPostDrafts } from '../lib/drafts';
import { exportReport, safeFilePart } from '../lib/reportExport';
import {
  collectRelationshipPages,
  filterRelationshipPeople,
  mergeRelationshipPeople,
  relationshipAccordionLabel,
} from '../lib/relationships';
import { Avatar, FeedCard } from './Feed';

function exactCount(value) {
  return Number(value || 0).toLocaleString('en-US').replaceAll(',', '');
}

const postFilters = [
  ['text', 'My Text Posts'],
  ['photo', 'My Photo Posts'],
  ['video', 'My Video Posts'],
  ['short-video', 'My Short Video Posts'],
  ['drafts', 'Saved till and complete later'],
  ['fans', 'Fans-behaviour'],
];

const fanPostMetricDefinitions = [
  ['views', 'viewers'],
  ['hugs', 'hugs'],
  ['throws', 'throws'],
  ['thoughts', 'thoughts'],
  ['followersGained', 'people gained'],
];

function postTypeLabel(post) {
  return String(post?.type || 'post').replaceAll('-', ' ');
}

function fanSummaryMetrics(totals, followers) {
  return [
    ['post formats', totals.posts],
    ['viewers', totals.views],
    ['hugs', totals.hugs],
    ['throws', totals.throws],
    ['sent thoughts', totals.thoughts],
    ...(Number(totals.watchingSeconds || 0) > 0 ? [['video watching seconds', totals.watchingSeconds]] : []),
    ['people with you now', followers],
  ];
}

function FanDrawingView({ metrics, posts }) {
  return (
    <section className="analytics-notebook fans-notebook" aria-label="Fans behaviour drawing">
      <svg className="analytics-pencil" viewBox="0 0 180 74" aria-hidden="true"><path className="pencil-line" d="M7 57c25-24 39 3 64-19s43 18 72-11" /><g className="drawing-pencil"><path d="m118 14 12-9 38 38-12 10Z" /><path d="m156 53 12-10 5 15Z" /></g></svg>
      <div className="fans-metrics">
        {metrics.map(([label, value]) => <article key={label}><strong>{exactCount(value)}</strong><span>{label}</span></article>)}
      </div>
      <section className="individual-performance">
        <h3>Every post by itself</h3>
        {posts.length ? posts.map((post) => (
          <article key={post.id}>
            <div><strong>{post.name}</strong><small>{postTypeLabel(post)} · {new Date(post.createdAt).toLocaleDateString()}</small></div>
            <span><b>{exactCount(post.views)}</b> viewers</span>
            <span><b>{exactCount(post.hugs)}</b> hugs</span>
            <span><b>{exactCount(post.throws)}</b> throws</span>
            <span><b>{exactCount(post.thoughts)}</b> thoughts</span>
            {isWatchTimePost(post) && positiveAnalyticsCount(post.watchingSeconds) > 0 && <span><b>{exactCount(post.watchingSeconds)}</b> video watching seconds</span>}
            <span><b>{exactCount(post.followersGained)}</b> people gained</span>
          </article>
        )) : <p>No published posts have behaviour to read yet.</p>}
      </section>
    </section>
  );
}

function FanTableView({ metrics, posts }) {
  const videoPosts = posts.filter((post) => isWatchTimePost(post) && positiveAnalyticsCount(post.watchingSeconds) > 0);
  return (
    <section className="fans-table-view" aria-label="Fans behaviour tables">
      <h3>Report totals</h3>
      <div className="fans-table-scroll">
        <table>
          <caption className="sr-only">Totals for this fans behaviour report</caption>
          <thead><tr><th scope="col">Information</th><th scope="col">Total</th></tr></thead>
          <tbody>{metrics.map(([label, value]) => <tr key={label}><th scope="row">{label}</th><td>{exactCount(value)}</td></tr>)}</tbody>
        </table>
      </div>
      <h3>Every post by itself</h3>
      {posts.length ? (
        <div className="fans-table-scroll">
          <table className="fans-posts-table">
            <caption className="sr-only">Behaviour for every published post</caption>
            <thead>
              <tr>
                <th scope="col">Post</th><th scope="col">Format</th><th scope="col">Date</th>
                <th scope="col">Viewers</th><th scope="col">Hugs</th><th scope="col">Throws</th>
                <th scope="col">Thoughts</th>
                <th scope="col">People gained</th>
              </tr>
            </thead>
            <tbody>{posts.map((post) => (
              <tr key={post.id}>
                <th scope="row">{post.name}</th>
                <td>{postTypeLabel(post)}</td>
                <td>{new Date(post.createdAt).toLocaleDateString()}</td>
                <td>{exactCount(post.views)}</td><td>{exactCount(post.hugs)}</td><td>{exactCount(post.throws)}</td>
                <td>{exactCount(post.thoughts)}</td>
                <td>{exactCount(post.followersGained)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <p>No published posts have behaviour to read yet.</p>}
      {videoPosts.length > 0 && (
        <>
          <h3>Video watching time</h3>
          <div className="fans-table-scroll">
            <table>
              <caption className="sr-only">Watching time for video and short-video posts only</caption>
              <thead><tr><th scope="col">Video post</th><th scope="col">Format</th><th scope="col">Watching seconds</th></tr></thead>
              <tbody>{videoPosts.map((post) => (
                <tr key={post.id}>
                  <th scope="row">{post.name}</th>
                  <td>{postTypeLabel(post)}</td>
                  <td>{exactCount(post.watchingSeconds)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function FanGraphMetric({ label, value, maximum }) {
  const amount = Number(value || 0);
  return (
    <div className="fans-graph-metric">
      <div><span>{label}</span><strong>{exactCount(amount)}</strong></div>
      <progress value={amount} max={Math.max(1, maximum)} aria-label={`${label}: ${exactCount(amount)}`} />
    </div>
  );
}

function FanGraphView({ metrics, posts }) {
  const totalMaximum = Math.max(1, ...metrics.map(([, value]) => Number(value || 0)));
  const postMaximum = (key) => Math.max(1, ...posts.map((post) => Number(post[key] || 0)));
  return (
    <section className="fans-graph-view" aria-label="Fans behaviour graphs">
      <h3>Report totals</h3>
      <div className="fans-summary-graph">{metrics.map(([label, value]) => <FanGraphMetric key={label} label={label} value={value} maximum={totalMaximum} />)}</div>
      <h3>Every post by itself</h3>
      {posts.length ? <div className="fans-post-graphs">{posts.map((post) => (
        <article key={post.id}>
          <header><strong>{post.name}</strong><small>{postTypeLabel(post)} · {new Date(post.createdAt).toLocaleDateString()}</small></header>
          {fanPostMetricDefinitions.map(([key, label]) => <FanGraphMetric key={key} label={label} value={post[key]} maximum={postMaximum(key)} />)}
          {isWatchTimePost(post) && positiveAnalyticsCount(post.watchingSeconds) > 0 && <FanGraphMetric label="video watching seconds" value={post.watchingSeconds} maximum={postMaximum('watchingSeconds')} />}
        </article>
      ))}</div> : <p>No published posts have behaviour to read yet.</p>}
    </section>
  );
}

function CreatorFansBehaviour() {
  const [report, setReport] = useState(null);
  const [periodUnit, setPeriodUnit] = useState('days');
  const [periodAmount, setPeriodAmount] = useState('30');
  const [reportView, setReportView] = useState('drawing');
  const [format, setFormat] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const reportRequestRef = useRef(0);

  const lifetime = periodUnit === 'lifetime';
  const selectedDays = useMemo(() => {
    if (lifetime) return null;
    const maximum = periodUnit === 'months' ? 12 : 365;
    const amount = Math.min(maximum, Math.max(1, Number.parseInt(periodAmount, 10) || 1));
    return Math.min(365, periodUnit === 'months' ? amount * 30 : amount);
  }, [lifetime, periodAmount, periodUnit]);

  const collect = async () => {
    const requestId = reportRequestRef.current + 1;
    reportRequestRef.current = requestId;
    const requestPeriod = { days: selectedDays || 30, lifetime };
    setLoading(true);
    setError('');
    try {
      const nextReport = await api.creatorAnalytics(requestPeriod);
      if (reportRequestRef.current === requestId) setReport(nextReport);
    } catch (loadError) {
      if (reportRequestRef.current === requestId) setError(loadError.message || 'Fans-behaviour could not be gathered.');
    } finally {
      if (reportRequestRef.current === requestId) setLoading(false);
    }
  };

  const totals = report?.totals || {};
  const individualPosts = report?.individual || [];
  const summaryMetrics = fanSummaryMetrics(totals, report?.followers);
  const collectedLifetime = report?.period?.mode === 'lifetime';
  const collectedDays = Number(report?.periodDays || 0) || 30;
  const collectedPeriodLabel = collectedLifetime ? 'From account creation to till now' : `Last ${collectedDays} days`;
  const collectedFilePeriod = collectedLifetime ? 'lifetime' : `${collectedDays}-days`;
  const reportLines = report ? [
    'SocialMediaMother fans behaviour report',
    `Period: ${collectedPeriodLabel}`,
    `Post formats: ${totals.posts || 0}`,
    `Viewers: ${totals.views || 0}`,
    `Hugs: ${totals.hugs || 0}`,
    `Throws: ${totals.throws || 0}`,
    `Sent thoughts: ${totals.thoughts || 0}`,
    ...(Number(totals.watchingSeconds || 0) > 0 ? [`Video watching seconds: ${totals.watchingSeconds}`] : []),
    `People with you now: ${report.followers || 0}`,
    '',
    'Every post by itself',
    ...(report.individual || []).flatMap((post) => [
      `${post.name} (${post.type.replace('-', ' ')})`,
      `Viewers ${post.views}; Hugs ${post.hugs}; Throws ${post.throws}; Thoughts ${post.thoughts}${isWatchTimePost(post) && positiveAnalyticsCount(post.watchingSeconds) > 0 ? `; Video watching seconds ${post.watchingSeconds}` : ''}; People gained ${post.followersGained}`,
    ]),
  ] : [];
  const download = async () => {
    if (!report || !format || downloading) return;
    setDownloading(true);
    setError('');
    try {
      await exportReport({
        format,
        fileName: safeFilePart(`SocialMediaMother-fans-behaviour-${collectedFilePeriod}`),
        title: 'SocialMediaMother fans behaviour report',
        lines: reportLines,
        sheetName: 'Fans behaviour',
      });
    } catch (downloadError) {
      setError(downloadError.message || 'This fans report could not be downloaded.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fans-report">
      <section className="fans-period-controls" aria-label="Choose fans behaviour report time">
        <label><span className="sr-only">Choose days, months, or lifetime</span><select value={periodUnit} onChange={(event) => { const value = event.target.value; setPeriodUnit(value); setPeriodAmount(value === 'months' ? '6' : '30'); }}><option value="days">Days</option><option value="months">Months</option><option value="lifetime">From account creation to till now</option></select></label>
        {!lifetime && <label><span className="sr-only">Number of {periodUnit}</span><input type="number" min="1" max={periodUnit === 'months' ? 12 : 365} placeholder={periodUnit === 'months' ? '6' : '30'} value={periodAmount} onChange={(event) => setPeriodAmount(event.target.value.replace(/\D/g, '').slice(0, 3))} /></label>}
        <button type="button" className="primary-button" onClick={collect} disabled={loading}>{loading ? <LoaderCircle className="spin" size={16} /> : null} Collect</button>
      </section>
      {error && <p className="form-error" role="alert">{error}</p>}
      {report ? <>
        <section className="fans-view-picker" aria-label="Choose how to show the fans behaviour report">
          <label htmlFor="fans-report-view">Show report as</label>
          <select id="fans-report-view" value={reportView} onChange={(event) => setReportView(event.target.value)}>
            <option value="drawing">Drawing</option><option value="table">Table</option><option value="graph">Graph</option>
          </select>
        </section>
        <div className="fans-view-output" aria-live="polite">
          {reportView === 'drawing' && <FanDrawingView metrics={summaryMetrics} posts={individualPosts} />}
          {reportView === 'table' && <FanTableView metrics={summaryMetrics} posts={individualPosts} />}
          {reportView === 'graph' && <FanGraphView metrics={summaryMetrics} posts={individualPosts} />}
        </div>
        <section className="analytics-download fans-download"><label><span className="sr-only">Select your format</span><select value={format} onChange={(event) => setFormat(event.target.value)}><option value="">Select your format</option><option value="image">Image</option><option value="pdf">PDF</option><option value="excel">Excel</option></select></label><button type="button" className="secondary-button" disabled={!format || downloading} onClick={download}>{downloading ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />} Download</button></section>
      </> : !loading && <p className="fans-report-empty">Choose a time, then select Collect to draw your report.</p>}
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
  const [relationshipError, setRelationshipError] = useState('');
  const [relationshipQuery, setRelationshipQuery] = useState('');
  const [relationshipNextCursor, setRelationshipNextCursor] = useState(null);
  const [postType, setPostType] = useState('text');
  const [profilePosts, setProfilePosts] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [draftsLoading, setDraftsLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [profileDetails, setProfileDetails] = useState({ fullName: '', username: '', email: '', phone: '' });
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [pictureMenuOpen, setPictureMenuOpen] = useState(false);
  const inputRef = useRef(null);
  const pictureMenuContainerRef = useRef(null);
  const pictureMenuRef = useRef(null);
  const pictureMenuTriggerRef = useRef(null);
  const relationshipRequestRef = useRef(0);

  useEffect(() => {
    setEditing(startEditing);
    setFile(null);
    setPictureMenuOpen(false);
    relationshipRequestRef.current += 1;
    setRelationshipView(null);
    setRelationshipPeople([]);
    setRelationshipLoading(false);
    setRelationshipError('');
    setRelationshipQuery('');
    setRelationshipNextCursor(null);
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

  useEffect(() => {
    if (!pictureMenuOpen) return undefined;
    const focusFrame = window.requestAnimationFrame(() => {
      pictureMenuRef.current?.querySelector('[role="menuitem"]:not(:disabled)')?.focus();
    });
    const closeOutside = (event) => {
      if (!pictureMenuContainerRef.current?.contains(event.target)) setPictureMenuOpen(false);
    };
    const closeWithEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setPictureMenuOpen(false);
      pictureMenuTriggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeWithEscape);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeWithEscape);
    };
  }, [pictureMenuOpen]);

  const matchingFallback = useMemo(() => fallbackPosts
    .filter((post) => post.author?.username === person?.username && post.type === postType)
    .map(normalizePostShape), [fallbackPosts, person?.username, postType]);
  const visibleRelationshipPeople = useMemo(
    () => filterRelationshipPeople(relationshipPeople, relationshipQuery),
    [relationshipPeople, relationshipQuery]
  );

  useEffect(() => {
    if (!isOwn || !person?.username) {
      setDrafts([]);
      setDraftsLoading(false);
      return undefined;
    }

    let active = true;
    let requestId = 0;
    const refreshDrafts = async ({ showLoading = false } = {}) => {
      const currentRequest = requestId + 1;
      requestId = currentRequest;
      if (showLoading && active) setDraftsLoading(true);
      try {
        const items = await listPostDrafts(person.username);
        if (active && currentRequest === requestId) setDrafts(items);
      } catch (loadError) {
        if (active && currentRequest === requestId) {
          setDrafts([]);
          setError(loadError.message || 'Your saved drafts could not be opened.');
        }
      } finally {
        if (active && currentRequest === requestId) setDraftsLoading(false);
      }
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshDrafts();
    };

    refreshDrafts({ showLoading: true });
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      active = false;
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [isOwn, person?.username]);

  useEffect(() => {
    if (!person?.username) return undefined;
    let active = true;
    setPostsLoading(true);
    if (postType === 'drafts') {
      setPostsLoading(draftsLoading);
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
  }, [draftsLoading, matchingFallback, person?.username, postType]);

  if (!person) return <main className="profile-page profile-page-loading"><LoaderCircle className="spin" /> Loading profile…</main>;
  const shownPerson = preview ? { ...person, avatar: preview } : person;

  const loadRelationships = async (direction, { append = false, cursor = null } = {}) => {
    const requestId = relationshipRequestRef.current + 1;
    relationshipRequestRef.current = requestId;
    setRelationshipLoading(true);
    setRelationshipError('');
    try {
      const result = await collectRelationshipPages(
        (pageCursor) => api.listRelationshipPeople(person.username, direction, pageCursor),
        { cursor }
      );
      if (relationshipRequestRef.current !== requestId) return;
      const normalized = result.people.map(normalizeUserShape);
      setRelationshipPeople((current) => append
        ? mergeRelationshipPeople(current, normalized)
        : normalized);
      setRelationshipNextCursor(result.nextCursor);
    } catch (loadError) {
      if (relationshipRequestRef.current !== requestId) return;
      if (!append) setRelationshipPeople([]);
      setRelationshipError(loadError.message || 'Those people could not be gathered.');
    } finally {
      if (relationshipRequestRef.current === requestId) setRelationshipLoading(false);
    }
  };

  const toggleRelationships = (direction) => {
    if (relationshipView === direction) {
      relationshipRequestRef.current += 1;
      setRelationshipView(null);
      setRelationshipLoading(false);
      setRelationshipError('');
      setRelationshipQuery('');
      setRelationshipNextCursor(null);
      return;
    }
    setRelationshipView(direction);
    setRelationshipPeople([]);
    setRelationshipError('');
    setRelationshipQuery('');
    setRelationshipNextCursor(null);
    loadRelationships(direction);
  };

  const relationshipPanel = (direction) => {
    if (relationshipView !== direction) return null;
    const label = relationshipAccordionLabel(direction, isOwn);
    const panelId = `relationship-${direction}-panel`;
    const triggerId = `relationship-${direction}-trigger`;
    const hasLoadedPeople = relationshipPeople.length > 0;
    return (
      <div
        id={panelId}
        className="relationship-accordion-panel"
        role="region"
        aria-labelledby={triggerId}
      >
        <label className="relationship-search">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Search {label.toLowerCase()} by name or username</span>
          <input
            type="search"
            value={relationshipQuery}
            placeholder="Search by name or @username"
            onChange={(event) => setRelationshipQuery(event.target.value)}
          />
        </label>

        {relationshipNextCursor && (
          <p className="relationship-loaded-note">
            Search covers the people loaded so far. Load the remaining people to search everyone.
          </p>
        )}

        {relationshipLoading && !hasLoadedPeople ? (
          <p className="relationship-status" role="status"><LoaderCircle className="spin" size={18} /> Gathering people…</p>
        ) : relationshipError && !hasLoadedPeople ? (
          <div className="relationship-error" role="alert">
            <span>{relationshipError}</span>
            <button type="button" onClick={() => loadRelationships(direction)}>Retry</button>
          </div>
        ) : visibleRelationshipPeople.length ? (
          <div className="relationship-person-list" role="list">
            {visibleRelationshipPeople.map((item) => (
              <div role="listitem" key={item.id || item.username}>
                <button type="button" onClick={() => onPerson?.(item)} aria-label={`Open ${item.name || item.fullName || item.username}'s profile`}>
                  <Avatar person={item} />
                  <span>
                    <strong>{item.name || item.fullName || 'Mother member'}</strong>
                    <small>@{item.username}</small>
                  </span>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="relationship-status">
            {relationshipQuery.trim() ? 'No people match your search.' : 'No people are here yet.'}
          </p>
        )}

        {relationshipError && hasLoadedPeople && <p className="relationship-inline-error" role="alert">{relationshipError}</p>}
        {relationshipNextCursor && (
          <button
            type="button"
            className="relationship-load-more"
            disabled={relationshipLoading}
            onClick={() => loadRelationships(direction, { append: true, cursor: relationshipNextCursor })}
          >
            {relationshipLoading ? <LoaderCircle className="spin" size={16} /> : null}
            {relationshipLoading ? 'Loading remaining people…' : 'Load remaining people'}
          </button>
        )}
      </div>
    );
  };

  const changePicture = async (nextFile) => {
    if (!nextFile?.type?.startsWith('image/')) {
      setError('Choose an image file for your profile picture.');
      return;
    }
    setPictureMenuOpen(false);
    setFile(nextFile);
    setSaving(true);
    setError('');
    try {
      await onAvatar(nextFile);
      setFile(null);
    } catch (saveError) {
      setFile(null);
      setError(saveError.message || 'That photo could not be changed.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setPictureMenuOpen(false);
    setSaving(true);
    setError('');
    try {
      await onDeleteAvatar();
      setFile(null);
    } catch (removeError) {
      setError(removeError.message || 'That photo could not be removed.');
    } finally {
      setSaving(false);
    }
  };

  const openPicturePicker = () => {
    setPictureMenuOpen(false);
    if (!inputRef.current) return;
    inputRef.current.value = '';
    inputRef.current.click();
  };

  const movePictureMenuFocus = (event) => {
    const items = [...event.currentTarget.querySelectorAll('[role="menuitem"]:not(:disabled)')];
    if (!items.length) return;
    const currentIndex = items.indexOf(document.activeElement);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1 + items.length) % items.length;
    else if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + items.length) % items.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = items.length - 1;
    else {
      if (event.key === 'Tab') setPictureMenuOpen(false);
      return;
    }
    event.preventDefault();
    items[nextIndex].focus();
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
            <div className="change-profile-picture-preview">
              <div className="profile-picture-control" ref={pictureMenuContainerRef} aria-busy={saving}>
                <Avatar person={shownPerson} size="hero" />
                <button
                  ref={pictureMenuTriggerRef}
                  type="button"
                  className="profile-picture-edit-trigger"
                  aria-label="Edit profile picture"
                  aria-haspopup="menu"
                  aria-expanded={pictureMenuOpen}
                  aria-controls="profile-picture-actions"
                  disabled={saving}
                  onClick={() => setPictureMenuOpen((current) => !current)}
                  onKeyDown={(event) => {
                    if (event.key !== 'ArrowDown') return;
                    event.preventDefault();
                    setPictureMenuOpen(true);
                  }}
                >
                  {saving ? <LoaderCircle className="spin" size={18} /> : <Pencil size={18} />}
                </button>
                {pictureMenuOpen && (
                  <div
                    ref={pictureMenuRef}
                    id="profile-picture-actions"
                    className="profile-picture-action-menu"
                    role="menu"
                    aria-label="Profile picture actions"
                    onKeyDown={movePictureMenuFocus}
                  >
                    <button type="button" role="menuitem" className="remove-picture-action" onClick={remove}>Remove picture</button>
                    <button type="button" role="menuitem" onClick={openPicturePicker}>Change picture</button>
                  </div>
                )}
                <input
                  ref={inputRef}
                  className="visually-hidden-file"
                  type="file"
                  accept="image/*"
                  tabIndex={-1}
                  aria-label="Choose a new profile picture"
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] || null;
                    event.target.value = '';
                    if (nextFile) changePicture(nextFile);
                  }}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="profile-orbit orbit-one" /><div className="profile-orbit orbit-two" />
              <div className="profile-avatar-top"><Avatar person={shownPerson} size="hero" /></div>
              <div className="profile-name-side"><p><strong>Name:</strong><span>{person.name}</span></p><p><strong>Username:</strong><span>@{person.username}</span></p></div>
              <div className="profile-relationship-accordions">
                <section className={`relationship-accordion ${relationshipView === 'followers' ? 'open' : ''} ${!isOwn && person.isFollowing ? 'viewer-connected' : ''}`}>
                  <div className="relationship-control-row">
                    <button
                      id="relationship-followers-trigger"
                      type="button"
                      className={`relationship-control-main ${!isOwn ? 'relationship-follow-action' : ''}`}
                      {...(isOwn ? {
                        'aria-expanded': relationshipView === 'followers',
                        'aria-controls': 'relationship-followers-panel',
                        onClick: () => toggleRelationships('followers'),
                      } : {
                        'aria-pressed': Boolean(person.isFollowing),
                        'aria-label': person.isFollowing
                          ? `Stop being one of the people who want to see ${person.name}`
                          : `Become one of the people who want to see ${person.name}`,
                        onClick: () => onFollow(person),
                      })}
                    >
                      <span>{relationshipAccordionLabel('followers', isOwn)}</span>
                      <strong className="relationship-count-box">{exactCount(person.followers)}</strong>
                    </button>
                    <button
                      type="button"
                      className="relationship-expand-action"
                      aria-label={`${relationshipView === 'followers' ? 'Hide' : 'Show'} ${relationshipAccordionLabel('followers', isOwn).toLowerCase()}`}
                      aria-expanded={relationshipView === 'followers'}
                      aria-controls="relationship-followers-panel"
                      onClick={() => toggleRelationships('followers')}
                    >
                      <ChevronDown size={21} aria-hidden="true" />
                    </button>
                  </div>
                  {relationshipPanel('followers')}
                </section>

                <section className={`relationship-accordion ${relationshipView === 'following' ? 'open' : ''}`}>
                  <div className="relationship-control-row">
                    <button
                      id="relationship-following-trigger"
                      type="button"
                      className="relationship-control-main"
                      aria-expanded={relationshipView === 'following'}
                      aria-controls="relationship-following-panel"
                      onClick={() => toggleRelationships('following')}
                    >
                      <span>{relationshipAccordionLabel('following', isOwn)}</span>
                      <strong className="relationship-count-box">{exactCount(person.following)}</strong>
                    </button>
                    <button
                      type="button"
                      className="relationship-expand-action"
                      aria-label={`${relationshipView === 'following' ? 'Hide' : 'Show'} ${relationshipAccordionLabel('following', isOwn).toLowerCase()}`}
                      aria-expanded={relationshipView === 'following'}
                      aria-controls="relationship-following-panel"
                      onClick={() => toggleRelationships('following')}
                    >
                      <ChevronDown size={21} aria-hidden="true" />
                    </button>
                  </div>
                  {relationshipPanel('following')}
                </section>
              </div>
              {person.bio && <p className="profile-bio">{person.bio}</p>}
            </>
          )}
        </div>

        {isOwn && editing && (
          <div className="avatar-editor">
            <div className="profile-details-editor">
              <label><span>Full name</span><input value={profileDetails.fullName} maxLength="100" onChange={(event) => setProfileDetails((current) => ({ ...current, fullName: event.target.value }))} /></label>
              <label><span>Username</span><div className="username-input"><b>@</b><input value={profileDetails.username} maxLength="40" onChange={(event) => setProfileDetails((current) => ({ ...current, username: event.target.value.toLowerCase().replace(/[^a-z]/g, '') }))} /></div></label>
              <label><span>Phone number</span><input type="tel" value={profileDetails.phone} placeholder="+923254695657" onChange={(event) => setProfileDetails((current) => ({ ...current, phone: event.target.value.replace(/[^\d+\s()-]/g, '') }))} /></label>
              <label><span>Email address</span><input type="email" value={profileDetails.email} placeholder="you@example.com" onChange={(event) => setProfileDetails((current) => ({ ...current, email: event.target.value }))} /></label>
              <button type="button" className="primary-button" onClick={saveDetails} disabled={detailsSaving || !profileDetails.fullName || !profileDetails.username}>{detailsSaving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />} Save account details</button>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
          </div>
        )}
      </section>

      {!editing && <section className="profile-posts" aria-labelledby="profile-posts-title">
        <h2 id="profile-posts-title" className="sr-only">{isOwn ? 'My posts' : `${person.name}'s posts`}</h2>
        <div className="profile-post-tabs" role="tablist" aria-label="Choose a post format">
          {postFilters.filter(([type]) => isOwn || !['drafts', 'fans'].includes(type)).map(([type, label]) => {
            const visibleLabel = isOwn ? label : label.replace('My', `${person.name}'s`);
            return (
              <button type="button" role="tab" aria-selected={postType === type} className={`${postType === type ? 'active ' : ''}${isOwn && type === 'drafts' ? 'has-count' : ''}`.trim()} key={type} onClick={() => setPostType(type)}>
                <span>{visibleLabel}</span>
                {isOwn && type === 'drafts' && (
                  <>
                    <span className="profile-tab-count" aria-hidden="true">{draftsLoading ? '…' : drafts.length.toLocaleString('en-US')}</span>
                    <span className="sr-only">{draftsLoading ? ' Checking saved count.' : ` ${drafts.length} saved ${drafts.length === 1 ? 'thing' : 'things'}.`}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
        {postsLoading ? <div className="profile-post-loading"><LoaderCircle className="spin" /> Gathering posts…</div> : postType === 'drafts' ? (
          drafts.length ? <div className="draft-list">{drafts.map((draft) => (
            <article className="draft-card" key={draft.id}>
              <span className="draft-format"><FileClock size={20} /><b>{draft.type.replace('-', ' ')}</b></span>
              <div><strong>{draft.type === 'text' ? draft.text?.split('\n')[0] || 'Unfinished text post' : draft.name || `Unfinished ${draft.type}`}</strong><small>Saved {new Date(draft.updatedAt).toLocaleString()}</small><p>{draft.uploadCheckpoint ? `${draft.uploadCheckpoint.percent || 0}% uploaded · resumes from the saved point` : draft.files?.length ? `${draft.files.length} selected ${draft.files.length === 1 ? 'file' : 'files'}` : 'No media selected yet'}</p></div>
              <div className="draft-actions"><button type="button" className="primary-button" onClick={() => onResumeDraft?.(draft)}><Play size={15} /> {draft.uploadCheckpoint ? `Resume from ${draft.uploadCheckpoint.percent || 0}%` : 'Complete it'}</button><button type="button" className="danger-button" onClick={async () => { if (draft.uploadCheckpoint?.sessionId) await api.cancelUploadSession(draft.uploadCheckpoint.sessionId).catch(() => {}); await deletePostDraft(draft.id); setDrafts((current) => current.filter((item) => item.id !== draft.id)); }}><Trash2 size={15} /> Delete</button></div>
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
