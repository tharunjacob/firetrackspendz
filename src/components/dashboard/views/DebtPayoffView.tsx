import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/UIContext';
import { formatAmount } from '@/utils/constants';
import { Icon } from '@/components/common/Icons';
import { canAccessFeature } from '@/config/plans';
import { UpgradePrompt } from '@/components/common/UpgradePrompt';
import { getUserSetting, setUserSetting } from '@/services/userSettings';
import { STORAGE_KEYS } from '@/config/storage';
import { calculateDebtPayoff } from '@/services/debtPayoff';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import type { Debt, DebtPayoffMethod } from '@/types';

// ============================================================
// Debt Payoff View
// ============================================================

const DEBT_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'];

const DEBT_TYPE_LABELS: Record<Debt['type'], string> = {
  credit_card: 'Credit Card',
  personal_loan: 'Personal Loan',
  car_loan: 'Car Loan',
  home_loan: 'Home Loan',
  student_loan: 'Student Loan',
  other: 'Other',
};

const EXCLUDED_CATEGORIES = ['Rent', 'Mortgage', 'EMI', 'Loan', 'Transfer', 'Income'];

const formatMonths = (n: number) =>
  n === 0 ? '—' : n < 12 ? `${n}mo` : `${Math.floor(n / 12)}yr ${n % 12}mo`.replace(' 0mo', '');

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

// ---- Debt Form ----

interface DebtFormProps {
  initial?: Debt;
  onSave: (d: Omit<Debt, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
}

const DebtForm = ({ initial, onSave, onCancel }: DebtFormProps) => {
  const [name, setName] = useState(initial?.name ?? '');
  const [balance, setBalance] = useState(initial ? String(initial.balance) : '');
  const [rate, setRate] = useState(initial ? String(initial.interestRate) : '');
  const [minPay, setMinPay] = useState(initial ? String(initial.minimumPayment) : '');
  const [type, setType] = useState<Debt['type']>(initial?.type ?? 'credit_card');

  const valid = name.trim() && parseFloat(balance) > 0 && parseFloat(rate) >= 0 && parseFloat(minPay) >= 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    onSave({
      name: name.trim(),
      balance: parseFloat(balance),
      interestRate: parseFloat(rate),
      minimumPayment: parseFloat(minPay),
      type,
    });
  };

