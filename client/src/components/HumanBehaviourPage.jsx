import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, LoaderCircle, LogOut } from 'lucide-react';
import { api } from '../lib/api';
import { positiveAnalyticsCount } from '../lib/analyticsPresentation';
import { exportReport, safeFilePart } from '../lib/reportExport';
import { PasswordField } from './AuthModals';
import './HumanBehaviourPage.css';

const TOKEN_KEY = 'mother.human-behaviour.team';

function reportLines(report) {
  const totals = report?.totals || {};
  const lifetime = report?.period?.mode === 'lifetime';
  return [
    'SocialMediaMother whole-web analytics report',
    `Period: ${lifetime ? 'Lifetime (all available data)' : `${new Date(report?.period?.since || Date.now()).toLocaleDateString()} to ${new Date(report?.period?.until || Date.now()).toLocaleDateString()}`}`,
    `Human sessions: ${totals.sessions || 0}`,
    `Interactions: ${totals.events || 0}`,
    ...(Number(totals.watchingSeconds) > 0 ? [`Video watching seconds: ${totals.watchingSeconds}`] : []),
    '',
    'Most used places',
    ...(report?.paths || []).map((item) => `${item.path}: ${item.count}`),
    '',
    'What people did',
    ...(report?.eventTypes || []).map((item) => `${item.eventType.replaceAll('_', ' ')}: ${item.count}`),
  ];
}

function reportSections(report) {
  const totals = report?.totals || {};
  const watchingSeconds = positiveAnalyticsCount(totals.watchingSeconds);
  return [
    {
      id: 'totals',
      title: 'Totals',
      rows: [
        { id: 'sessions', label: 'Human sessions', count: positiveAnalyticsCount(totals.sessions) },
        { id: 'events', label: 'Interactions', count: positiveAnalyticsCount(totals.events) },
        ...(watchingSeconds > 0
          ? [{ id: 'video-watching-seconds', label: 'Video watching seconds', count: watchingSeconds }]
          : []),
      ],
    },
    {
      id: 'paths',
      title: 'Most used places',
      rows: (report?.paths || []).map((item) => ({
        id: item.path,
        label: item.path,
        count: positiveAnalyticsCount(item.count),
      })),
    },
    {
      id: 'events',
      title: 'What people did',
      rows: (report?.eventTypes || []).map((item) => ({
        id: item.eventType,
        label: item.eventType.replaceAll('_', ' '),
        count: positiveAnalyticsCount(item.count),
      })),
    },
  ];
}

