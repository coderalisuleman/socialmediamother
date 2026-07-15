import { useEffect, useMemo, useState } from 'react';
import { Download, LoaderCircle, LogOut } from 'lucide-react';
import { api } from '../lib/api';
import { exportReport, safeFilePart } from '../lib/reportExport';
import { PasswordField } from './AuthModals';

const TOKEN_KEY = 'mother.human-behaviour.team';

function reportLines(report) {
  const totals = report?.totals || {};
  return [
    'SocialMediaMother human behaviour report',
    `Period: ${new Date(report?.period?.since || Date.now()).toLocaleDateString()} to ${new Date(report?.period?.until || Date.now()).toLocaleDateString()}`,
    `Human sessions: ${totals.sessions || 0}`,
    `Interactions: ${totals.events || 0}`,
    `Watching seconds: ${totals.watchingSeconds || 0}`,
    '',
    'Most used places',
    ...(report?.paths || []).map((item) => `${item.path}: ${item.count}`),
    '',
    'What people did',
    ...(report?.eventTypes || []).map((item) => `${item.eventType.replaceAll('_', ' ')}: ${item.count}`),
  ];
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
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const selectedDays = useMemo(() => {
    const maximum = periodUnit === 'months' ? 12 : 365;
    const amount = Math.min(maximum, Math.max(1, Number.parseInt(periodAmount, 10) || 1));
    return Math.min(365, periodUnit === 'months' ? amount * 30 : amount);
  }, [periodAmount, periodUnit]);

  const loadReport = async (activeToken = token) => {
    if (!activeToken) return;
    setLoading(true);
    setError('');
    try {
      setReport(await api.analyticsTeamReport(activeToken, selectedDays));
    } catch (loadError) {
      if (loadError.status === 401) {
        sessionStorage.removeItem(TOKEN_KEY);
        setToken('');
      }
      setError(loadError.message || 'The human-behaviour report could not be loaded.');
    } finally {
      setLoading(false);
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
      setError(loginError.message || 'Human-behaviour team account-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const accountOut = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken('');
    setReport(null);
    setFormat('');
    setError('');
  };

  if (!token) return (
    <main className="human-behaviour-page" id="main-content">
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
  const download = async () => {
    if (!report || !format || downloading) return;
    setDownloading(true);
    setError('');
    try {
      await exportReport({
        format,
        fileName: safeFilePart(`SocialMediaMother-human-behaviour-${selectedDays}-days`),
        title: 'SocialMediaMother human behaviour report',
        lines: reportLines(report),
        sheetName: 'Human behaviour',
      });
    } catch (downloadError) {
      setError(downloadError.message || 'The report could not be downloaded.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <main className="human-behaviour-page" id="main-content">
      <section className="analytics-team-toolbar" aria-label="Human behaviour account and download actions">
        <button type="button" className="analytics-account-out" onClick={accountOut}><LogOut size={18} /> Account out</button>
        {report && <div className="analytics-download analytics-download-inline"><label><span className="sr-only">Select your format</span><select value={format} onChange={(event) => setFormat(event.target.value)}><option value="">Select your format</option><option value="image">Image</option><option value="pdf">PDF</option><option value="excel">Excel</option></select></label><button type="button" className="secondary-button" disabled={!format || downloading} onClick={download}>{downloading ? <LoaderCircle className="spin" size={17} /> : <Download size={17} />} Download</button></div>}
      </section>
      <section className="analytics-time-card" aria-label="Choose the time for analytics">
        <strong>Time for analytics</strong>
        <label><span className="sr-only">Days or months</span><select value={periodUnit} onChange={(event) => { setPeriodUnit(event.target.value); setPeriodAmount(event.target.value === 'months' ? '6' : '30'); }}><option value="days">Days</option><option value="months">Months</option></select></label>
        <label><span className="sr-only">Number of {periodUnit}</span><input type="number" min="1" max={periodUnit === 'months' ? 12 : 365} placeholder={periodUnit === 'months' ? '6' : '30'} value={periodAmount} onChange={(event) => setPeriodAmount(event.target.value.replace(/\D/g, '').slice(0, 3))} /></label>
        <button type="button" className="primary-button" onClick={() => loadReport()} disabled={loading}>{loading ? <LoaderCircle className="spin" size={16} /> : null} Search</button>
      </section>
      {error && <p className="form-error" role="alert">{error}</p>}
      {report && (
        <section className="analytics-notebook">
          <PencilDrawing />
          <div className="human-metrics"><article><strong>{totals.sessions || 0}</strong><span>human sessions</span></article><article><strong>{totals.events || 0}</strong><span>interactions</span></article><article><strong>{totals.watchingSeconds || 0}</strong><span>watching seconds</span></article></div>
          <div className="human-report-grid"><section><h2>Most used places</h2>{report.paths?.map((item) => <article key={item.path}><span>{item.path}</span><b>{item.count}</b></article>)}</section><section><h2>What people did</h2>{report.eventTypes?.map((item) => <article key={item.eventType}><span>{item.eventType.replaceAll('_', ' ')}</span><b>{item.count}</b></article>)}</section></div>
        </section>
      )}
    </main>
  );
}
