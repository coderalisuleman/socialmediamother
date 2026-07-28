import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/media-buffer-sw.js', {
    scope: '/',
    type: 'module',
    updateViaCache: 'none',
  }).catch(() => {
    // Playback still uses the browser's native in-memory buffer when service
    // workers or persistent storage are unavailable.
  });
}

const startApp = () => {
  const root = document.getElementById('root');
  if (!root || root.dataset.started === 'true') return;
  root.dataset.started = 'true';
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startApp, { once: true });
else startApp();
