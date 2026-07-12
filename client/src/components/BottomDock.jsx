import { Plus, UserRound } from 'lucide-react';

function ChangeShirtIcon() {
  return (
    <svg className="change-shirt-icon" viewBox="0 0 34 30" aria-hidden="true">
      <circle cx="17" cy="5" r="3.5" />
      <path className="shirt-body" d="M9 12 4 16l3 5 3-2v8h14v-8l3 2 3-5-5-4-5-2c-1 2-5 2-6 0l-5 2Z" />
      <path className="shirt-swap" d="M3 8c2-4 5-6 9-6M7 3l5-1-2 5M31 23c-2 4-5 6-9 6m5-1-5 1 2-5" />
    </svg>
  );
}

export default function BottomDock({ onUpload, onChange, onMe }) {
  return (
    <nav className="bottom-dock" aria-label="Post and profile actions">
      <button type="button" onClick={onChange}><ChangeShirtIcon /><span>Change</span></button>
      <button type="button" className="dock-upload" onClick={onUpload}><Plus size={24} /><span>Upload</span></button>
      <button type="button" onClick={onMe}><UserRound size={19} /><span>Me</span></button>
    </nav>
  );
}
