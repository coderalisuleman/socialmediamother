export function BrandMark({ small = false }) {
  return (
    <svg className={small ? 'brand-mark small' : 'brand-mark'} viewBox="0 0 64 64" role="img" aria-label="Mother">
      <rect x="2" y="2" width="60" height="60" rx="20" fill="currentColor" />
      <path d="M13 35c0-11 7-18 17-18 6 0 10 3 12 7 2-4 5-6 9-6v27c0 4-3 7-7 7H28c-9 0-15-7-15-17Z" fill="var(--ivory)" />
      <path d="M21 29c0-4 3-7 7-7 3 0 6 2 8 6 2-4 5-6 8-6 4 0 7 3 7 7 0 7-9 13-15 17-6-4-15-10-15-17Z" fill="var(--pink)" />
    </svg>
  );
}

export function HugIcon({ filled = false }) {
  return (
    <svg viewBox="0 0 56 48" aria-hidden="true" className={`reaction-art human-reaction ${filled ? 'is-filled' : ''}`}>
      <circle cx="20" cy="11" r="7" fill="#d89d76" />
      <circle cx="36" cy="11" r="7" fill="#b97957" />
      <path d="M10 44V30c0-8 4-13 11-13 3 0 5 1 7 3 2-2 4-3 7-3 7 0 11 5 11 13v14H10Z" fill="currentColor" />
      <path d="M8 25c7 1 10 6 14 12M48 25c-7 1-10 6-14 12" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M19 26c5 5 13 5 18 0" fill="none" stroke={filled ? '#fff' : 'var(--paper)'} strokeWidth="3" strokeLinecap="round" opacity=".9" />
      <circle cx="18" cy="10" r=".8" fill="#2b2423" /><circle cx="22" cy="10" r=".8" fill="#2b2423" />
      <circle cx="34" cy="10" r=".8" fill="#2b2423" /><circle cx="38" cy="10" r=".8" fill="#2b2423" />
      {filled && <path d="M28 18c-4-4-9 2 0 8 9-6 4-12 0-8Z" fill="#fff" />}
    </svg>
  );
}

export function ThrowIcon({ filled = false }) {
  return (
    <svg viewBox="0 0 62 48" aria-hidden="true" className={`reaction-art throw-art human-reaction ${filled ? 'is-filled' : ''}`}>
      <circle cx="16" cy="10" r="6.5" fill="#d89d76" />
      <path d="M7 44V29c0-8 3-13 10-13s9 6 10 13l2 15H7Z" fill="currentColor" />
      <path d="m22 22 16-7" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <circle cx="46" cy="11" r="5.7" fill="#b97957" />
      <path d="m40 18 11 5 7 12-5 3-8-10-8 13-5-3 9-15-4-3 3-2Z" fill="currentColor" />
      <path d="m35 8 5-4m-4 9 6-1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="14" cy="9" r=".8" fill="#2b2423" /><circle cx="18" cy="9" r=".8" fill="#2b2423" />
      <circle cx="44.5" cy="10" r=".7" fill="#2b2423" /><circle cx="47.5" cy="10" r=".7" fill="#2b2423" />
    </svg>
  );
}

export function OceanWave() {
  return (
    <span className="ocean-wave" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

export function PersonSilhouette({ gender = 'neutral' }) {
  return (
    <svg viewBox="0 0 80 80" aria-hidden="true" className={`person-silhouette ${gender}`}>
      <circle cx="40" cy="25" r="14" />
      <path d={gender === 'female' ? 'M19 70c2-20 9-32 21-32s19 12 21 32H19Z' : 'M17 70c1-19 9-30 23-30s22 11 23 30H17Z'} />
    </svg>
  );
}
