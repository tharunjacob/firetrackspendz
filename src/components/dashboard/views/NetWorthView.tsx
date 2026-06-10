import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { logEvent, EVENTS } from '@/services/logger';
import { useApp } from '@/contexts/AppContext';
import { formatAmount, formatCompact } from '@/utils/constants';
import { Icon } from '@/components/common/Icons';
import { canAccessFeature } from '@/config/plans';
import { UpgradePrompt } from '@/components/common/UpgradePrompt';
import { calculatePersonalInflation, calculateFireMetrics } from '@/services/analysis';
import { FIRE_MULTIPLIER } from './fire/shared';
import { loadSnapshots as loadMasterSnapshots } from '@/services/assetStorage';
import type { AssetSnapshot } from '@/types/assets';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

// ── Types ────────────────────────────────────────────────────

interface NWEntry {
  id: string;
  name: string;
  category: string;
  kind: 'asset' | 'liability';
  value: number;
}

interface NWSnapshot {
  date: string;          // YYYY-MM-01
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

// ── Constants ────────────────────────────────────────────────

const NW_ENTRIES_KEY = 'tsz_nw_entries';
const NW_SNAPSHOTS_KEY = 'tsz_nw_snapshots';

const ASSET_CATEGORIES = [
  'Cash / Savings', 'Fixed Deposit', 'Mutual Funds / ETFs',
  'Stocks', 'Gold', 'Real Estate', 'Crypto', 'Vehicle', 'EPF / PPF', 'Other Asset',
];
const LIABILITY_CATEGORIES = [
  'Home Loan', 'Car Loan', 'Personal Loan', 'Credit Card', 'Education Loan', 'Other Debt',
];

const ASSET_COLORS: Record<string, string> = {
  'Cash / Savings':       'bg-green-100  dark:bg-green-900/30  text-green-700  dark:text-green-400',
  'Fixed Deposit':        'bg-teal-100   dark:bg-teal-900/30   text-teal-700   dark:text-teal-400',
  'Mutual Funds / ETFs':  'bg-brand-100   dark:bg-brand-900/30   text-brand-700   dark:text-brand-400',
  'Stocks':               'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400',
  'Gold':                 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  'Real Estate':          'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  'Crypto':               'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400',
  'Vehicle':              'bg-slate-100  dark:bg-slate-700     text-slate-600  dark:text-slate-300',
  'EPF / PPF':            'bg-cyan-100   dark:bg-cyan-900/30   text-cyan-700   dark:text-cyan-400',
  'Other Asset':          'bg-slate-100  dark:bg-slate-700     text-slate-600  dark:text-slate-300',
};

// ── Helpers ──────────────────────────────────────────────────

const loadEntries = (): NWEntry[] => {
  try { return JSON.parse(localStorage.getItem(NW_ENTRIES_KEY) || '[]'); }
  catch { return []; }
};

const persistEntries = (entries: NWEntry[]) => {
  try {
    localStorage.setItem(NW_ENTRIES_KEY, JSON.stringify(entries));
  } catch (e) {
    console.warn('Failed to persist net worth entries:', e);
  }
};

const loadSnapshots = (): NWSnapshot[] => {
  try { return JSON.parse(localStorage.getItem(NW_SNAPSHOTS_KEY) || '[]'); }
  catch { return []; }
};

const persistSnapshots = (snaps: NWSnapshot[]) => {
  try {
    localStorage.setItem(NW_SNAPSHOTS_KEY, JSON.stringify(snaps));
  } catch (e) {
    console.warn('Failed to persist net worth snapshots:', e);
  }
};

const thisMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

const monthLabel = (dateStr: string) =>
  new Date(dateStr + 'T00:00:00').toLocaleString('default', { month: 'short', year: '2-digit' });

// ── Component ────────────────────────────────────────────────

export const NetWorthView = () => {
  useEffect(() => { logEvent(EVENTS.FEATURE_NET_WORTH_OPENED); }, []);
  const { transactions, currency, plan, userId } = useApp();

  const [localEntries, setLocalEntries] = useState<NWEntry[]>(() => loadEntries());
  const [localSnapshots, setLocalSnapshots] = useState<NWSnapshot[]>(() => loadSnapshots());
  const [masterSnapshots, setMasterSnapshots] = useState<AssetSnapshot[]>([]);

  // form state
  const [showForm, setShowForm] = useState<'asset' | 'liability' | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', category: '', value: '' });

  useEffect(() => {
    loadMasterSnapshots(userId || undefined)
      .then(snaps => {
        setMasterSnapshots(snaps);
      })
      .catch(e => {
        console.warn('[NetWorthView] Failed to load master snapshots:', e);
      });
  }, [userId]);

  const hasMasterData = masterSnapshots.length > 0;

  useEffect(() => {
    if (!hasMasterData) {
      persistEntries(localEntries);
    }
  }, [localEntries, hasMasterData]);

  // Derived master entries & snapshots
  const derivedEntries = useMemo(() => {
    if (!hasMasterData) return [];
    const latestDate = [...new Set(masterSnapshots.map(s => s.date))].sort().pop();
    if (!latestDate) return [];
    return masterSnapshots.filter(s => s.date === latestDate).map(s => ({
      id: s.id,
      name: `${s.owner} — ${s.category}`,
      category: s.category,
      kind: (s.current_value >= 0 ? 'asset' : 'liability') as 'asset' | 'liability',
      value: Math.abs(s.current_value),
    }));
  }, [masterSnapshots, hasMasterData]);

  const derivedSnapshots = useMemo(() => {
    if (!hasMasterData) return [];
    const grouped = new Map<string, { totalAssets: number; totalLiabilities: number }>();
    masterSnapshots.forEach(s => {
      const date = s.date.substring(0, 7) + '-01';
      const current = grouped.get(date) || { totalAssets: 0, totalLiabilities: 0 };
      if (s.current_value >= 0) {
        current.totalAssets += s.current_value;
      } else {
        current.totalLiabilities += Math.abs(s.current_value);
      }
      grouped.set(date, current);
    });
    return Array.from(grouped.entries()).map(([date, v]) => ({
      date,
      totalAssets: v.totalAssets,
      totalLiabilities: v.totalLiabilities,
      netWorth: v.totalAssets - v.totalLiabilities,
    })).sort((a, b) => a.date.localeCompare(b.date));
  }, [masterSnapshots, hasMasterData]);

  const entries = hasMasterData ? derivedEntries : localEntries;
  const snapshots = hasMasterData ? derivedSnapshots : localSnapshots;
  const setEntries = setLocalEntries;

  // ── Derived ──────────────────────────────────────────────────

  const totalAssets = useMemo(
    () => entries.filter(e => e.kind === 'asset').reduce((s, e) => s + e.value, 0),
    [entries],
  );
  const totalLiabilities = useMemo(
    () => entries.filter(e => e.kind === 'liability').reduce((s, e) => s + e.value, 0),
    [entries],
  );
  const netWorth = totalAssets - totalLiabilities;

  const personalInflation = useMemo(
    () => calculatePersonalInflation(transactions),
    [transactions],
  );

  const multiplier = FIRE_MULTIPLIER[currency] || 25;
  const fireNumber = useMemo(
    () => calculateFireMetrics(transactions, multiplier).fireNumberCurrent,
    [transactions, multiplier],
  );

  const fireProgress = fireNumber > 0 ? Math.max(0, Math.min(netWorth / fireNumber, 1)) : 0;

  // Month-over-month delta vs previous snapshot
  const prevSnap = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;
  const momDelta = prevSnap != null ? netWorth - prevSnap.netWorth : null;
  const momPct   = prevSnap != null && prevSnap.netWorth !== 0
    ? (netWorth - prevSnap.netWorth) / Math.abs(prevSnap.netWorth)
    : null;

  // Inflation context: real purchasing power relative to first snapshot
  const inflationContext = useMemo(() => {
    if (snapshots.length < 2) return null;
    const firstDate = new Date(snapshots[0].date + 'T00:00:00');
    const now = new Date();
    const yearsElapsed = (now.getTime() - firstDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    const realValue = netWorth / Math.pow(1 + personalInflation, yearsElapsed);
    const breakEvenNW = snapshots[0].netWorth * Math.pow(1 + personalInflation, yearsElapsed);
    return {
      realValue,
      yearsElapsed,
      firstYear: firstDate.getFullYear(),
      isBeatingInflation: netWorth >= breakEvenNW,
    };
  }, [snapshots, netWorth, personalInflation]);

  // Chart: nominal net worth + inflation baseline from first snapshot
  const chartData = useMemo(() => {
    if (snapshots.length < 2) return [];
    const baseNW = snapshots[0].netWorth;
    const baseDate = new Date(snapshots[0].date + 'T00:00:00');
    return snapshots.map(s => {
      const thisDate = new Date(s.date + 'T00:00:00');
      const years = (thisDate.getTime() - baseDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      return {
        month: monthLabel(s.date),
        netWorth: s.netWorth,
        inflationBaseline: Math.round(baseNW * Math.pow(1 + personalInflation, years)),
      };
    });
  }, [snapshots, personalInflation]);

  // ── Actions ──────────────────────────────────────────────────

  const openAdd = (kind: 'asset' | 'liability') => {
    setEditId(null);
    setDraft({ name: '', category: kind === 'asset' ? ASSET_CATEGORIES[0] : LIABILITY_CATEGORIES[0], value: '' });
    setShowForm(kind);
  };

  const openEdit = (e: NWEntry) => {
    setEditId(e.id);
    setDraft({ name: e.name, category: e.category, value: String(e.value) });
    setShowForm(e.kind);
  };

  const closeForm = () => {
    setShowForm(null);
    setEditId(null);
    setDraft({ name: '', category: '', value: '' });
  };

  const submitForm = () => {
    if (!draft.name.trim() || !draft.value || !showForm) return;
    const val = parseFloat(draft.value);
    if (isNaN(val) || val < 0) return;
    const entry: NWEntry = {
      id: editId ?? Date.now().toString(),
      name: draft.name.trim(),
      category: draft.category || (showForm === 'asset' ? ASSET_CATEGORIES[0] : LIABILITY_CATEGORIES[0]),
      kind: showForm,
      value: val,
    };
    setEntries(prev =>
      editId ? prev.map(e => e.id === editId ? entry : e) : [...prev, entry],
    );
    closeForm();
  };

  const removeEntry = (id: string) => setEntries(prev => prev.filter(e => e.id !== id));

  const saveSnapshot = () => {
    const key = thisMonthKey();
    const snap: NWSnapshot = { date: key, totalAssets, totalLiabilities, netWorth };
    setLocalSnapshots((prev: NWSnapshot[]) => {
      const updated = [...prev.filter((s: NWSnapshot) => s.date !== key), snap]
        .sort((a, b) => a.date.localeCompare(b.date));
      persistSnapshots(updated);
      return updated;
    });
  };

  const thisMonthSaved = snapshots.some(s => s.date === thisMonthKey());

  // ── Gate ─────────────────────────────────────────────────────

  if (!canAccessFeature(plan, 'net_worth')) {
    return <UpgradePrompt feature="Net Worth Tracker" description="Track assets, liabilities, and real purchasing power over time" />;
  }

  // ── Render ──────────────────────────────────────────────────

  const assetEntries     = entries.filter(e => e.kind === 'asset');
  const liabilityEntries = entries.filter(e => e.kind === 'liability');
  const isPositive       = netWorth >= 0;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Net Worth</h2>
        <Link to={ROUTES.ASSETS} className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium">
          Full Asset Tracker →
        </Link>
      </div>

      {/* ── Summary card ── */}
      <div className={`card p-6 bg-gradient-to-br ${isPositive ? 'from-brand-600 to-brand-700' : 'from-red-600 to-red-800'} text-white`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-white/70 uppercase tracking-widest font-semibold">Net Worth</p>
            <p className="text-4xl font-bold mt-1 tabular-nums">{formatAmount(netWorth, currency)}</p>
            <p className="text-sm text-white/50 mt-0.5">Assets − Liabilities</p>
          </div>
          {momDelta !== null && (
            <div className="text-right bg-white/15 rounded-lg px-3 py-2 flex-shrink-0">
              <p className="text-white/60 text-xs mb-0.5">vs last month</p>
              <p className="font-bold text-sm">
                {momDelta >= 0 ? '+' : ''}{formatCompact(momDelta, currency)}
              </p>
              {momPct !== null && (
                <p className="text-xs text-white/70">
                  {momDelta >= 0 ? '+' : ''}{(momPct * 100).toFixed(1)}%
                </p>
              )}
            </div>
          )}
        </div>

        {/* Sub-stats */}
        <div className="flex flex-wrap gap-x-8 gap-y-2 mt-5 pt-4 border-t border-white/20">
          <div>
            <p className="text-xs text-white/60">Total Assets</p>
            <p className="text-base font-bold">{formatCompact(totalAssets, currency)}</p>
          </div>
          <div>
            <p className="text-xs text-white/60">Total Liabilities</p>
            <p className="text-base font-bold">{formatCompact(totalLiabilities, currency)}</p>
          </div>
          {fireNumber > 0 && (
            <div className="flex-1 min-w-[100px]">
              <p className="text-xs text-white/60">FIRE Progress</p>
              <p className="text-base font-bold">{(fireProgress * 100).toFixed(1)}%</p>
            </div>
          )}
        </div>

        {/* FIRE progress bar */}
        {fireNumber > 0 && (
          <div className="mt-3">
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-2 bg-white rounded-full transition-all duration-700"
                style={{ width: `${Math.min(fireProgress * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-white/50 mt-1.5">
              FIRE target: {formatCompact(fireNumber, currency)}
              {netWorth < fireNumber && ` · ${formatCompact(fireNumber - netWorth, currency)} to go`}
            </p>
          </div>
        )}
      </div>

      {/* ── Inflation context ── */}
      {transactions.length > 0 && (
        <div className="card p-4 border border-amber-200 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-900/10">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-800/40 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Icon name="fire" className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Your spending inflation: {(personalInflation * 100).toFixed(1)}% / yr
              </p>
              {inflationContext ? (
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
                  In {inflationContext.firstYear} money your net worth is worth{' '}
                  <span className="font-semibold">{formatAmount(inflationContext.realValue, currency)}</span>.{' '}
                  {inflationContext.isBeatingInflation
                    ? <span className="text-green-700 dark:text-green-400 font-medium">Growing faster than inflation. ✓</span>
                    : <span className="text-red-700 dark:text-red-400 font-medium">Not keeping up with your cost of living.</span>
                  }
                </p>
              ) : (
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  Save 2 monthly snapshots to see how your real purchasing power tracks over time.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Master Assets Connection Banner ── */}
      {hasMasterData && (
        <div className="card p-4 border border-brand-200 dark:border-brand-800 bg-brand-50/50 dark:bg-brand-900/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Icon name="chart" className="w-5 h-5 text-brand-600 dark:text-brand-400 shrink-0" />
            <div>
              <p className="text-sm text-slate-850 dark:text-slate-200 font-semibold">
                Connected to Net Asset Tracker
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Automatically displaying wealth snapshots from your master tracker.
              </p>
            </div>
          </div>
          <Link to={ROUTES.ASSETS} className="btn-primary text-xs px-3 py-1.5 whitespace-nowrap shrink-0">
            Manage Asset Records
          </Link>
        </div>
      )}

      {/* ── Historical chart ── */}
      {chartData.length >= 2 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Net Worth Over Time</h3>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 bg-brand-500 inline-block rounded" />
                Actual
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 bg-amber-400 inline-block rounded" />
                Inflation baseline
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.6} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                tickFormatter={v => formatCompact(v, currency)}
                tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={62}
              />
              <Tooltip
                formatter={(v: number, name: string) => [
                  formatAmount(v, currency),
                  name === 'netWorth' ? 'Net Worth' : 'Inflation Baseline',
                ]}
              />
              <Area
                type="monotone" dataKey="netWorth"
                stroke="#2563eb" fill="url(#nwGrad)" strokeWidth={2.5}
                dot={{ fill: '#2563eb', r: 3 }} activeDot={{ r: 5 }}
              />
              <Area
                type="monotone" dataKey="inflationBaseline"
                stroke="#f59e0b" fill="none" strokeWidth={1.5}
                strokeDasharray="5 4" dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Entry form ── */}
      {showForm && (
        <div className="card p-5 border-2 border-brand-200 dark:border-brand-800 animate-slide-up">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">
            {editId ? 'Edit' : 'Add'} {showForm === 'asset' ? 'Asset' : 'Liability'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder={showForm === 'asset' ? 'e.g. HDFC Savings' : 'e.g. SBI Home Loan'}
              value={draft.name}
              onChange={e => setDraft(p => ({ ...p, name: e.target.value }))}
              className="input-field"
              autoFocus
            />
            <select
              value={draft.category}
              onChange={e => setDraft(p => ({ ...p, category: e.target.value }))}
              className="input-field"
            >
              {(showForm === 'asset' ? ASSET_CATEGORIES : LIABILITY_CATEGORIES).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Current value"
                value={draft.value}
                onChange={e => setDraft(p => ({ ...p, value: e.target.value }))}
                className="input-field flex-1"
                min="0"
                onKeyDown={e => { if (e.key === 'Enter') submitForm(); }}
              />
              <button onClick={submitForm} className="btn-primary px-4">
                {editId ? 'Save' : 'Add'}
              </button>
              <button onClick={closeForm} className="btn-secondary px-3">✕</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Assets & Liabilities columns ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Assets */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Assets</h3>
              <p className="text-xs text-slate-500 mt-0.5">{formatAmount(totalAssets, currency)} total</p>
            </div>
            {!hasMasterData && (
              <button onClick={() => openAdd('asset')} className="btn-primary text-xs px-3 py-1.5">
                <Icon name="plus" className="w-3 h-3 inline mr-1" />Add
              </button>
            )}
          </div>

          {assetEntries.length === 0 ? (
            <div className="py-6 text-center">
              <Icon name="wallet" className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500 dark:text-slate-500">
                Add savings, FDs, stocks, property, gold…
              </p>
            </div>
          ) : (
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {assetEntries.map(e => (
                <div key={e.id} className="flex items-center justify-between py-2.5 border-b border-slate-100 dark:border-slate-700/60 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{e.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ASSET_COLORS[e.category] ?? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                      {e.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                      {formatAmount(e.value, currency)}
                    </p>
                    {!hasMasterData && (
                      <>
                        <button onClick={() => openEdit(e)} className="text-slate-300 hover:text-brand-500 transition-colors" title="Edit">
                          <Icon name="pencil" className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => removeEntry(e.id)} className="text-slate-300 hover:text-red-500 transition-colors" title="Delete">
                          <Icon name="trash" className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Liabilities */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Liabilities</h3>
              <p className="text-xs text-slate-500 mt-0.5">{formatAmount(totalLiabilities, currency)} total</p>
            </div>
            {!hasMasterData && (
              <button
                onClick={() => openAdd('liability')}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Icon name="plus" className="w-3 h-3 inline mr-1" />Add
              </button>
            )}
          </div>

          {liabilityEntries.length === 0 ? (
            <div className="py-6 text-center">
              <Icon name="flag" className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500 dark:text-slate-500">
                Add home loans, car loans, credit card balances…
              </p>
            </div>
          ) : (
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {liabilityEntries.map(e => (
                <div key={e.id} className="flex items-center justify-between py-2.5 border-b border-slate-100 dark:border-slate-700/60 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{e.name}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                      {e.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <p className="text-sm font-bold text-red-600 dark:text-red-400 tabular-nums">
                      −{formatAmount(e.value, currency)}
                    </p>
                    {!hasMasterData && (
                      <>
                        <button onClick={() => openEdit(e)} className="text-slate-300 hover:text-brand-500 transition-colors" title="Edit">
                          <Icon name="pencil" className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => removeEntry(e.id)} className="text-slate-300 hover:text-red-500 transition-colors" title="Delete">
                          <Icon name="trash" className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Monthly snapshot ── */}
      {!hasMasterData && (
        <div className="card p-4 flex items-center justify-between gap-4 bg-slate-50 dark:bg-slate-800/50">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {thisMonthSaved ? '✓ Snapshot saved for this month' : "Record this month's net worth"}
            </p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {thisMonthSaved
                ? `${formatAmount(snapshots.find(s => s.date === thisMonthKey())?.netWorth ?? 0, currency)} recorded · ${snapshots.length} snapshot${snapshots.length !== 1 ? 's' : ''} total`
                : 'Save monthly snapshots to track growth and see the inflation trend chart.'}
            </p>
          </div>
          <button
            onClick={saveSnapshot}
            className={`text-sm px-4 py-2 rounded-lg font-semibold flex-shrink-0 transition-colors ${
              thisMonthSaved
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                : 'btn-primary'
            }`}
          >
            {thisMonthSaved ? 'Update' : 'Save Snapshot'}
          </button>
        </div>
      )}

      {/* ── Link to full tracker ── */}
      <div className="rounded-2xl p-4 bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Need deeper tracking?</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Upload Excel files, track per category and date, analyze returns, compare across family members.
          </p>
        </div>
        <Link to={ROUTES.ASSETS} className="btn-primary text-sm px-4 py-2 whitespace-nowrap flex-shrink-0">
          Full Tracker →
        </Link>
      </div>

    </div>
  );
};
