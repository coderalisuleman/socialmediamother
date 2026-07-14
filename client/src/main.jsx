import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

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
