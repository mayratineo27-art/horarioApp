import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Prevent any redirect to localhost from production environments (Vercel)
if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  const originalDescriptor = Object.getOwnPropertyDescriptor(window.location, 'href');
  const originalReplace = window.history.replaceState;
  const originalPushState = window.history.pushState;
  
  // Intercept location.href assignment
  Object.defineProperty(window.location, 'href', {
    set(url: string) {
      if (url && typeof url === 'string' && url.includes('localhost')) {
        console.warn('[Security] Blocked redirect to localhost from production:', url);
        return; // Don't actually change location
      }
      if (originalDescriptor?.set) {
        originalDescriptor.set.call(window.location, url);
      } else {
        window.location.replace(url);
      }
    },
    get() {
      if (originalDescriptor?.get) {
        return originalDescriptor.get.call(window.location);
      }
      return '';
    },
  });
  
  window.history.replaceState = function(state: any, title: string, url?: string | null) {
    if (url && typeof url === 'string' && url.includes('localhost')) {
      console.warn('[Security] Blocked redirect to localhost from production:', url);
      return;
    }
    return originalReplace.call(window.history, state, title, url);
  };
  
  window.history.pushState = function(state: any, title: string, url?: string | null) {
    if (url && typeof url === 'string' && url.includes('localhost')) {
      console.warn('[Security] Blocked redirect to localhost from production:', url);
      return;
    }
    return originalPushState.call(window.history, state, title, url);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
