import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, LoaderCircle, Trash2, UserMinus, UserPlus, UsersRound, X } from 'lucide-react';
import { api, normalizeUserShape } from '../lib/api';
import Modal from './Modal';
import { Avatar } from './Feed';

function exactCount(value) {
  return Number(value || 0).toLocaleString('en-US').replaceAll(',', '');
}

export default function ProfileModal({ open, onClose, person, isOwn, startEditing = false, onAvatar, onDeleteAvatar, onFollow, onEditingChange }) {
  const [editing, setEditing] = useState(startEditing);
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [relationshipView, setRelationshipView] = useState(null);
  const [relationshipPeople, setRelationshipPeople] = useState([]);
  const [relationshipLoading, setRelationshipLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setEditing(startEditing);
      setRelationshipView(null);
      setRelationshipPeople([]);
    }
  }, [open, startEditing]);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!person) return null;
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
      onEditingChange?.(false);
    } catch (removeError) {
      setError(removeError.message || 'That photo could not be removed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isOwn ? 'Me' : person.name} eyebrow={isOwn ? 'Your place in Mother' : `@${person.username}`} wide className="profile-modal">
      <div className="profile-sky">
        <div className="profile-orbit orbit-one" /><div className="profile-orbit orbit-two" />
        <div className="profile-wings">
          <button type="button" className="wing wing-left" onClick={() => showRelationships('followers')} aria-label={`${exactCount(person.followers)} people want to be with ${isOwn ? 'you' : person.name}`}>
            <span><strong>{exactCount(person.followers)}</strong><small>The people who want<br />to be with {isOwn ? 'me' : 'them'}</small></span>
          </button>
          <div className="profile-center">
            <Avatar person={shownPerson} size="hero" />
            <h3>{person.name}</h3>
            <p>@{person.username}</p>
          </div>
          <button type="button" className="wing wing-right" onClick={() => showRelationships('following')} aria-label={`${exactCount(person.following)} people ${isOwn ? 'you want' : `${person.name} wants`} to be with`}>
            <span><strong>{exactCount(person.following)}</strong><small>The people {isOwn ? 'I' : 'they'} want<br />to be with</small></span>
          </button>
        </div>
        {person.bio && <p className="profile-bio">{person.bio}</p>}
        {isOwn ? (
          <button type="button" className="secondary-button profile-change" onClick={() => {
            const next = !editing;
            setEditing(next);
            onEditingChange?.(next);
          }}><Camera size={16} /> Change profile photo</button>
        ) : (
          <button type="button" className={`primary-button profile-follow ${person.isFollowing ? 'following' : ''}`} onClick={() => onFollow(person)}>
            {person.isFollowing ? <><UserMinus size={16} /> Stop being with</> : <><UserPlus size={16} /> Be with them</>}
          </button>
        )}
      </div>

      {relationshipView && (
        <section className="relationship-list" aria-live="polite">
          <header>
            <div><UsersRound size={18} /><strong>{relationshipView === 'followers' ? 'The people who want to be with me' : 'The people I want to be with'}</strong></div>
            <button type="button" onClick={() => setRelationshipView(null)} aria-label="Close people list"><X size={17} /></button>
          </header>
          {relationshipLoading ? <p><LoaderCircle className="spin" size={18} /> Gathering people…</p> : relationshipPeople.length ? (
            <div>
              {relationshipPeople.map((item) => (
                <article key={item.id || item.username}>
                  <Avatar person={item} />
                  <span><strong>{item.name}</strong><small>@{item.username}</small></span>
                </article>
              ))}
            </div>
          ) : <p>No people are in this wing yet.</p>}
        </section>
      )}

      {isOwn && editing && (
        <div className="avatar-editor">
          <div
            className="avatar-drop"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const next = [...event.dataTransfer.files].find((item) => item.type.startsWith('image/'));
              if (next) setFile(next);
            }}
          >
            <ImagePlus size={24} />
            <div><strong>Drop a photo here</strong><small>or choose one from your device</small></div>
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
    </Modal>
  );
}
