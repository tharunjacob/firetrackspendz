import { useState, useMemo, useEffect } from 'react';
import { logEvent, EVENTS } from '@/services/logger';
import { useApp } from '@/contexts/AppContext';
import { formatAmount, TYPE_CATEGORIES } from '@/utils/constants';
import { Icon } from '@/components/common/Icons';
import type { Budget } from '@/types';
import { getUserSetting, setUserSetting } from '@/services/userSettings';
import { STORAGE_KEYS } from '@/config/storage';
import { canAccessFeature } from '@/config/plans';

export const BudgetsView = () => {
  useEffect(() => { logEvent(EVENTS.FEATURE_BUDGETS_OPENED); }, []);
  const { transactions, currency, isAuthReady, plan, isDemoMode } = useApp();

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newBudget, setNewBudget] = useState({ category: '', limit: '' });

  useEffect(() => {
    if (!isAuthReady) return;
    let cancelled = false;
    getUserSetting<Budget[]>(STORAGE_KEYS.BUDGETS, []).then(loaded => {
      if (!cancelled) {
        if (loaded.length === 0 && isDemoMode) {
          setBudgets([
            { id: 'demo-b1', user_id: '', category: 'Housing', monthly_limit: 1800, currency, is_active: true },
            { id: 'demo-b2', user_id: '', category: 'Groceries', monthly_limit: 500, currency, is_active: true },
            { id: 'demo-b3', user_id: '', category: 'Transport', monthly_limit: 250, currency, is_active: true },
            { id: 'demo-b4', user_id: '', category: 'Food', monthly_limit: 200, currency, is_active: true },
          ]);
        } else {
          setBudgets(loaded);
        }
        setHydrated(true);
      }
    });
    return () => { cancelled = true; };
  }, [isAuthReady, isDemoMode, currency]);

  useEffect(() => {
    if (!hydrated) return;
    if (isDemoMode) return; // Do not persist demo budgets to user settings
    setUserSetting(STORAGE_KEYS.BUDGETS, budgets);
  }, [budgets, hydrated, isDemoMode]);

  const currentMonth = new Date().toISOString().substring(0, 7);
  const currentMonthExpenses = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'Expense' && t.date.startsWith(currentMonth));
    const catMap = new Map<string, number>();
    expenses.forEach(t => catMap.set(t.category, (catMap.get(t.category) || 0) + t.amount));
    return catMap;
  }, [transactions, currentMonth]);

  const addBudget = () => {
    const parsedLimit = parseFloat(newBudget.limit);
    if (!newBudget.category || isNaN(parsedLimit) || parsedLimit <= 0) return;
    setBudgets(prev => [...prev, {
      id: Date.now().toString(), user_id: '', category: newBudget.category,
      monthly_limit: parsedLimit, currency, is_active: true,
    }]);
    setNewBudget({ category: '', limit: '' });
    setShowAdd(false);
  };

  const removeBudget = (id: string) => setBudgets(prev => prev.filter(b => b.id !== id));

  // Auto-suggest budgets for top categories
  const topCategories = useMemo(() => {
    const cats = [...currentMonthExpenses.entries()].sort((a, b) => b[1] - a[1]);
    return cats.filter(([cat]) => !budgets.some(b => b.category === cat));
  }, [currentMonthExpenses, budgets]);

  const canSave = canAccessFeature(plan, 'budgets');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Budget Tracker</h2>
          <p className="text-sm text-slate-500 mt-0.5">Track your spending against monthly limits for the current calendar month.</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          disabled={!canSave}
          title={!canSave ? 'Upgrade to Pro to save custom budgets' : undefined}
          className={`btn-primary text-sm px-4 py-2${!canSave ? ' opacity-50 cursor-not-allowed' : ''}`}
        >
          <Icon name="plus" className="w-4 h-4 inline mr-1" /> Set Budget
        </button>
      </div>
      {!canSave && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 text-sm text-brand-700 dark:text-brand-300">
          <Icon name="flash" className="w-4 h-4 shrink-0" />
          <span>Upgrade to Pro to save budgets across sessions and devices.</span>
        </div>
      )}

      {showAdd && (
        <div className="card p-5 border-2 border-brand-200 animate-slide-up">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              id="budget-category"
              name="budget-category"
              value={newBudget.category}
              onChange={e => setNewBudget(p => ({ ...p, category: e.target.value }))}
              className="input-field"
            >
              <option value="">Select category</option>
              {TYPE_CATEGORIES.Expense.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              id="budget-limit"
              name="budget-limit"
              type="number"
              placeholder="Monthly budget limit"
              value={newBudget.limit}
              onChange={e => setNewBudget(p => ({ ...p, limit: e.target.value }))}
              className="input-field"
            />
            <div className="flex gap-2">
              <button onClick={addBudget} className="btn-primary flex-1">Add</button>
              <button onClick={() => setShowAdd(false)} className="btn-secondary px-3">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Budget Cards */}
      {budgets.length === 0 ? (
        <div className="card p-8 text-center">
          <Icon name="wallet" className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">No budgets set</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Set monthly limits for your spending categories to track your progress.</p>
          {topCategories.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2">Suggested budgets based on your spending:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {topCategories.slice(0, 4).map(([cat, spent]) => (
                  <button key={cat} onClick={() => { setBudgets(prev => [...prev, {
                    id: Date.now().toString() + cat, user_id: '', category: cat,
                    monthly_limit: Math.round(spent * 1.1), currency, is_active: true,
                  }]); }} className="px-3 py-1.5 bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300 rounded-lg text-sm font-medium hover:bg-brand-100 dark:hover:bg-brand-900">
                    {cat}: {formatAmount(Math.round(spent * 1.1), currency)}/mo
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgets.map(b => {
            const spent = currentMonthExpenses.get(b.category) || 0;
            const pct = b.monthly_limit > 0 ? (spent / b.monthly_limit) * 100 : 0;
            const isOver = pct > 100;
            const isWarning = pct > 80 && !isOver;

            return (
              <div key={b.id} className={`card p-5 border-l-4 ${isOver ? 'border-l-red-500' : isWarning ? 'border-l-amber-500' : 'border-l-green-500'}`}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{b.category}</p>
                  <button onClick={() => removeBudget(b.id)} className="text-slate-500 hover:text-red-500"><Icon name="trash" className="w-4 h-4" /></button>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className={isOver ? 'text-red-600 font-bold' : 'text-slate-600 dark:text-slate-400'}>{formatAmount(spent, currency)}</span>
                  <span className="text-slate-500">of {formatAmount(b.monthly_limit, currency)}</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                  <div className={`h-3 rounded-full transition-all ${isOver ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
                <p className={`text-xs mt-2 ${isOver ? 'text-red-500 font-semibold' : 'text-slate-500'}`}>
                  {isOver ? `Over budget by ${formatAmount(spent - b.monthly_limit, currency)}!` : `${formatAmount(b.monthly_limit - spent, currency)} remaining`}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
