import { useEffect, useRef, useState } from 'react';
import { AlignLeft, ArrowDownToLine, ArrowLeft, CheckCircle2, Film, Image as ImageIcon, Link2, LoaderCircle, Plus, Smartphone, UploadCloud, Video } from 'lucide-react';
import { useObjectUrls } from '../lib/hooks';
import { optimizePhoto } from '../lib/media';
import Modal from './Modal';
import { MediaCarousel } from './Feed';

const choices = [
  { id: 'text', label: 'Text', detail: 'A thought, a note, a story', icon: AlignLeft },
  { id: 'photo', label: 'Photo', detail: 'One picture or a collection', icon: ImageIcon },
  { id: 'video', label: 'Video', detail: 'One film or a carousel', icon: Video },
  { id: 'short-video', label: 'Short video', detail: 'Vertical, quick and in motion', icon: Smartphone },
];

function DropField({ mode, files, setFiles }) {
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
}

export default function UploadModal({ open, onClose, onCreate, initialMode = null, onModeChange }) {
  const [mode, setMode] = useState(null);
  const [name, setName] = useState('');
  const [detail, setDetail] = useState('');
  const [link, setLink] = useState('');
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (open) setMode(initialMode || null);
  }, [initialMode, open]);

  const chooseMode = (nextMode) => {
    setMode(nextMode);
    setFiles([]);
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
    setError('');
  };

  const close = () => {
    if (submitting) return;
    reset();
    onClose();
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

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (mode === 'text' && !text.trim()) return setError('Write at least one line before posting.');
    if (mode !== 'text' && !name.trim()) return setError('Please give this post a name.');
    if (mode !== 'text' && !files.length) return setError(`Choose at least one ${mode === 'photo' ? 'photo' : 'video'}.`);
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
      });
      reset();
      onClose();
    } catch (submitError) {
      setError(submitError.message || 'This post could not be shared. Please try again.');
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
          <button type="button" className="back-link" onClick={() => chooseMode(null)} disabled={submitting}><ArrowLeft size={21} strokeWidth={2.6} /> Go back</button>

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
                <input value={name} onChange={(event) => setName(event.target.value)} required maxLength="120" placeholder="What should people call this?" />
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
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions">
            <button type="button" className="secondary-button" onClick={close} disabled={submitting}>Cancel</button>
            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting ? <><LoaderCircle className="spin" size={17} /> Posting…</> : <><Film size={17} /> Post it</>}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
