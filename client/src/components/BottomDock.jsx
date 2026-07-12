import { Camera, Plus, UserRound } from 'lucide-react';

export default function BottomDock({ onUpload, onChange, onMe }) {
  return (
    <nav className="bottom-dock" aria-label="Post and profile actions">
      <button type="button" onClick={onChange}><Camera size={19} /><span>Change</span></button>
      <button type="button" className="dock-upload" onClick={onUpload}><Plus size={24} /><span>Upload</span></button>
      <button type="button" onClick={onMe}><UserRound size={19} /><span>Me</span></button>
    </nav>
  );
}

