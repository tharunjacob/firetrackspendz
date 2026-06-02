import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Icon } from '@/components/common/Icons';
import { CURRENCIES } from '@/utils/constants';
import { exportToCSV, exportToJSON } from '@/services/exportService';
import { SubscriptionManager } from '@/components/settings/SubscriptionManager';
import { getOrCreateReferralCode, getReferralStats } from '@/services/referral';
import { getSupabase } from '@/services/supabase';
import { TABLES } from '@/config/database';
import type { Currency, ReferralStats } from '@/types';
import { usePageMeta } from '@/hooks/usePageMeta';

const SettingsPage = () => {
  const { userId, userEmail, profile, plan, transactions, currency, setCurrency, clearAllData, logout, showToast } = useApp();

  usePageMeta({ title: 'Settings | TrackSpendZ', description: 'Manage your TrackSpendZ account, subscription, data exports, and preferences.', canonical: '/settings', noIndex: true });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [loading, setLoading] = useState(false);

  // ── Referral state ──────────────────────────────────────────
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [referralCopied, setReferralCopied] = useState(false);

  useEffect(() => {
    if (userId) {
      getOrCreateReferralCode(userId).then(() =>
        getReferralStats(userId).then(setReferralStats)
      ).catch(() => {});
    }
  }, [userId]);

  const handleExportCSV = () => {
    if (transactions.length === 0) { showToast('No transactions to export', 'error'); return; }
    exportToCSV(transactions);
    showToast(`Exported ${transactions.length} transactions`);
  };

  const handleExportJSON = () => {
    if (transactions.length === 0) { showToast('No transactions to export', 'error'); return; }
    exportToJSON(transactions);
    showToast(`Exported ${transactions.length} transactions`);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    try {
      setLoading(true);
      // Clear all local data
      await clearAllData();
      // Delete cloud data
      if (userId) {
        await getSupabase().from(TABLES.TRANSACTIONS).delete().eq('user_id', userId);
        await getSupabase().from(TABLES.ASSET_SNAPSHOTS).delete().eq('user_id', userId);
        await getSupabase().from(TABLES.CATEGORY_RULES).delete().eq('user_id', userId);
        await getSupabase().from(TABLES.USER_PROFILES).delete().eq('id', userId);
      }
      await logout();
      showToast('Account deleted. All your data has been removed.');
    } catch (e: any) {
      showToast(e.message || 'Failed to delete account', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">Settings</h1>

      {/* Profile */}
      <section className="card p-5 mb-6">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4">Account</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-slate-500 dark:text-slate-400">Email</span>
            <span className="font-medium text-slate-700 dark:text-slate-200">{userEmail}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500 dark:text-slate-400">Name</span>
            <span className="font-medium text-slate-700 dark:text-slate-200">{profile?.full_name || '—'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500 dark:text-slate-400">Plan</span>
            <span className={`font-bold px-2 py-0.5 rounded text-xs ${
              plan === 'pro' ? 'bg-brand-100 text-brand-700' :
              plan === 'enterprise' ? 'bg-brand-100 text-brand-700' :
              'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              {plan.charAt(0).toUpperCase() + plan.slice(1)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500 dark:text-slate-400">Transactions</span>
            <span className="font-medium text-slate-700 dark:text-slate-200">{transactions.length.toLocaleString()}</span>
          </div>
        </div>
        <SubscriptionManager />
      </section>

      {/* Preferences */}
      <section className="card p-5 mb-6">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4">Preferences</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Default Currency</p>
            <p className="text-xs text-slate-500">Used across all views and exports</p>
          </div>
          <select value={currency} onChange={e => setCurrency(e.target.value as Currency)}
            className="input-field w-36 text-sm">
            {(Object.keys(CURRENCIES) as Currency[]).map(c => (
              <option key={c} value={c}>{CURRENCIES[c].symbol} {c} — {CURRENCIES[c].name}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Data Export */}
      <section className="card p-5 mb-6">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4">Export Your Data</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Download all your transaction data. Your data belongs to you — export it anytime.</p>
        <div className="flex gap-3">
          <button onClick={handleExportCSV} className="btn-secondary text-sm px-4 py-2 flex items-center gap-2">
            <Icon name="download" className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={handleExportJSON} className="btn-secondary text-sm px-4 py-2 flex items-center gap-2">
            <Icon name="download" className="w-4 h-4" /> Export JSON
          </button>
        </div>
      </section>

      {/* Referral Program */}
      {userId && (
        <section className="card p-5 mb-6 border border-brand-200 bg-brand-50/30">
          <h2 className="text-sm font-bold text-brand-700 uppercase tracking-wider mb-4">Refer Friends</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Share TrackSpendZ with friends. For every <strong>3 friends</strong> who sign up, you earn <strong>1 month of Pro free</strong>.
          </p>

          {referralStats ? (
            <>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-2.5 font-mono text-sm text-slate-700 dark:text-slate-200 select-all">
                  https://trackspendz.com/?ref={referralStats.code}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`https://trackspendz.com/?ref=${referralStats.code}`);
                    setReferralCopied(true);
                    setTimeout(() => setReferralCopied(false), 2000);
                    showToast('Referral link copied!');
                  }}
                  className="btn-primary text-sm px-4 py-2.5 whitespace-nowrap"
                >
                  {referralCopied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-white dark:bg-slate-700 rounded-lg p-3 border border-slate-100 dark:border-slate-600">
                  <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{referralStats.completed}</p>
                  <p className="text-xs text-slate-500">Completed</p>
                </div>
                <div className="bg-white dark:bg-slate-700 rounded-lg p-3 border border-slate-100 dark:border-slate-600">
                  <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{referralStats.pending}</p>
                  <p className="text-xs text-slate-500">Pending</p>
                </div>
                <div className="bg-white dark:bg-slate-700 rounded-lg p-3 border border-slate-100 dark:border-slate-600">
                  <p className="text-2xl font-bold text-brand-600">{referralStats.rewardsEarned}</p>
                  <p className="text-xs text-slate-500">Rewards Earned</p>
                </div>
              </div>

              {referralStats.completed > 0 && referralStats.completed < 3 && (
                <p className="text-xs text-slate-500 mt-3">
                  {3 - referralStats.completed} more referral{3 - referralStats.completed !== 1 ? 's' : ''} until your next Pro month reward!
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500">Loading referral info...</p>
          )}
        </section>
      )}

      {/* Clear Data */}
      <section className="card p-5 mb-6 border border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/10">
        <h2 className="text-sm font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-4">Clear All Data</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Remove all transactions from your dashboard. This does not delete your account.</p>
        <button onClick={() => { clearAllData(); showToast('All data cleared'); }} className="btn-secondary text-sm px-4 py-2 text-amber-700 border-amber-300 hover:bg-amber-100">
          Clear All Transactions
        </button>
      </section>

      {/* Danger Zone */}
      <section className="card p-5 border-2 border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-900/10">
        <h2 className="text-sm font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-4">Danger Zone</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Permanently delete your account and all associated data. This action cannot be undone.
          We'll delete your profile, transactions, asset snapshots, and learning rules.
        </p>
        {!showDeleteConfirm ? (
          <button onClick={() => setShowDeleteConfirm(true)} className="btn-danger text-sm px-4 py-2">
            Delete My Account
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-red-600">Type DELETE to confirm:</p>
            <div className="flex gap-2">
              <input value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE" className="input-field flex-1 text-sm border-red-300" />
              <button onClick={handleDeleteAccount} disabled={deleteConfirmText !== 'DELETE' || loading}
                className="btn-danger text-sm px-6 disabled:opacity-40">
                {loading ? 'Deleting...' : 'Confirm Delete'}
              </button>
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
                className="btn-secondary text-sm px-4">
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default SettingsPage;
