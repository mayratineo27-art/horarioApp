import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env || {};
const canonicalAppUrl = (env.VITE_APP_URL || '').trim();

// In production, recover automatically if an external OAuth flow returns to localhost.
if (import.meta.env.PROD && canonicalAppUrl && typeof window !== 'undefined') {
  try {
    const canonical = new URL(canonicalAppUrl);
    const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalHost && canonical.hostname !== window.location.hostname) {
      const pathWithQueryAndHash = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      window.location.replace(`${canonical.origin}${pathWithQueryAndHash}`);
    }
  } catch (error) {
    console.warn('Invalid VITE_APP_URL value. Skipping canonical redirect.', error);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
