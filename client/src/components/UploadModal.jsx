import { memo, useEffect, useRef, useState } from 'react';
import { AlignLeft, ArrowDownToLine, ArrowLeft, Ban, CheckCircle2, Film, Image as ImageIcon, Link2, LoaderCircle, Pause, Play, Plus, Save, Smartphone, UploadCloud, Video } from 'lucide-react';
import { useObjectUrls } from '../lib/hooks';
import { optimizePhoto } from '../lib/media';
import { formatBytes, formatRemainingTime } from '../lib/uploadProgress';
import { deletePostDraft, savePostDraft } from '../lib/drafts';
import Modal from './Modal';
import { MediaCarousel } from './Feed';

const choices = [
  { id: 'text', label: 'Text', detail: 'A thought, a note, a story', icon: AlignLeft },
  { id: 'photo', label: 'Photo', detail: 'One picture or a collection', icon: ImageIcon },
  { id: 'video', label: 'Video', detail: 'One film or a carousel', icon: Video },
  { id: 'short-video', label: 'Short video', detail: 'Vertical, quick and in motion', icon: Smartphone },
];

function UploadProgress({ progress }) {
  if (!progress) return null;
  const failed = progress.status === 'failed';
  const cancelled = progress.status === 'cancelled';
  const paused = progress.status === 'paused';
  const pausing = progress.status === 'pausing';
  const processing = progress.status === 'processing';
  const remainingBytes = Math.max(0, progress.total - progress.loaded);
  const timeLabel = cancelled
    ? 'Cancelled — your form and selected files are still here'
    : paused
      ? 'Paused — choose resume whenever you are ready'
      : pausing
        ? 'Pausing after the current small piece…'
        : failed
    ? 'Upload stopped — retry when ready'
    : processing
      ? 'Upload sent — finishing your post'
      : progress.remainingSeconds == null
        ? 'Calculating time left…'
        : `${formatRemainingTime(progress.remainingSeconds)} left`;

  return (
    <section className={`upload-progress-card ${failed ? 'failed' : ''} ${cancelled ? 'cancelled' : ''} ${paused || pausing ? 'paused' : ''}`} aria-live="polite">
      <div className="upload-progress-head">
        <span><UploadCloud size={19} /><strong>{cancelled ? 'Upload cancelled' : paused ? 'Upload paused' : pausing ? 'Pausing upload' : failed ? 'Upload stopped' : processing ? 'Finishing your post' : 'Uploading your post'}</strong></span>
        <b>{progress.percent}%</b>
      </div>
      <div
        className="upload-progress-track"
        role="progressbar"
        aria-label="Post upload progress"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={progress.percent}
      >
        <span style={{ width: `${progress.percent}%` }} />
      </div>
      <div className="upload-progress-details">
        <span><small>Transferred</small><strong>{formatBytes(progress.loaded)} of {formatBytes(progress.total)}</strong></span>
        <span><small>Remaining</small><strong>{formatBytes(remainingBytes)}</strong></span>
        <span><small>Speed</small><strong>{progress.bytesPerSecond > 0 ? `${formatBytes(progress.bytesPerSecond)}/s` : 'Measuring…'}</strong></span>
        <span><small>Time remaining</small><strong>{timeLabel}</strong></span>
      </div>
    </section>
  );
}

