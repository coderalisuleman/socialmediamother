import { useEffect, useState } from 'react';
import { BarChart3, BrainCircuit, LoaderCircle, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';

const TOKEN_KEY = 'mother.human-behaviour.team';

export default function HumanBehaviourPage() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || '');
  const [email, setEmail] = useState('businessalisuleman@gmail.com');
  const [password, setPassword] = useState('');
  const [days, setDays] = useState(7);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadReport = async (activeToken = token, selectedDays = days) => {
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

  useEffect(() => { if (token) loadReport(token, days); }, [token, days]);

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

  if (!token) return (
    <main className="human-behaviour-page" id="main-content">
      <section className="human-team-login"><span><BrainCircuit size={34} /></span><h1>Human-behaviour team</h1><p>This private report helps the web team understand journeys, watching, reactions, errors and exits without collecting form text or passwords.</p><form onSubmit={login}><label><span>Analytics team email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required /></label><label><span>Analytics team password</span><div className="input-with-icon"><LockKeyhole size={17} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></div></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" disabled={loading}>{loading ? <LoaderCircle className="spin" size={16} /> : <ShieldCheck size={16} />} Open private report</button></form></section>
    </main>
  );

  const totals = report?.totals || {};
  return (
    <main className="human-behaviour-page" id="main-content">
      <header className="human-report-heading"><div><p className="eyebrow"><BrainCircuit size={15} /> Private business understanding</p><h1>Human-behaviour</h1><p>Continuous first-party interaction report. No passwords, phone numbers, email addresses or typed form content are stored here.</p></div><div><label>Report period<select value={days} onChange={(event) => setDays(Number(event.target.value))}><option value="1">Today</option><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></label><button type="button" className="secondary-button" onClick={() => loadReport()} disabled={loading}><RefreshCw className={loading ? 'spin' : ''} size={16} /> Refresh</button></div></header>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="human-metrics"><article><strong>{totals.sessions || 0}</strong><span>human sessions</span></article><article><strong>{totals.events || 0}</strong><span>interactions</span></article><article><strong>{totals.watchingSeconds || 0}</strong><span>watching seconds</span></article></div>
      <section className="business-recommendations"><h2><BarChart3 size={19} /> Report for making the web better and more profitable</h2>{report?.recommendations?.map((item) => <p key={item}>{item}</p>)}</section>
      <div className="human-report-grid"><section><h2>Most used places</h2>{report?.paths?.map((item) => <article key={item.path}><span>{item.path}</span><b>{item.count}</b></article>)}</section><section><h2>What people did</h2>{report?.eventTypes?.map((item) => <article key={item.eventType}><span>{item.eventType.replaceAll('_', ' ')}</span><b>{item.count}</b></article>)}</section></div>
    </main>
  );
}
