import { useEffect, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { getSupabase } from '@/services/supabase';
import { RPC } from '@/config/database';

// ============================================================
// Admin Panel — Secret URL: /ctrl-room-7x9k
// Not linked anywhere in public UI.
//
// Gating strategy (defense in depth):
// 1. Client-side email allow-list (VITE_ADMIN_EMAILS). Cheap first gate; prevents
//    the admin bundle from rendering in the common case.
// 2. Server-side `is_admin()` RPC. Authoritative gate — runs in Postgres against
//    auth.uid(). A tampered client cannot bypass this. Must return true before
//    AdminLayout mounts.
// Both must pass. RLS on admin-sensitive tables also calls is_admin(), so
// even if both gates were skipped, admin-only reads/writes would fail.
// ============================================================

const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '')
  .split(',')
  .map((e: string) => e.trim().toLowerCase());

type AdminCheck = 'pending' | 'allowed' | 'denied';

const NotFound = () => (
  <div className="max-w-2xl mx-auto px-4 py-20 text-center">
    <div className="text-6xl mb-4">404</div>
    <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-2">Page Not Found</h2>
    <p className="text-slate-500 dark:text-slate-400">The page you're looking for doesn't exist.</p>
  </div>
);

const AdminPage = () => {
  const { user } = useApp();
  const [serverCheck, setServerCheck] = useState<AdminCheck>('pending');

  const clientAllowed = !!user && ADMIN_EMAILS.includes(user.email?.toLowerCase() || '');

  useEffect(() => {
    let cancelled = false;
    if (!clientAllowed || !user) {
      setServerCheck('denied');
      return;
    }
    (async () => {
      try {
        const { data, error } = await getSupabase().rpc(RPC.IS_ADMIN);
        if (cancelled) return;
        setServerCheck(!error && data === true ? 'allowed' : 'denied');
      } catch {
        if (!cancelled) setServerCheck('denied');
      }
    })();
    return () => { cancelled = true; };
  }, [clientAllowed, user]);

  const devAdmin = import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get('dev_admin') === 'true';
  if (devAdmin) return <AdminLayout adminEmail="dev@trackspendz.local" adminId="dev-user-001" />;
  if (!clientAllowed || serverCheck === 'denied') return <NotFound />;
  if (serverCheck === 'pending' || !user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center text-slate-500">
        Loading…
      </div>
    );
  }

  return <AdminLayout adminEmail={user.email || ''} adminId={user.id} />;
};

export default AdminPage;
