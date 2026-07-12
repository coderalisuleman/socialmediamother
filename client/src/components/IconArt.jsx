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
    <svg viewBox="0 0 48 48" aria-hidden="true" className="reaction-art">
      <circle cx="17" cy="12" r="6" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.6" />
      <circle cx="31" cy="12" r="6" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.6" />
      <path d="M11 39v-9c0-7 4-11 10-11h6c6 0 10 4 10 11v9" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M8 25c4 1 8 5 10 10M40 25c-4 1-8 5-10 10" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M19 29c2.5 2 7.5 2 10 0" fill="none" stroke={filled ? 'var(--ivory)' : 'currentColor'} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function ThrowIcon({ filled = false }) {
  return (
    <svg viewBox="0 0 54 48" aria-hidden="true" className="reaction-art throw-art">
      <circle cx="14" cy="12" r="5.5" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" />
      <path d="M8 39v-9c0-7 2-11 7-11 4 0 6 3 7 8l1 7" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M18 24l10-4" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="39" cy="13" r="5" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" />
      <path d="M33 22l9 4 5 10M42 26l-8 10M32 18l-5-2" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M26 10l4-3M28 14h5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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

