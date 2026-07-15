import { useEffect, useMemo, useState } from 'react';
import { Download, LoaderCircle } from 'lucide-react';
import { api } from '../lib/api';
import { PasswordField } from './AuthModals';

const TOKEN_KEY = 'mother.human-behaviour.team';

function safeFilePart(value) {
  return String(value || '').replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

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

function exportPdf(report, name) {
  const lines = reportLines(report).slice(0, 48).map((line) => String(line).replace(/[^\x20-\x7E]/g, ' ').replace(/([\\()])/g, '\\$1'));
  const content = `BT\n/F1 10 Tf\n40 760 Td\n14 TL\n${lines.map((line) => `(${line}) Tj T*`).join('\n')}\nET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  downloadBlob(new Blob([pdf], { type: 'application/pdf' }), `${name}.pdf`);
}

function exportExcel(report, name) {
  const escape = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const rows = reportLines(report).map((line) => `<Row><Cell><Data ss:Type="String">${escape(line)}</Data></Cell></Row>`).join('');
  const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Human behaviour"><Table>${rows}</Table></Worksheet></Workbook>`;
  downloadBlob(new Blob([xml], { type: 'application/vnd.ms-excel' }), `${name}.xls`);
}

function exportImage(report, name) {
  const canvas = document.createElement('canvas');
  canvas.width = 1400;
  canvas.height = 1800;
  const context = canvas.getContext('2d');
  context.fillStyle = '#fffdf7';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = 'rgba(79, 148, 177, .16)';
  for (let y = 80; y < canvas.height; y += 42) { context.beginPath(); context.moveTo(0, y); context.lineTo(canvas.width, y); context.stroke(); }
  context.strokeStyle = 'rgba(182, 111, 82, .28)';
  context.beginPath(); context.moveTo(105, 0); context.lineTo(105, canvas.height); context.stroke();
  context.fillStyle = '#20343d';
  context.font = '700 38px Arial';
  context.fillText('SocialMediaMother human behaviour report', 145, 95);
  context.font = '24px Arial';
  reportLines(report).slice(1).forEach((line, index) => {
    context.fillStyle = index === 5 || line === 'What people did' ? '#8f4e37' : '#315b6b';
    context.fillText(String(line).slice(0, 92), 145, 155 + index * 42);
  });
  canvas.toBlob((blob) => blob && downloadBlob(blob, `${name}.png`), 'image/png', .92);
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

  if (!token) return (
    <main className="human-behaviour-page" id="main-content">
      <section className="human-team-login human-team-login-simple">
        <form onSubmit={login}>
          <label><span>Analytics team email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required /></label>
          <PasswordField label="Analytics team password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" disabled={loading}>{loading ? <LoaderCircle className="spin" size={16} /> : null} Account in</button>
        </form>
      </section>
    </main>
  );

  const totals = report?.totals || {};
  const download = () => {
    if (!report || !format) return;
    const name = safeFilePart(`SocialMediaMother-human-behaviour-${selectedDays}-days`);
    if (format === 'image') exportImage(report, name);
    if (format === 'pdf') exportPdf(report, name);
    if (format === 'excel') exportExcel(report, name);
  };

  return (
    <main className="human-behaviour-page" id="main-content">
      <section className="analytics-time-card" aria-label="Choose the time for analytics">
        <strong>Time for analytics</strong>
        <label><span className="sr-only">Days or months</span><select value={periodUnit} onChange={(event) => { setPeriodUnit(event.target.value); setPeriodAmount(event.target.value === 'months' ? '6' : '30'); }}><option value="days">Days</option><option value="months">Months</option></select></label>
        <label><span className="sr-only">Number of {periodUnit}</span><input type="number" min="1" max={periodUnit === 'months' ? 12 : 365} placeholder={periodUnit === 'months' ? '6' : '30'} value={periodAmount} onChange={(event) => setPeriodAmount(event.target.value.replace(/\D/g, '').slice(0, 3))} /></label>
        <button type="button" className="primary-button" onClick={() => loadReport()} disabled={loading}>{loading ? <LoaderCircle className="spin" size={16} /> : null} Collect</button>
      </section>
      {error && <p className="form-error" role="alert">{error}</p>}
      {report && (
        <section className="analytics-notebook">
          <PencilDrawing />
          <div className="human-metrics"><article><strong>{totals.sessions || 0}</strong><span>human sessions</span></article><article><strong>{totals.events || 0}</strong><span>interactions</span></article><article><strong>{totals.watchingSeconds || 0}</strong><span>watching seconds</span></article></div>
          <div className="human-report-grid"><section><h2>Most used places</h2>{report.paths?.map((item) => <article key={item.path}><span>{item.path}</span><b>{item.count}</b></article>)}</section><section><h2>What people did</h2>{report.eventTypes?.map((item) => <article key={item.eventType}><span>{item.eventType.replaceAll('_', ' ')}</span><b>{item.count}</b></article>)}</section></div>
        </section>
      )}
      {report && <section className="analytics-download"><label><span className="sr-only">Select your format</span><select value={format} onChange={(event) => setFormat(event.target.value)}><option value="">Select your format</option><option value="image">Image</option><option value="pdf">PDF</option><option value="excel">Excel</option></select></label><button type="button" className="secondary-button" disabled={!format} onClick={download}><Download size={17} /> Download</button></section>}
    </main>
  );
}
