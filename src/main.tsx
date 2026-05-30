import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from '@/contexts/AppProvider';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import App from '@/App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AppProvider>
          <App />
        </AppProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);

// Register Service Worker for offline support
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // Self-heal: purge old caches (v2, v3) that may have been left by previous SW versions
  if (window.caches) {
    caches.delete('trackspendz-v2').catch(() => {});
    caches.delete('trackspendz-v3').catch(() => {});
    caches.keys().then(keys => {
      keys.forEach(key => {
        caches.open(key).then(cache => {
          cache.delete('/sw.js').catch(() => {});
        });
      });
    });
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('SW registration failed:', err));
  });
}
