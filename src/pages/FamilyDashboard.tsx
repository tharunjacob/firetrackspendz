import { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Icon } from '@/components/common/Icons';
import { formatAmount } from '@/utils/constants';
import { getUserSetting, setUserSetting } from '@/services/userSettings';
import { STORAGE_KEYS } from '@/config/storage';
import { SummaryView } from '@/components/dashboard/views/SummaryView';
import type { FamilyMember, Transaction } from '@/types';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

// ============================================================
// Family Dashboard — Enterprise Feature
// Consolidated household view with per-member drill-down
// ============================================================

const FAMILY_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
];

const StatusBadge = ({ status }: { status: FamilyMember['status'] }) => {
  const config = {
    owner:   { label: 'Owner',   cls: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' },
    active:  { label: 'Active',  cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
    pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
    removed: { label: 'Removed', cls: 'bg-slate-100 text-slate-500' },
  };
  const { label, cls } = config[status];
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
};

const FamilyDashboard = () => {
  const { user, userId, plan, currency, showToast, transactions, isAuthReady } = useApp();

  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [activeView, setActiveView] = useState<'overview' | 'members' | 'shared-budgets'>('overview');
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [activeMemberTab, setActiveMemberTab] = useState<string>('all');

  const isEnterprise = plan === 'enterprise';

  useEffect(() => {
    if (!isAuthReady) return;
    let cancelled = false;
    getUserSetting<FamilyMember[]>(STORAGE_KEYS.FAMILY_MEMBERS, []).then(loaded => {
      if (cancelled) return;
      if (loaded.length === 0) {
        const ownerMember: FamilyMember = {
          id: userId || 'owner',
          name: user?.email?.split('@')[0] || 'You',
          email: user?.email || '',
          status: 'owner',
          addedAt: new Date().toISOString(),
          color: FAMILY_COLORS[0],
        };
        const initial = [ownerMember];
        setMembers(initial);
        setUserSetting(STORAGE_KEYS.FAMILY_MEMBERS, initial);
      } else {
        setMembers(loaded);
      }
      setHydrated(true);
    });
    return () => { cancelled = true; };
  }, [isAuthReady, userId, user?.email]);

  const saveMembers = useCallback((m: FamilyMember[]) => {
    setMembers(m);
    if (hydrated) setUserSetting(STORAGE_KEYS.FAMILY_MEMBERS, m);
  }, [hydrated]);

  const activeMembers = useMemo(
    () => members.filter(m => m.status !== 'removed'),
    [members],
  );

  const addMember = () => {
    if (!addName.trim()) return;
    if (activeMembers.length >= 5) {
      showToast('Maximum 5 family members allowed', 'error');
      return;
    }
    if (activeMembers.find(m => m.name.toLowerCase() === addName.trim().toLowerCase())) {
      showToast('A member with that name already exists', 'error');
      return;
    }
    const colorIdx = activeMembers.length % FAMILY_COLORS.length;
    const newMember: FamilyMember = {
      id: crypto.randomUUID?.() || Date.now().toString(),
      name: addName.trim(),
      email: addEmail.trim(),
      status: 'active',
      addedAt: new Date().toISOString(),
      color: FAMILY_COLORS[colorIdx],
    };
    saveMembers([...members, newMember]);
    setAddName('');
    setAddEmail('');
    showToast(`Added ${newMember.name}`);
  };

  const removeMember = (id: string) => {
    if (!confirm("Remove this family member? Their transactions remain but won't appear in family views.")) return;
    saveMembers(members.map(m => m.id === id ? { ...m, status: 'removed' as const } : m));
  };

  // ── Data computations ─────────────────────────────────────

  const last6Months = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      });
    }
    return months;
  }, []);

  const thisMonthTx = useMemo(() => {
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return transactions.filter(t => t.date.startsWith(key));
  }, [transactions]);

  const householdStats = useMemo(() => {
    const income = thisMonthTx.filter(t => t.type === 'Income').reduce((s, t) => s + t.amount, 0);
    const expense = thisMonthTx.filter(t => t.type === 'Expense').reduce((s, t) => s + t.amount, 0);
    const savingsRate = income > 0 ? (income - expense) / income : 0;
    return { income, expense, savings: income - expense, savingsRate };
  }, [thisMonthTx]);

  // Stacked bar: monthly expense per member (last 6 months)
  const stackedChartData = useMemo(() => {
    if (activeMembers.length < 2) return [];
    return last6Months.map(({ key, label }) => {
      const entry: Record<string, string | number> = { month: label };
      activeMembers.forEach(m => {
        entry[m.name] = transactions
          .filter(t => t.owner === m.name && t.type === 'Expense' && t.date.startsWith(key))
          .reduce((s, t) => s + t.amount, 0);
      });
      return entry;
    });
  }, [last6Months, activeMembers, transactions]);

  const hasAnyStackedData = useMemo(
    () => stackedChartData.some(row => activeMembers.some(m => (row[m.name] as number) > 0)),
    [stackedChartData, activeMembers],
  );

  // Category comparison: top-10 by total expense, per member
  const categoryComparison = useMemo(() => {
    const catMap: Record<string, Record<string, number>> = {};
    transactions.filter(t => t.type === 'Expense').forEach(t => {
      if (!catMap[t.category]) catMap[t.category] = {};
      catMap[t.category][t.owner] = (catMap[t.category][t.owner] || 0) + t.amount;
    });
    return Object.entries(catMap)
      .map(([category, byOwner]) => ({
        category,
        total: Object.values(byOwner).reduce((s, v) => s + v, 0),
        byOwner,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [transactions]);

  // Per-member filtered transactions for Section D tabs
  const memberTransactions = useMemo(() => {
    const map: Record<string, Transaction[]> = { all: transactions };
    activeMembers.forEach(m => {
      map[m.id] = transactions.filter(t => t.owner === m.name);
    });
    return map;
  }, [activeMembers, transactions]);

  // ── Non-enterprise gate ──────────────────────────────────

  if (!isEnterprise) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="text-6xl mb-4">👨‍👩‍👧‍👦</div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Family Dashboard</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6">
          See your entire household's finances in one place. Add up to 5 family members,
          track combined spending, and compare category breakdowns side-by-side.
        </p>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Family Dashboard is an Enterprise feature. Upgrade to Enterprise ($149/year) to unlock
            family accounts, shared views, and priority support.
          </p>
        </div>
        <a href="/pricing" className="btn-primary px-6 py-2.5 inline-block">View Plans</a>
      </div>
    );
  }

  // ── Main enterprise view ─────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Family Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {activeMembers.length} of 5 members · Household finances
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['overview', 'members', 'shared-budgets'] as const).map(v => (
            <button
              key={v}
              onClick={() => setActiveView(v)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                activeView === v
                  ? 'bg-brand-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              {v.replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* ── OVERVIEW ────────────────────────────────────────── */}
      {activeView === 'overview' && (
        <div className="space-y-8">

          {/* Section A — Household Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-4 bg-gradient-to-br from-brand-600 to-purple-600 text-white">
              <p className="text-xs text-brand-200 uppercase tracking-wide">Members</p>
              <p className="text-3xl font-black mt-1">
                {activeMembers.length}
                <span className="text-lg font-normal opacity-60"> / 5</span>
              </p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Monthly Income</p>
              <p className="text-xl font-bold text-green-600 mt-1">{formatAmount(householdStats.income, currency)}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Monthly Expense</p>
              <p className="text-xl font-bold text-red-500 mt-1">{formatAmount(householdStats.expense, currency)}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Savings Rate</p>
              <p className={`text-xl font-bold mt-1 ${householdStats.savingsRate >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {(householdStats.savingsRate * 100).toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Empty state */}
          {transactions.length === 0 && (
            <div className="card p-10 text-center">
              <Icon name="upload" className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="font-semibold text-slate-600 dark:text-slate-300">No transactions yet</p>
              <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
                Upload statements from the main dashboard. Use the "Uploading for" selector to tag each member's transactions.
              </p>
              <a href="/dashboard" className="inline-block mt-4 btn-primary text-sm px-5 py-2">Go to Dashboard</a>
            </div>
          )}

          {/* Section B — Per-Member Spending */}
          {activeMembers.length >= 2 && hasAnyStackedData && (
            <div className="card p-5">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-0.5">
                Monthly Spending by Member
              </h3>
              <p className="text-xs text-slate-400 mb-4">Last 6 months · Expenses only</p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stackedChartData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={60} />
                  <Tooltip
                    formatter={(v: number, name: string) => [formatAmount(v, currency), name]}
                  />
                  <Legend />
                  {activeMembers.map((m, idx) => (
                    <Bar
                      key={m.id}
                      dataKey={m.name}
                      stackId="spending"
                      fill={m.color}
                      radius={idx === activeMembers.length - 1 ? [3, 3, 0, 0] : undefined}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {activeMembers.length >= 2 && !hasAnyStackedData && transactions.length > 0 && (
            <div className="card p-6 border border-dashed border-slate-200 dark:border-slate-700 text-center">
              <p className="text-sm text-slate-400">
                No per-member spending data yet. Upload statements tagged with a member's name to see the breakdown chart.
              </p>
            </div>
          )}

          {/* Section C — Category Comparison Table */}
          {categoryComparison.length > 0 && activeMembers.length >= 2 && (
            <div className="card overflow-hidden">
              <div className="p-5 pb-3">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Category Breakdown</h3>
                <p className="text-xs text-slate-400 mt-0.5">Top 10 categories · All time · Expenses</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs text-slate-500 dark:text-slate-400 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Category</th>
                      {activeMembers.map(m => (
                        <th key={m.id} className="px-4 py-3 text-right whitespace-nowrap" style={{ color: m.color }}>
                          {m.name}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {categoryComparison.map(row => (
                      <tr key={row.category} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">{row.category}</td>
                        {activeMembers.map(m => (
                          <td key={m.id} className="px-4 py-3 text-right text-slate-600 dark:text-slate-300 tabular-nums">
                            {row.byOwner[m.name] ? formatAmount(row.byOwner[m.name], currency) : '—'}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
                          {formatAmount(row.total, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section D — Per-Member SummaryView tabs */}
          {transactions.length > 0 && (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setActiveMemberTab('all')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activeMemberTab === 'all'
                      ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-800'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  All Members
                </button>
                {activeMembers.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setActiveMemberTab(m.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                      activeMemberTab === m.id
                        ? 'text-white border-0'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                    style={activeMemberTab === m.id ? { backgroundColor: m.color } : {}}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: activeMemberTab === m.id ? 'rgba(255,255,255,0.6)' : m.color }}
                    />
                    {m.name}
                    {m.status === 'owner' && <span className="opacity-60 text-xs">(you)</span>}
                  </button>
                ))}
              </div>

              {(memberTransactions[activeMemberTab === 'all' ? 'all' : activeMemberTab]?.length ?? 0) > 0 ? (
                <SummaryView
                  data={memberTransactions[activeMemberTab === 'all' ? 'all' : activeMemberTab]}
                />
              ) : (
                <div className="card p-8 text-center">
                  <p className="text-slate-500 dark:text-slate-400 text-sm">
                    No transactions found for{' '}
                    <strong>{activeMembers.find(m => m.id === activeMemberTab)?.name ?? 'this member'}</strong>.
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Upload statements using the "Uploading for" selector on the main dashboard.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* No members yet */}
          {activeMembers.length < 2 && transactions.length > 0 && (
            <div className="card p-8 text-center border border-dashed border-slate-200 dark:border-slate-700">
              <p className="font-semibold text-slate-600 dark:text-slate-300">Add your first family member</p>
              <p className="text-sm text-slate-400 mt-1 mb-4">
                Go to the Members tab to add a family member and start tracking household finances together.
              </p>
              <button
                onClick={() => setActiveView('members')}
                className="btn-primary text-sm px-5 py-2"
              >
                Add a Member
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── MEMBERS ─────────────────────────────────────────── */}
      {activeView === 'members' && (
        <div className="space-y-6">

          {/* Member list card */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-700 dark:text-slate-200">
                Members ({activeMembers.length} / 5)
              </h3>
            </div>

            {activeMembers.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-400">No members yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                {activeMembers.map(m => (
                  <li key={m.id} className="flex items-center gap-3 px-5 py-4">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ backgroundColor: m.color }}
                    >
                      {m.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 dark:text-slate-100 truncate">
                        {m.name}
                        {m.status === 'owner' && (
                          <span className="text-xs text-slate-400 ml-1.5">(you)</span>
                        )}
                      </p>
                      {m.email && (
                        <p className="text-xs text-slate-400 truncate">{m.email}</p>
                      )}
                    </div>
                    <StatusBadge status={m.status} />
                    {m.status !== 'owner' && (
                      <button
                        onClick={() => removeMember(m.id)}
                        className="ml-1 text-slate-300 hover:text-red-500 transition-colors shrink-0"
                        title="Remove member"
                      >
                        <Icon name="close" className="w-4 h-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* Add member form */}
            {activeMembers.length < 5 ? (
              <div className="px-5 py-5 border-t border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-3">
                  Add a family member
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={addName}
                    onChange={e => setAddName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addMember()}
                    placeholder="Display name (e.g. Priya)"
                    className="input-field flex-1"
                  />
                  <input
                    type="email"
                    value={addEmail}
                    onChange={e => setAddEmail(e.target.value)}
                    placeholder="Email (optional)"
                    className="input-field sm:w-52"
                  />
                  <button
                    onClick={addMember}
                    disabled={!addName.trim()}
                    className="btn-primary px-5 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
                <div className="flex items-start gap-2 mt-3 text-xs text-amber-600 dark:text-amber-400">
                  <Icon name="info" className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    Email invites are coming soon. For now, add members by name and upload their
                    statements manually using the "Uploading for" selector on the main dashboard.
                  </span>
                </div>
              </div>
            ) : (
              <p className="px-5 py-4 border-t border-slate-100 dark:border-slate-700 text-center text-sm text-slate-400">
                Maximum of 5 members reached.
              </p>
            )}
          </div>

          {/* How it works */}
          <div className="card p-5 bg-brand-50/50 dark:bg-brand-900/10 border border-brand-100 dark:border-brand-800/30">
            <h4 className="font-semibold text-slate-700 dark:text-slate-200 text-sm mb-3">
              How Family Tracking Works
            </h4>
            <ol className="space-y-3">
              {[
                'Add family members above — each gets a display name used to tag their transactions.',
                'When uploading statements on the main dashboard, pick "Uploading for: [Name]" to tag that person\'s transactions.',
                'Return here to see combined household stats and per-member breakdowns.',
              ].map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-slate-600 dark:text-slate-400">
                  <span className="w-5 h-5 bg-brand-600 text-white rounded-full text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {/* ── SHARED BUDGETS ───────────────────────────────────── */}
      {activeView === 'shared-budgets' && (
        <div className="card p-10 text-center">
          <Icon name="wallet" className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">
            Shared Family Budgets
          </h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Set household-level budgets for categories like Groceries, Utilities, and Entertainment.
            All family members contribute to the same budget pool.
          </p>
          <p className="text-xs text-slate-300 mt-4">Coming in the next update</p>
        </div>
      )}
    </div>
  );
};

export default FamilyDashboard;
