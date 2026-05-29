import { useState, useMemo, useEffect } from 'react';
import { logEvent, EVENTS } from '@/services/logger';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/UIContext';
import { formatAmount, COLORS } from '@/utils/constants';
import { Icon } from '@/components/common/Icons';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { getUserSetting, setUserSetting } from '@/services/userSettings';
import { STORAGE_KEYS } from '@/config/storage';
import { canAccessFeature } from '@/config/plans';
import { UpgradePrompt } from '@/components/common/UpgradePrompt';
import type { SavingsGoal } from '@/types';

// ============================================================
// Goals View – Savings Goals & Debt Payoff Tracking
// ============================================================

const GOAL_ICONS = ['target', 'fire', 'wallet', 'shield', 'chart', 'flash', 'flag'];
const GOAL_COLORS = COLORS.categories;

export const GoalsView = () => {
  useEffect(() => { logEvent(EVENTS.FEATURE_GOALS_OPENED); }, []);
  const { transactions, currency, isAuthReady, plan } = useApp();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const GRID_COLOR = isDark ? '#334155' : '#e2e8f0';

  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [customInputId, setCustomInputId] = useState<string | null>(null);
  const [customInputVal, setCustomInputVal] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [current, setCurrent] = useState('');
  const [deadline, setDeadline] = useState('');
  const [monthly, setMonthly] = useState('');
  const [color, setColor] = useState(GOAL_COLORS[0]);
  const [icon, setGoalIcon] = useState(GOAL_ICONS[0]);

  useEffect(() => {
    if (!isAuthReady) return;
    let cancelled = false;
    getUserSetting<SavingsGoal[]>(STORAGE_KEYS.SAVINGS_GOALS, []).then(loaded => {
      if (!cancelled) {
        setGoals(loaded);
        setHydrated(true);
      }
    });
    return () => { cancelled = true; };
  }, [isAuthReady]);

  useEffect(() => {
    if (!hydrated) return;
    setUserSetting(STORAGE_KEYS.SAVINGS_GOALS, goals);
  }, [goals, hydrated]);

  // Monthly savings average
  const avgMonthlySavings = useMemo(() => {
    const income = transactions.filter(t => t.type === 'Income');
    const expenses = transactions.filter(t => t.type === 'Expense');
    const months = new Set(transactions.map(t => t.date.substring(0, 7))).size || 1;
    const totalIncome = income.reduce((s, t) => s + t.amount, 0);
    const totalExpense = expenses.reduce((s, t) => s + t.amount, 0);
    return (totalIncome - totalExpense) / months;
  }, [transactions]);

  const resetForm = () => {
    setName(''); setTarget(''); setCurrent(''); setDeadline(''); setMonthly('');
    setColor(GOAL_COLORS[goals.length % GOAL_COLORS.length]);
    setGoalIcon(GOAL_ICONS[goals.length % GOAL_ICONS.length]);
    setIsAdding(false); setEditingId(null);
  };

  const handleSave = () => {
    if (!name.trim() || !target) return;
    const goal: SavingsGoal = {
      id: editingId || crypto.randomUUID?.() || Date.now().toString(),
      name: name.trim(),
      targetAmount: parseFloat(target),
      currentAmount: parseFloat(current) || 0,
      deadline: deadline || undefined,
      icon,
      color,
      monthlyContribution: parseFloat(monthly) || 0,
      createdAt: editingId ? (goals.find(g => g.id === editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
    };

    if (editingId) {
      setGoals(prev => prev.map(g => g.id === editingId ? goal : g));
    } else {
      setGoals(prev => [...prev, goal]);
    }
    resetForm();
  };

  const startEdit = (g: SavingsGoal) => {
    setEditingId(g.id);
    setName(g.name);
    setTarget(g.targetAmount.toString());
    setCurrent(g.currentAmount.toString());
    setDeadline(g.deadline || '');
    setMonthly(g.monthlyContribution.toString());
    setColor(g.color);
    setGoalIcon(g.icon);
    setIsAdding(true);
  };

  const deleteGoal = (id: string) => {
    if (!confirm('Delete this goal?')) return;
    setGoals(prev => prev.filter(g => g.id !== id));
  };

  const updateAmount = (id: string, amount: number) => {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, currentAmount: Math.max(0, g.currentAmount + amount) } : g));
  };

  // Chart data
  const chartData = goals.map(g => ({
    name: g.name.length > 12 ? g.name.substring(0, 12) + '...' : g.name,
    progress: Math.min(100, (g.currentAmount / g.targetAmount) * 100),
    color: g.color,
  }));

  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
  const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0);

  if (!canAccessFeature(plan, 'goals')) {
    return <UpgradePrompt feature="Savings Goals" description="Set savings targets and track your progress with projections" />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Savings Goals</h2>
        <button onClick={() => { resetForm(); setIsAdding(true); }}
          className="btn-primary text-sm px-4 py-2 flex items-center gap-2">
          <Icon name="plus" className="w-4 h-4" /> New Goal
        </button>
      </div>

      {/* Summary Cards */}
      {goals.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="stat-card">
            <p className="text-xs text-slate-500 uppercase">Goals</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{goals.length}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-slate-500 uppercase">Total Target</p>
            <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{formatAmount(totalTarget, currency)}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-slate-500 uppercase">Total Saved</p>
            <p className="text-xl font-bold text-green-600">{formatAmount(totalSaved, currency)}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-slate-500 uppercase">Overall Progress</p>
            <p className="text-xl font-bold text-brand-600">{totalTarget > 0 ? ((totalSaved / totalTarget) * 100).toFixed(1) : 0}%</p>
          </div>
        </div>
      )}

      {/* Progress Chart */}
      {chartData.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">Goal Progress</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} layout="vertical" barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={v => v + '%'} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
              <Tooltip formatter={(v: number) => v.toFixed(1) + '%'} />
              <Bar dataKey="progress" radius={[0, 4, 4, 0]} animationDuration={800}>
                {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Goal Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {goals.map(g => {
          const pct = g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0;
          const remaining = g.targetAmount - g.currentAmount;
          const monthsToGoal = g.monthlyContribution > 0 ? Math.ceil(remaining / g.monthlyContribution) : null;

          return (
            <div key={g.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: g.color + '15' }}>
                    <Icon name={g.icon} className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100">{g.name}</h4>
                    {g.deadline && (
                      <p className="text-xs text-slate-500">Target: {new Date(g.deadline).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(g)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors">
                    <Icon name="cog" className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                  <button onClick={() => deleteGoal(g.id)} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
                    <Icon name="trash" className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-bold" style={{ color: g.color }}>{formatAmount(g.currentAmount, currency)}</span>
                  <span className="text-slate-500">{formatAmount(g.targetAmount, currency)}</span>
                </div>
                <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: g.color }} />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-xs font-bold" style={{ color: g.color }}>{pct.toFixed(1)}%</span>
                  <span className="text-xs text-slate-500">
                    {remaining > 0 ? `${formatAmount(remaining, currency)} to go` : 'Goal reached!'}
                  </span>
                </div>
              </div>

              {/* Quick update buttons */}
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
                {g.monthlyContribution > 0 && (
                  <button onClick={() => updateAmount(g.id, g.monthlyContribution)}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors hover:opacity-80" style={{ backgroundColor: g.color + '15', color: g.color }}>
                    + {formatAmount(g.monthlyContribution, currency)}
                  </button>
                )}
                <button
                  onClick={() => { setCustomInputId(g.id); setCustomInputVal(''); }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  + Custom
                </button>
                {monthsToGoal && remaining > 0 && (
                  <span className="text-xs text-slate-500 ml-auto">
                    ~{monthsToGoal} month{monthsToGoal > 1 ? 's' : ''} left
                  </span>
                )}
              </div>
              {customInputId === g.id && (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="number"
                    min="0"
                    placeholder="Amount"
                    value={customInputVal}
                    onChange={e => setCustomInputVal(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const v = parseFloat(customInputVal);
                        if (!isNaN(v) && v > 0) { updateAmount(g.id, v); }
                        setCustomInputId(null);
                      }
                      if (e.key === 'Escape') setCustomInputId(null);
                    }}
                    className="w-28 text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-400"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      const v = parseFloat(customInputVal);
                      if (!isNaN(v) && v > 0) updateAmount(g.id, v);
                      setCustomInputId(null);
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setCustomInputId(null)}
                    className="text-xs px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {goals.length === 0 && !isAdding && (
        <div className="card p-10 text-center">
          <Icon name="target" className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-1">Set Your First Goal</h3>
          <p className="text-sm text-slate-500 mb-4 max-w-md mx-auto">
            Track savings for an emergency fund, vacation, house down payment, or any financial goal. Watch your progress visually.
          </p>
          <button onClick={() => setIsAdding(true)} className="btn-primary text-sm px-6 py-2">
            Create a Goal
          </button>
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => resetForm()}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">{editingId ? 'Edit Goal' : 'New Savings Goal'}</h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Goal Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Emergency Fund" className="input-field" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Target Amount</label>
                  <input type="number" value={target} onChange={e => setTarget(e.target.value)} placeholder="50000" className="input-field" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Currently Saved</label>
                  <input type="number" value={current} onChange={e => setCurrent(e.target.value)} placeholder="0" className="input-field" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Monthly Contribution</label>
                  <input type="number" value={monthly} onChange={e => setMonthly(e.target.value)} placeholder="5000" className="input-field" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Target Date (optional)</label>
                  <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="input-field" />
                </div>
              </div>

              {/* Color picker */}
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">Color</label>
                <div className="flex gap-2">
                  {GOAL_COLORS.map(c => (
                    <button key={c} onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 scale-110' : 'hover:scale-105'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>

              {avgMonthlySavings > 0 && (
                <p className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-700 rounded-lg p-3">
                  Based on your data, your average monthly savings is {formatAmount(avgMonthlySavings, currency)}.
                </p>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={resetForm} className="btn-secondary flex-1 py-2">Cancel</button>
              <button onClick={handleSave} disabled={!name.trim() || !target}
                className="btn-primary flex-1 py-2 disabled:opacity-50">{editingId ? 'Update' : 'Create Goal'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
