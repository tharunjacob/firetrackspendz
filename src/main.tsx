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

// Self-heal: Completely unregister service workers and clear cache storage
// Since TrackSpendZ requires an active network connection (Supabase, Gemini API),
// the offline service worker was causing stale client bundles and infinite loading spinner bugs on redeployments.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister().then((success) => {
        if (success) {
          console.log('[SW] Successfully unregistered service worker');
          // Reload to instantly clear the SW controller gate
          window.location.reload();
        }
      });
    }
  }).catch(err => console.warn('[SW] Failed to get registrations:', err));
}

if (window.caches) {
  caches.keys().then((keys) => {
    keys.forEach((key) => {
      caches.delete(key).catch(() => {});
    });
  }).catch(err => console.warn('[Cache] Failed to clear caches:', err));
}
