/// <reference types="vite/client" />
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './ui/styles.css';
import './ui/mobile.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register the hand-rolled service worker for offline / installable PWA (Slice 7).
// Production only (D22): registering in `vite dev` caches Vite's transformed /src
// modules and serves stale code on reload. Use BASE_URL so the path is correct
// under any deploy sub-path.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* SW registration is best-effort; the app works without it. */
    });
  });
}