function AnalyticsTable({ sections }) {
  return (
    <section className="human-analytics-table-view" aria-label="Analytics shown as tables">
      {sections.map((section) => (
        <div className="human-analytics-table-wrap" key={section.id}>
          <table>
            <caption>{section.title}</caption>
            <thead><tr><th scope="col">Data</th><th scope="col">Total</th></tr></thead>
            <tbody>
              {section.rows.length ? section.rows.map((row) => (
                <tr key={row.id}>
                  <th scope="row">{row.label}</th>
                  <td>{row.count.toLocaleString()}</td>
                </tr>
              )) : (
                <tr><td className="human-analytics-empty-cell" colSpan="2">No data for this time yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}

function AnalyticsGraph({ sections }) {
  return (
    <section className="human-analytics-graph-view" aria-label="Analytics shown as graphs">
      {sections.map((section) => {
        const maximum = Math.max(0, ...section.rows.map((row) => row.count));
        return (
          <section className="human-analytics-graph-card" key={section.id} aria-labelledby={`analytics-graph-${section.id}`}>
            <h2 id={`analytics-graph-${section.id}`}>{section.title}</h2>
            {section.rows.length ? (
              <ul className="human-analytics-bars">
                {section.rows.map((row) => {
                  const percentage = maximum > 0 ? (row.count / maximum) * 100 : 0;
                  return (
                    <li key={row.id}>
                      <div className="human-analytics-bar-copy">
                        <span>{row.label}</span>
                        <strong>{row.count.toLocaleString()}</strong>
                      </div>
                      <div
                        className="human-analytics-bar-track"
                        role="img"
                        aria-label={`${row.label}: ${row.count.toLocaleString()}`}
                      >
                        <span
                          className="human-analytics-bar-fill"
                          style={{ '--human-analytics-bar-width': `${percentage}%` }}
                          aria-hidden="true"
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="human-analytics-empty">No data for this time yet.</p>}
          </section>
        );
      })}
    </section>
  );
}

function PencilDrawing() {
  return (
    <svg className="analytics-pencil" viewBox="0 0 180 74" aria-hidden="true">
      <path className="pencil-line" d="M7 57c25-24 39 3 64-19s43 18 72-11" />
      <g className="drawing-pencil"><path d="m118 14 12-9 38 38-12 10Z" /><path d="m156 53 12-10 5 15Z" /></g>
    </svg>
  );
}

export default function HumanBehaviourPage() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || '');
  const [email, setEmail] = useState('businessalisuleman@gmail.com');
  const [password, setPassword] = useState('');
  const [periodUnit, setPeriodUnit] = useState('days');
  const [periodAmount, setPeriodAmount] = useState('30');
  const [report, setReport] = useState(null);
  const [format, setFormat] = useState('');
  const [viewMode, setViewMode] = useState('drawing');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const reportRequestRef = useRef(0);

  const lifetime = periodUnit === 'lifetime';
  const selectedDays = useMemo(() => {
    if (lifetime) return null;
    const maximum = periodUnit === 'years' ? 100 : periodUnit === 'months' ? 600 : 36_500;
    const amount = Math.min(maximum, Math.max(1, Number.parseInt(periodAmount, 10) || 1));
    return Math.min(36_500, periodUnit === 'years' ? amount * 365 : periodUnit === 'months' ? amount * 30 : amount);
  }, [lifetime, periodAmount, periodUnit]);

  const loadReport = async (activeToken = token) => {
    if (!activeToken) return;
    const requestId = reportRequestRef.current + 1;
    reportRequestRef.current = requestId;
    const requestPeriod = { days: selectedDays || 30, lifetime };
    setLoading(true);
    setError('');
    try {
      const nextReport = await api.analyticsTeamReport(activeToken, requestPeriod);
      if (reportRequestRef.current === requestId) setReport(nextReport);
    } catch (loadError) {
      if (reportRequestRef.current !== requestId) return;
      if (loadError.status === 401) {
        sessionStorage.removeItem(TOKEN_KEY);
        setToken('');
      }
      setError(loadError.message || 'The analytics report could not be loaded.');
    } finally {
      if (reportRequestRef.current === requestId) setLoading(false);
    }
  };

  useEffect(() => { if (token && !report) loadReport(token); }, [token]);

  const login = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = await api.analyticsTeamLogin(email.trim(), password);
      sessionStorage.setItem(TOKEN_KEY, payload.token);
      setPassword('');
      setToken(payload.token);
    } catch (loginError) {
      setError(loginError.message || 'Analytics team account-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const accountOut = () => {
    reportRequestRef.current += 1;
    sessionStorage.removeItem(TOKEN_KEY);
    setToken('');
    setReport(null);
    setFormat('');
    setViewMode('drawing');
    setError('');
  };

  if (!token) return (
    <main className="human-behaviour-page" id="main-content">
      <h1 className="sr-only">Whole-web analytics</h1>
      <section className="human-team-login human-team-login-simple">
        <form onSubmit={login}>
          <label><span>Analytics team email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required /></label>
          <PasswordField className="human-password-field" showLock={false} label="Analytics team password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" disabled={loading}>{loading ? <LoaderCircle className="spin" size={16} /> : null} Account in</button>
        </form>
      </section>
    </main>
  );

  const totals = report?.totals || {};
  const sections = reportSections(report);
  const watchingSeconds = positiveAnalyticsCount(totals.watchingSeconds);
  const collectedLifetime = report?.period?.mode === 'lifetime';
  const collectedDays = positiveAnalyticsCount(report?.period?.days) || 30;
  const collectedFilePeriod = collectedLifetime ? 'lifetime' : `${collectedDays}-days`;
  const download = async () => {
    if (!report || !format || downloading) return;
    setDownloading(true);
    setError('');
    try {
      await exportReport({
        format,
        fileName: safeFilePart(`SocialMediaMother-analytics-${collectedFilePeriod}`),
        title: 'SocialMediaMother whole-web analytics report',
        lines: reportLines(report),
        sheetName: 'Web analytics',
      });
    } catch (downloadError) {
      setError(downloadError.message || 'The report could not be downloaded.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <main className="human-behaviour-page" id="main-content">
      <h1 className="sr-only">Whole-web analytics</h1>
      <section className={`analytics-time-card ${lifetime ? 'lifetime' : ''}`} aria-label="Choose the time for analytics">
        <strong>Time for analytics</strong>
        <label><span className="sr-only">Days, months, years, or lifetime</span><select value={periodUnit} onChange={(event) => { const value = event.target.value; setPeriodUnit(value); setPeriodAmount(value === 'months' ? '6' : value === 'years' ? '1' : value === 'lifetime' ? '' : '30'); }}><option value="days">Days</option><option value="months">Months</option><option value="years">Years</option><option value="lifetime">Lifetime</option></select></label>
        {!lifetime && <label><span className="sr-only">Number of {periodUnit}</span><input type="number" min="1" max={periodUnit === 'years' ? 100 : periodUnit === 'months' ? 600 : 36500} placeholder={periodUnit === 'years' ? '1' : periodUnit === 'months' ? '6' : '30'} value={periodAmount} onChange={(event) => setPeriodAmount(event.target.value.replace(/\D/g, '').slice(0, 5))} /></label>}
        <button type="button" className="primary-button" onClick={() => loadReport()} disabled={loading}>{loading ? <LoaderCircle className="spin" size={16} /> : null} Search</button>
      </section>
      {error && <p className="form-error" role="alert">{error}</p>}
      {report && (
        <>
          <section className="human-analytics-view-selector" aria-label="Choose how to show analytics">
            <label htmlFor="human-analytics-view">Show analytics as</label>
            <select id="human-analytics-view" value={viewMode} onChange={(event) => setViewMode(event.target.value)}>
              <option value="drawing">Drawing</option>
              <option value="table">Table</option>
              <option value="graph">Graph</option>
            </select>
          </section>
          {viewMode === 'drawing' && (
            <section className="analytics-notebook">
              <PencilDrawing />
              <div className="human-metrics">
                <article><strong>{positiveAnalyticsCount(totals.sessions).toLocaleString()}</strong><span>human sessions</span></article>
                <article><strong>{positiveAnalyticsCount(totals.events).toLocaleString()}</strong><span>interactions</span></article>
                {watchingSeconds > 0 && <article><strong>{watchingSeconds.toLocaleString()}</strong><span>video watching seconds</span></article>}
              </div>
              <div className="human-report-grid"><section><h2>Most used places</h2>{report.paths?.map((item) => <article key={item.path}><span>{item.path}</span><b>{item.count}</b></article>)}</section><section><h2>What people did</h2>{report.eventTypes?.map((item) => <article key={item.eventType}><span>{item.eventType.replaceAll('_', ' ')}</span><b>{item.count}</b></article>)}</section></div>
            </section>
          )}
          {viewMode === 'table' && <AnalyticsTable sections={sections} />}
          {viewMode === 'graph' && <AnalyticsGraph sections={sections} />}
        </>
      )}
      <section className="analytics-team-toolbar analytics-team-toolbar-bottom" aria-label="Analytics account and download actions">
        <button type="button" className="analytics-account-out" onClick={accountOut}><LogOut size={18} /> Account out</button>
        {report && <div className="analytics-download analytics-download-inline"><label><span className="sr-only">Select your format</span><select value={format} onChange={(event) => setFormat(event.target.value)}><option value="">Select your format</option><option value="image">Image</option><option value="pdf">PDF</option><option value="excel">Excel</option></select></label><button type="button" className="secondary-button" disabled={!format || downloading} onClick={download}>{downloading ? <LoaderCircle className="spin" size={17} /> : <Download size={17} />} Download</button></div>}
      </section>
    </main>
  );
}