  const inputCls = 'w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500';
  const labelCls = 'block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className={labelCls}>Debt name</label>
          <input className={inputCls} placeholder="e.g. HDFC Credit Card" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Current balance</label>
          <input className={inputCls} type="number" min="0" step="any" placeholder="0.00" value={balance} onChange={e => setBalance(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Annual interest rate (%)</label>
          <input className={inputCls} type="number" min="0" max="100" step="0.1" placeholder="18.0" value={rate} onChange={e => setRate(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Minimum monthly payment</label>
          <input className={inputCls} type="number" min="0" step="any" placeholder="0.00" value={minPay} onChange={e => setMinPay(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Type</label>
          <select className={inputCls} value={type} onChange={e => setType(e.target.value as Debt['type'])}>
            {(Object.keys(DEBT_TYPE_LABELS) as Debt['type'][]).map(t => (
              <option key={t} value={t}>{DEBT_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={!valid} className="px-4 py-2 text-sm font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          {initial ? 'Save changes' : 'Add debt'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
};

// ---- Main View ----

export const DebtPayoffView = () => {
  const { transactions, currency, isAuthReady, plan } = useApp();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const GRID_COLOR = isDark ? '#334155' : '#e2e8f0';
  const TICK_COLOR = isDark ? '#94a3b8' : '#64748b';

  if (!canAccessFeature(plan, 'debt_payoff')) {
    return (
      <UpgradePrompt
        feature="Debt Payoff Planner"
        description="Track all your debts, pick Snowball or Avalanche payoff, and see exactly when you'll be debt-free — available on the Pro plan."
      />
    );
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [debts, setDebts] = useState<Debt[]>([]);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [hydrated, setHydrated] = useState(false);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [isAdding, setIsAdding] = useState(false);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [editingId, setEditingId] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [extraPayment, setExtraPayment] = useState('0');
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [method, setMethod] = useState<DebtPayoffMethod>('avalanche');

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!isAuthReady) return;
    let cancelled = false;
    getUserSetting<Debt[]>(STORAGE_KEYS.DEBTS, []).then(loaded => {
      if (!cancelled) { setDebts(loaded); setHydrated(true); }
    });
    return () => { cancelled = true; };
  }, [isAuthReady]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!hydrated) return;
    setUserSetting(STORAGE_KEYS.DEBTS, debts);
  }, [debts, hydrated]);

  const extra = Math.max(0, parseFloat(extraPayment) || 0);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const snowballResult = useMemo(() => calculateDebtPayoff(debts, extra, 'snowball'), [debts, extra]);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const avalancheResult = useMemo(() => calculateDebtPayoff(debts, extra, 'avalanche'), [debts, extra]);
  const activeResult = method === 'snowball' ? snowballResult : avalancheResult;

  // Last month's top spending categories for the insight box
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const spendingInsight = useMemo(() => {
    const now = new Date();
    const lastMonthStr = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      .toISOString()
      .substring(0, 7);
    const lastMonthTxns = transactions.filter(
      t => t.type === 'Expense' && t.date.startsWith(lastMonthStr)
    );
    if (lastMonthTxns.length === 0) return null;

    const byCategory: Record<string, number> = {};
    for (const t of lastMonthTxns) {
      if (EXCLUDED_CATEGORIES.some(k => t.category.includes(k))) continue;
      byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
    }
    const sorted = Object.entries(byCategory)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    if (sorted.length === 0) return null;

    // Suggest redirecting ~20% of top category, rounded to nearest 50
    const top = sorted[0];
    const suggested = Math.max(50, Math.round((top[1] * 0.2) / 50) * 50);
    return { topCategory: top[0], topAmount: top[1], suggested, allCategories: sorted };
  }, [transactions]);

  // Months saved if we redirect the suggested amount
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const insightSavings = useMemo(() => {
    if (!spendingInsight || debts.length === 0) return null;
    const boosted = calculateDebtPayoff(debts, extra + spendingInsight.suggested, method);
    const monthsSaved = activeResult.totalMonths - boosted.totalMonths;
    const interestSaved = activeResult.totalInterestPaid - boosted.totalInterestPaid;
    return { monthsSaved, interestSaved, boosted };
  }, [spendingInsight, debts, extra, method, activeResult]);

  // Chart data — downsample to ≤20 points
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const chartData = useMemo(() => {
    const sched = activeResult.schedule;
    if (sched.length === 0) return [];
    const step = Math.max(1, Math.floor(sched.length / 20));
    const indices = new Set<number>();
    for (let i = 0; i < sched.length; i += step) indices.add(i);
    indices.add(sched.length - 1);
    return [...indices].sort((a, b) => a - b).map(i => {
      const m = sched[i];
      const obj: Record<string, string | number> = { month: m.monthLabel };
      for (const d of m.remainingDebts) obj[d.name] = Math.round(d.balance);
      return obj;
    });
  }, [activeResult.schedule]);

  // Handlers
  const handleAdd = (fields: Omit<Debt, 'id' | 'createdAt'>) => {
    const newDebt: Debt = { ...fields, id: crypto.randomUUID?.() || Date.now().toString(), createdAt: new Date().toISOString() };
    setDebts(prev => [...prev, newDebt]);
    setIsAdding(false);
  };

  const handleEdit = (fields: Omit<Debt, 'id' | 'createdAt'>) => {
    if (!editingId) return;
    setDebts(prev => prev.map(d => d.id === editingId ? { ...d, ...fields } : d));
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    setDebts(prev => prev.filter(d => d.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const totalBalance = debts.reduce((s, d) => s + d.balance, 0);
  const totalMinPayments = debts.reduce((s, d) => s + d.minimumPayment, 0);

  // ---- Empty state ----
  if (debts.length === 0 && !isAdding) {
    return (
      <div className="space-y-6">
        <div className="text-center py-16 max-w-md mx-auto">
          <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Icon name="wallet" className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Plan your way out of debt</h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            Add your debts and pick a payoff strategy. See exactly when you'll be debt-free and how much interest you'll save.
          </p>
          <button
            onClick={() => setIsAdding(true)}
            className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Add your first debt
          </button>
        </div>

        {spendingInsight && (
          <div className="max-w-md mx-auto bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">Your spending data is ready to help</p>
            <p className="text-sm text-amber-700 dark:text-amber-400">
              You spent {formatAmount(spendingInsight.topAmount, currency)} on <strong>{spendingInsight.topCategory}</strong> last month. Redirecting just {formatAmount(spendingInsight.suggested, currency)}/month here could meaningfully accelerate your debt payoff.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ---- Debt List ---- */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800 dark:text-slate-100">Your Debts</h3>
          {!isAdding && (
            <button
              onClick={() => { setIsAdding(true); setEditingId(null); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors"
            >
              <Icon name="plus" className="w-4 h-4" />
              Add debt
            </button>
          )}
        </div>

        {debts.map((debt, i) => (
          <div key={debt.id}>
            {editingId === debt.id ? (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wide">Editing — {debt.name}</p>
                <DebtForm initial={debt} onSave={handleEdit} onCancel={() => setEditingId(null)} />
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/40 group">
                <div
                  className="w-3 h-10 rounded-full shrink-0"
                  style={{ background: DEBT_COLORS[i % DEBT_COLORS.length] }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{debt.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {DEBT_TYPE_LABELS[debt.type]} · {debt.interestRate}% APR · {formatAmount(debt.minimumPayment, currency)}/mo min
                  </p>
                </div>
                <p className="font-bold text-slate-800 dark:text-slate-100 shrink-0">{formatAmount(debt.balance, currency)}</p>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setEditingId(debt.id); setIsAdding(false); }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/30 transition-colors"
                  >
                    <Icon name="edit" className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(debt.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                  >
                    <Icon name="trash" className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {isAdding && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wide">New debt</p>
            <DebtForm onSave={handleAdd} onCancel={() => setIsAdding(false)} />
          </div>
        )}

        {debts.length > 0 && (
          <div className="flex gap-4 pt-1 border-t border-slate-100 dark:border-slate-700">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Total balance</p>
              <p className="font-bold text-slate-800 dark:text-slate-100">{formatAmount(totalBalance, currency)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Min. payments/mo</p>
              <p className="font-bold text-slate-800 dark:text-slate-100">{formatAmount(totalMinPayments, currency)}</p>
            </div>
          </div>
        )}
      </div>

      {debts.length > 0 && (
        <>
          {/* ---- Controls ---- */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4">Payoff settings</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Extra monthly payment (on top of minimums)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={extraPayment}
                  onChange={e => setExtraPayment(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Payoff method
                </label>
                <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden text-sm font-medium">
                  {(['avalanche', 'snowball'] as DebtPayoffMethod[]).map(m => (
                    <button
                      key={m}
                      onClick={() => setMethod(m)}
                      className={`flex-1 py-2 transition-colors ${
                        method === m
                          ? 'bg-brand-600 text-white'
                          : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'
                      }`}
                    >
                      {m === 'avalanche' ? 'Avalanche' : 'Snowball'}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                  {method === 'avalanche'
                    ? 'Avalanche: pay highest interest rate first — saves the most money overall.'
                    : 'Snowball: pay smallest balance first — fastest early wins for motivation.'}
                </p>
              </div>
            </div>
          </div>

          {/* ---- Results ---- */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-5">
            <h3 className="font-bold text-slate-800 dark:text-slate-100">Results</h3>

            {/* Hero stat */}
            {activeResult.neverPaysOff ? (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-red-100 dark:bg-red-800/40 rounded-xl flex items-center justify-center shrink-0">
                    <Icon name="warning" className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="font-bold text-red-800 dark:text-red-200 text-sm">This debt won't be paid off</p>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                      Your budget doesn't cover the interest — this debt won't be paid off. Increase your monthly payment.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 bg-brand-50 dark:bg-brand-900/20 rounded-xl p-4 text-center">
                  <p className="text-xs font-medium text-brand-600 dark:text-brand-400 uppercase tracking-wide">Debt-free by</p>
                  <p className="text-2xl font-extrabold text-brand-700 dark:text-brand-300 mt-1">{formatDate(activeResult.debtFreeDate)}</p>
                  <p className="text-sm text-brand-500 dark:text-brand-400 mt-0.5">{formatMonths(activeResult.totalMonths)} from now</p>
                </div>
                <div className="flex-1 bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center">
                  <p className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wide">Total interest you'll pay</p>
                  <p className="text-2xl font-extrabold text-red-700 dark:text-red-300 mt-1">{formatAmount(activeResult.totalInterestPaid, currency)}</p>
                  <p className="text-sm text-red-500 dark:text-red-400 mt-0.5">over {formatMonths(activeResult.totalMonths)}</p>
                </div>
              </div>
            )}

            {/* Method comparison */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">Method comparison</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 dark:text-slate-400">
                      <th className="pb-2 font-medium">Method</th>
                      <th className="pb-2 font-medium text-right">Months</th>
                      <th className="pb-2 font-medium text-right">Total interest</th>
                      <th className="pb-2 font-medium text-right">Debt-free</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {([['Avalanche', avalancheResult], ['Snowball', snowballResult]] as const).map(([label, r]) => (
                      <tr
                        key={label}
                        className={`${r.method === method ? 'font-semibold text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-400'}`}
                      >
                        <td className="py-2">{label} {r.method === method && <span className="ml-1 text-xs text-brand-500">(active)</span>}</td>
                        <td className="py-2 text-right">{r.neverPaysOff ? 'Never' : formatMonths(r.totalMonths)}</td>
                        <td className="py-2 text-right">{formatAmount(r.totalInterestPaid, currency)}</td>
                        <td className="py-2 text-right">{r.neverPaysOff ? '—' : formatDate(r.debtFreeDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payoff timeline chart */}
            {chartData.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">Balance over time</p>
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                      <XAxis
                        dataKey="month"
                        tick={{ fill: TICK_COLOR, fontSize: 10 }}
                        interval="preserveStartEnd"
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: TICK_COLOR, fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        width={60}
                        tickFormatter={v => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => [formatAmount(value, currency), name]}
                        contentStyle={{
                          background: isDark ? '#1e293b' : '#fff',
                          border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {debts.map((d, i) => (
                        <Bar key={d.id} dataKey={d.name} stackId="a" fill={DEBT_COLORS[i % DEBT_COLORS.length]} radius={i === debts.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* ---- Spending Insight ---- */}
          {spendingInsight && insightSavings && insightSavings.monthsSaved > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-amber-100 dark:bg-amber-800/40 rounded-xl flex items-center justify-center shrink-0">
                  <Icon name="flash" className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="font-bold text-amber-800 dark:text-amber-200 text-sm">Personalised insight from your spending</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    You spent <strong>{formatAmount(spendingInsight.topAmount, currency)}</strong> on <strong>{spendingInsight.topCategory}</strong> last month.
                    Redirect <strong>{formatAmount(spendingInsight.suggested, currency)}/month</strong> to your debts and you'll be debt-free{' '}
                    <strong>{formatMonths(insightSavings.monthsSaved)} sooner</strong>, saving{' '}
                    <strong>{formatAmount(insightSavings.interestSaved, currency)}</strong> in interest.
                  </p>
                  <button
                    onClick={() => setExtraPayment(String(extra + spendingInsight.suggested))}
                    className="mt-3 px-4 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors"
                  >
                    Add {formatAmount(spendingInsight.suggested, currency)}/mo to extra payment
                  </button>
                </div>
              </div>
            </div>
          )}

          {spendingInsight && (!insightSavings || insightSavings.monthsSaved <= 0) && (
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <strong className="text-slate-800 dark:text-slate-200">Spending snapshot:</strong> You spent{' '}
                {spendingInsight.allCategories.map(([cat, amt], i) => (
                  <span key={cat}>
                    {i > 0 && (i === spendingInsight.allCategories.length - 1 ? ' and ' : ', ')}
                    <strong>{formatAmount(amt, currency)}</strong> on {cat}
                  </span>
                ))} last month. Consider redirecting part of this to extra debt payments.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
