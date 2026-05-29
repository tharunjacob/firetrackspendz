import { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Icon } from '@/components/common/Icons';
import { AssetEntryForm } from '@/components/assets/AssetEntryForm';
import { AssetDashboard } from '@/components/assets/AssetDashboard';
import { AssetDataTable } from '@/components/assets/AssetDataTable';
import { AssetCSVImport } from '@/components/assets/AssetCSVImport';
import { AssetFireBridge } from '@/components/assets/AssetFireBridge';
import {
  getConfig, saveConfig, loadSnapshots, saveSnapshots,
  deleteSnapshots, deleteSnapshotsByDate,
} from '@/services/assetStorage';
import type { AssetSnapshot, NetAssetConfig } from '@/types/assets';

type Tab = 'dashboard' | 'entry' | 'data' | 'import' | 'fire';

const NetAssetPage = () => {
  const { userId, plan, currency, showToast } = useApp();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [config, setConfig] = useState<NetAssetConfig>(getConfig);
  const [snapshots, setSnapshots] = useState<AssetSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  // Plan gating: free = 1 owner, pro = 4, enterprise = unlimited
  const maxOwners = plan === 'enterprise' ? 99 : plan === 'pro' ? 4 : 1;
  const isMultiOwnerAllowed = plan !== 'free';

  useEffect(() => {
    const load = async () => {
      try {
        const data = await loadSnapshots(userId || undefined);
        setSnapshots(data);
      } catch (e) {
        console.error('Failed to load assets:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  const handleConfigChange = useCallback((newConfig: NetAssetConfig) => {
    // Enforce owner limit
    if (newConfig.owners.length > maxOwners) {
      showToast(`Free plan supports ${maxOwners} owner${maxOwners === 1 ? '' : 's'}. Upgrade to Pro for up to 4.`, 'error');
      return;
    }
    setConfig(newConfig);
    saveConfig(newConfig);
  }, [maxOwners, showToast]);

  const handleSave = useCallback(async (newSnapshots: AssetSnapshot[]) => {
    const withUser = newSnapshots.map(s => ({ ...s, user_id: userId || 'local' }));
    await saveSnapshots(withUser, userId || undefined);
    setSnapshots(prev => {
      // Replace existing entries for same date+owner+category
      const ids = new Set(withUser.map(s => s.id));
      return [...prev.filter(p => !ids.has(p.id)), ...withUser];
    });
    showToast(`Saved ${newSnapshots.length} entries`);
    setTab('dashboard');
  }, [userId, showToast]);

  const handleDelete = useCallback(async (ids: string[]) => {
    await deleteSnapshots(ids, userId || undefined);
    setSnapshots(prev => prev.filter(s => !ids.includes(s.id)));
    showToast(`Deleted ${ids.length} entries`);
  }, [userId, showToast]);

  const handleDeleteMonth = useCallback(async (date: string) => {
    await deleteSnapshotsByDate(date, userId || undefined);
    setSnapshots(prev => prev.filter(s => s.date !== date));
    showToast('Month deleted');
  }, [userId, showToast]);

  const existingDates = useMemo(() => [...new Set(snapshots.map(s => s.date))], [snapshots]);

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: 'chart' },
    { key: 'entry', label: 'Add Snapshot', icon: 'plus' },
    { key: 'data', label: 'All Data', icon: 'search' },
    { key: 'import', label: 'Import CSV', icon: 'upload' },
    { key: 'fire', label: 'FIRE Link', icon: 'fire' },
  ];

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500">Loading your assets...</p>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 safe-bottom">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Net Asset Tracker</h1>
          <p className="text-sm text-slate-500">Track your household wealth, month by month</p>
        </div>
        {!isMultiOwnerAllowed && config.owners.length >= 1 && (
          <span className="text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-3 py-1.5 rounded-lg">
            Free plan: 1 member. Upgrade for household tracking.
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.key ? 'bg-brand-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600'
            }`}>
            <Icon name={t.icon as any} className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'dashboard' && (
        <AssetDashboard snapshots={snapshots} config={config} currency={currency} />
      )}
      {tab === 'entry' && (
        <AssetEntryForm config={config} onSave={handleSave} onConfigChange={handleConfigChange}
          existingDates={existingDates} currency={currency} />
      )}
      {tab === 'data' && (
        <AssetDataTable snapshots={snapshots} currency={currency} onDelete={handleDelete} onDeleteMonth={handleDeleteMonth} />
      )}
      {tab === 'import' && (
        <AssetCSVImport config={config} currency={currency} onImport={handleSave} />
      )}
      {tab === 'fire' && (
        <AssetFireBridge snapshots={snapshots} config={config} currency={currency} />
      )}
    </main>
  );
};

export default NetAssetPage;