const DropField = memo(function DropField({ mode, files, setFiles }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [droppedCount, setDroppedCount] = useState(0);
  const urls = useObjectUrls(files);
  const accept = mode === 'photo' ? 'image/*' : 'video/*';
  const previewMedia = urls.map((src, index) => ({
    src,
    type: mode === 'photo' ? 'image' : 'video',
    alt: files[index]?.name || `Selected ${mode}`,
  }));

  useEffect(() => {
    if (!droppedCount) return undefined;
    const timer = window.setTimeout(() => setDroppedCount(0), 2600);
    return () => window.clearTimeout(timer);
  }, [droppedCount]);

  const add = async (list, { dropped = false } = {}) => {
    const valid = [...list].filter((file) => mode === 'photo' ? file.type.startsWith('image/') : file.type.startsWith('video/'));
    setOptimizing(mode === 'photo' && valid.some((file) => file.size >= 450_000));
    try {
      const prepared = mode === 'photo' ? await Promise.all(valid.map(optimizePhoto)) : valid;
      setFiles((current) => [...current, ...prepared]);
      if (dropped && prepared.length) setDroppedCount(prepared.length);
    } finally {
      setOptimizing(false);
    }
  };

  return (
    <div className="file-area">
      <div className="file-choice-row">
        <button type="button" className="file-choice" onClick={() => inputRef.current?.click()}>
          <span><UploadCloud size={26} /></span>
          <strong>Upload from your device</strong>
          <small>Choose {mode === 'photo' ? 'photos' : 'videos'} from files</small>
        </button>
        <span className="or-badge">OR</span>
        <div
          className={`file-choice drop-choice ${dragging ? 'dragging' : ''} ${droppedCount ? 'dropped' : ''}`}
          onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => { event.preventDefault(); setDragging(false); add(event.dataTransfer.files, { dropped: true }); }}
        >
          <span><ArrowDownToLine size={26} /></span>
          <strong>Drop here</strong>
          <small>Release your collection into this card</small>
        </div>
      </div>
      {droppedCount > 0 && <div className="drop-confirmation" role="status"><CheckCircle2 size={21} /><span><strong>{droppedCount} {droppedCount === 1 ? 'file' : 'files'} dropped</strong><small>Your upload is ready below.</small></span></div>}
      <input
        ref={inputRef}
        type="file"
        className="visually-hidden-file"
        accept={accept}
        multiple
        onChange={(event) => add(event.target.files)}
      />
      {optimizing && <p className="file-optimizing" role="status"><LoaderCircle className="spin" size={16} /> Compressing photos for a faster post…</p>}
      {files.length > 0 && (
        <div className="selected-files">
          <MediaCarousel media={previewMedia} short={mode === 'short-video'} preview />
          <div className="file-list-head">
            <p><strong>{files.length}</strong> {files.length === 1 ? 'file' : 'files'} ready</p>
            <button type="button" onClick={() => setFiles([])}>Remove all</button>
          </div>
          <ul>
            {files.map((file, index) => (
              <li key={`${file.name}-${file.lastModified}-${index}`}>
                <span>{file.name}</span>
                <button type="button" onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${file.name}`}>×</button>
              </li>
            ))}
          </ul>
          <button type="button" className="add-another" onClick={() => inputRef.current?.click()}><Plus size={15} /> Add another</button>
        </div>
      )}
    </div>
  );
});

export default function UploadModal({ open, onClose, onCreate, initialMode = null, initialDraft = null, ownerUsername = '', onModeChange, onDirtyChange, onDraftSaved }) {
  const [mode, setMode] = useState(null);
  const [name, setName] = useState('');
  const [detail, setDetail] = useState('');
  const [link, setLink] = useState('');
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadControl, setUploadControl] = useState(null);
  const [draftId, setDraftId] = useState(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (open) return;
    setMode(null);
    setName('');
    setDetail('');
    setLink('');
    setText('');
    setFiles([]);
    setSubmitting(false);
    setUploadProgress(null);
    setUploadControl(null);
    setDraftId(null);
    setDraftSaving(false);
    setError('');
    setDiscardConfirm(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (initialDraft) {
      setMode(initialDraft.type || initialMode || null);
      setName(initialDraft.name || '');
      setDetail(initialDraft.detail || '');
      setLink(initialDraft.link || '');
      setText(initialDraft.text || '');
      setFiles(Array.isArray(initialDraft.files) ? initialDraft.files : []);
      setDraftId(initialDraft.id || null);
      return;
    }
    setMode(initialMode || null);
  }, [initialDraft, initialMode, open]);

  useEffect(() => {
    if (!open) {
      onDirtyChange?.(false);
      return;
    }
    const dirty = Boolean(mode && (text || name || detail || link || files.length));
    onDirtyChange?.(dirty);
  }, [detail, files.length, link, mode, name, onDirtyChange, open, text]);

  const chooseMode = (nextMode) => {
    setMode(nextMode);
    setFiles([]);
    setUploadProgress(null);
    setUploadControl(null);
    setError('');
    onModeChange?.(nextMode);
  };

  const reset = () => {
    setMode(null);
    setName('');
    setDetail('');
    setLink('');
    setText('');
    setFiles([]);
    setUploadProgress(null);
    setUploadControl(null);
    setDraftId(null);
    setDraftSaving(false);
    setError('');
    setDiscardConfirm(false);
  };

  const close = () => {
    if (submitting) return;
    onClose();
  };

  const saveDraft = async () => {
    if (!mode || draftSaving || submitting) return;
    setDraftSaving(true);
    setError('');
    try {
      const saved = await savePostDraft({
        id: draftId,
        ownerUsername,
        type: mode,
        name,
        detail,
        link,
        text,
        files,
      });
      setDraftId(saved.id);
      onDirtyChange?.(false);
      onDraftSaved?.(saved);
      reset();
      onClose();
    } catch (draftError) {
      setError(draftError.message || 'This draft could not be saved on your device.');
    } finally {
      setDraftSaving(false);
    }
  };

  const insertNewline = () => {
    const input = textareaRef.current;
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    setText((value) => `${value.slice(0, start)}\n${value.slice(end)}`);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + 1, start + 1);
    });
  };

  const goBack = () => {
    const hasWork = Boolean(text || name || detail || link || files.length);
    if (hasWork) {
      setDiscardConfirm(true);
      return;
    }
    chooseMode(null);
  };

  const discardAndGoBack = () => {
    onDirtyChange?.(false);
    reset();
    onModeChange?.(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (mode === 'text' && !text.trim()) return setError('Write at least one line before posting.');
    if (mode !== 'text' && !name.trim()) return setError('Please give this post a name.');
    if (mode !== 'text' && !files.length) return setError(`Choose at least one ${mode === 'photo' ? 'photo' : 'video'}.`);
    const totalFileBytes = files.reduce((total, file) => total + Number(file.size || 0), 0);
    setUploadProgress(mode === 'text' ? null : {
      loaded: 0,
      total: totalFileBytes,
      percent: 0,
      bytesPerSecond: 0,
      remainingSeconds: null,
      status: 'uploading',
    });
    setSubmitting(true);
    try {
      const cleanText = text.trim();
      await onCreate({
        type: mode,
        name: mode === 'text' ? cleanText.split(/\n/)[0].slice(0, 120) : name.trim(),
        detail: mode === 'text' ? '' : detail.trim(),
        links: mode === 'text' ? [] : link.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean),
        text: cleanText,
        files,
      }, setUploadProgress, setUploadControl, (status) => setUploadProgress((current) => current ? { ...current, status } : current));
      if (draftId) await deletePostDraft(draftId).catch(() => {});
      onDirtyChange?.(false);
      reset();
      onClose();
    } catch (submitError) {
      setUploadProgress((current) => current ? { ...current, status: submitError?.cancelled ? 'cancelled' : 'failed' } : null);
      setError(submitError?.cancelled ? '' : submitError.message || 'This post could not be shared. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Upload" wide className="upload-modal">
      {!mode ? (
        <div className="upload-choices">
          {choices.map(({ id, label, detail: choiceDetail, icon: Icon }, index) => (
            <button type="button" key={id} onClick={() => chooseMode(id)} style={{ '--choice-delay': `${index * 55}ms` }}>
              <span className="choice-icon"><Icon size={26} /></span>
              <span><strong>Upload {label.toLowerCase()}</strong><small>{choiceDetail}</small></span>
              <i>0{index + 1}</i>
            </button>
          ))}
        </div>
      ) : (
        <form className="upload-form" onSubmit={submit}>
          <button type="button" className="back-link" onClick={goBack} disabled={submitting}><ArrowLeft size={21} strokeWidth={2.6} /> Go back</button>

          {discardConfirm && <div className="inline-discard-card" role="alertdialog" aria-label="Delete unfinished upload data?"><strong>Your unfinished work will be deleted</strong><p>If you go back now, your writing and selected files will be removed. You can save till later instead.</p><div><button type="button" className="primary-button" onClick={() => setDiscardConfirm(false)}>No, I want to complete this</button><button type="button" className="danger-button" onClick={discardAndGoBack}>Go back and delete it</button></div></div>}

          {mode === 'text' ? (
            <div className="text-editor-wrap">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Write exactly as you think it…"
                rows="8"
                autoFocus
                required
              />
              <button type="button" className="newline-button" onClick={insertNewline} title="Start a new line">
                <ArrowDownToLine size={17} /> New line
              </button>
            </div>
          ) : (
            <DropField mode={mode} files={files} setFiles={setFiles} />
          )}

          {mode !== 'text' && (
            <div className="post-fields">
              <label>
                <span>Name it <b>must fill</b></span>
                <input value={name} onChange={(event) => setName(event.target.value)} required maxLength="120" placeholder="What should people call this?" autoFocus />
              </label>
              <label>
                <span>Detail it <em>optional</em></span>
                <textarea value={detail} onChange={(event) => setDetail(event.target.value)} rows="3" maxLength="600" placeholder="A little context, a story, a credit…" />
              </label>
              <label>
                <span><Link2 size={14} /> Links to your other platforms <em>optional</em></span>
                <textarea value={link} onChange={(event) => setLink(event.target.value)} rows="2" placeholder="One URL per line, or separate them with commas" />
              </label>
            </div>
          )}
          <UploadProgress progress={uploadProgress} />
          {submitting && uploadControl && uploadProgress && !['processing', 'cancelled', 'failed'].includes(uploadProgress.status) && (
            <div className="upload-control-row" aria-label="Upload controls">
              {['paused', 'pausing'].includes(uploadProgress.status) ? (
                <button type="button" className="secondary-button" onClick={() => uploadControl.resume()} disabled={uploadProgress.status === 'pausing'}><Play size={16} /> {uploadProgress.status === 'pausing' ? 'Pausing…' : 'Resume upload'}</button>
              ) : (
                <button type="button" className="secondary-button" onClick={() => uploadControl.pause()}><Pause size={16} /> Pause upload</button>
              )}
              <button type="button" className="cancel-upload-button" onClick={() => uploadControl.cancel()}><Ban size={16} /> Cancel upload</button>
            </div>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions">
            <button type="button" className="secondary-button" onClick={close} disabled={submitting}>Cancel</button>
            <button type="button" className="draft-save-button" onClick={saveDraft} disabled={submitting || draftSaving}><Save size={16} /> {draftSaving ? 'Saving…' : 'Save till and complete later'}</button>
            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting ? <><LoaderCircle className="spin" size={17} /> {uploadProgress ? uploadProgress.status === 'processing' ? 'Finishing…' : uploadProgress.status === 'paused' ? `Paused ${uploadProgress.percent}%` : `Uploading ${uploadProgress.percent}%` : 'Posting…'}</> : <><Film size={17} /> {uploadProgress?.status === 'cancelled' ? 'Start upload again' : 'Post it'}</>}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
