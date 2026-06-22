import React, { useMemo, useState, useEffect } from 'react';
import { logEvent, EVENTS } from '@/services/logger';
import { useApp } from '@/contexts/AppContext';
import type { Transaction } from '@/types';
import { formatAmount } from '@/utils/constants';
import { canAccessFeature } from '@/config/plans';
import { UpgradePrompt } from '@/components/common/UpgradePrompt';

const formatPercent = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v);

export const CompareView = ({ data }: { data?: Transaction[] }) => {
  useEffect(() => { logEvent(EVENTS.FEATURE_COMPARE_OPENED); }, []);
  const { transactions, currency, plan } = useApp();

  const txns = data ?? transactions;

  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  // Extract available years and months
  const { years, months } = useMemo(() => {
    const yearSet = new Set<number>();
    const monthSet = new Set<string>();
    txns.forEach(t => {
      const date = new Date(t.date + 'T00:00:00');
      yearSet.add(date.getFullYear());
      monthSet.add(`${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`);
    });
    return {
      years: Array.from(yearSet).sort((a, b) => b - a),
      months: Array.from(monthSet).sort((a, b) => b.localeCompare(a)),
    };
  }, [txns]);

  const [periodType, setPeriodType] = useState<'Yearly' | 'Monthly'>('Yearly');
  const options = periodType === 'Yearly' ? years.map(y => String(y)) : months;
  const [period1, setPeriod1] = useState<string>(options.length > 1 ? options[1] : '');
  const [period2, setPeriod2] = useState<string>(options.length > 0 ? options[0] : '');

  // For signed-in users, transactions load asynchronously after mount, so `options`
  // starts empty and the useState initializers above leave period1/period2 blank,
  // which renders an empty comparison. Re-sync once options arrive — using functional
  // updates so a selection the user already made is never overwritten.
  useEffect(() => {
    if (options.length === 0) return;
    setPeriod1(prev => prev || (options.length > 1 ? options[1] : options[0] || ''));
    setPeriod2(prev => prev || (options.length > 0 ? options[0] : ''));
  }, [options.join('|')]);

  // Build comparison data
  type CategoryData = { total: number; subCategories: Record<string, number> };
  const comparisonData = useMemo(() => {
    if (!period1 || !period2) return null;

    const getPeriodData = (period: string) => {
      const filtered = txns.filter(t => {
        const date = new Date(t.date + 'T00:00:00');
        if (periodType === 'Yearly') return date.getFullYear().toString() === period;
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}` === period;
      });
      const process = (type: 'Income' | 'Expense') => {
        const catMap = new Map<string, CategoryData>();
        filtered.filter(t => t.type === type).forEach(t => {
          if (!catMap.has(t.category)) catMap.set(t.category, { total: 0, subCategories: {} });
          const catData = catMap.get(t.category)!;
          catData.total += t.amount;
          catData.subCategories[t.subCategory] = (catData.subCategories[t.subCategory] || 0) + t.amount;
        });
        return Object.fromEntries(catMap);
      };
      return {
        totalIncome: filtered.filter(t => t.type === 'Income').reduce((sum, t) => sum + t.amount, 0),
        totalExpenses: filtered.filter(t => t.type === 'Expense').reduce((sum, t) => sum + t.amount, 0),
        incomeCats: process('Income'),
        expenseCats: process('Expense'),
      };
    };
    return { data1: getPeriodData(period1), data2: getPeriodData(period2) };
  }, [txns, periodType, period1, period2]);

  if (!canAccessFeature(plan, 'trend_analysis')) {
    return <UpgradePrompt feature="Period Comparison" description="Compare spending between months or years side by side" />;
  }

  const formatLabel = (value: string) => {
    if (!value) return '';
    if (periodType === 'Yearly') return value;
    try {
      const [y, m] = value.split('-');
      const date = new Date(parseInt(y), parseInt(m) - 1);
      return `${date.toLocaleString('default', { month: 'short' })} '${y.slice(2)}`;
    } catch { return value; }
  };

  const fmtCurrency = (v: number) => formatAmount(v, currency);

  // ─── Change Indicator ───────────────────────────────────────
  const ChangeIndicator = ({ current, prev, type }: { current: number; prev: number; type: 'income' | 'expense' }) => {
    if (prev === 0 && current === 0) return <span className="text-gray-400">-</span>;
    if (prev === 0) return <span className="text-slate-500 dark:text-slate-400 font-bold">New</span>;
    const change = (current - prev) / Math.abs(prev);
    const isIncrease = change > 0;
    let color = 'text-slate-600 dark:text-slate-400';
    if (type === 'income') color = isIncrease ? 'text-green-600' : 'text-red-600';
    else color = isIncrease ? 'text-red-600' : 'text-green-600';
    return <span className={`font-bold ${color}`}>{isIncrease ? '▲' : '▼'} {formatPercent(Math.abs(change))}</span>;
  };

  // ─── Comparison Table Section ──────────────────────────────
  const ComparisonTable = ({ title, cats1, cats2, type }: {
    title: string; cats1: Record<string, CategoryData>; cats2: Record<string, CategoryData>; type: 'income' | 'expense';
  }) => {
    const allCats = [...new Set([...Object.keys(cats1), ...Object.keys(cats2)])];
    const toggleCategory = (cat: string) =>
      setExpandedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);

    return (
      <>
        <tr className="bg-slate-100 dark:bg-slate-700">
          <td colSpan={4} className="px-6 py-3 font-bold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-600">{title}</td>
        </tr>
        {allCats.map(cat => {
          const d1 = cats1[cat] || { total: 0, subCategories: {} };
          const d2 = cats2[cat] || { total: 0, subCategories: {} };
          const isExpanded = expandedCategories.includes(cat);
          const hasSubcats = Object.keys(d1.subCategories).length > 0 || Object.keys(d2.subCategories).length > 0;
          return (
            <React.Fragment key={cat}>
              <tr
                className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                onClick={() => hasSubcats && toggleCategory(cat)}
                style={{ cursor: hasSubcats ? 'pointer' : 'default' }}
              >
                <td className="px-6 py-3 font-medium text-slate-800 dark:text-slate-100">
                  {hasSubcats && <span className={`inline-block w-4 mr-1 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>}
                  {cat}
                </td>
                <td className="px-6 py-3 text-right text-slate-600 dark:text-slate-400">{fmtCurrency(d1.total)}</td>
                <td className="px-6 py-3 text-right text-slate-600 dark:text-slate-400 font-semibold">{fmtCurrency(d2.total)}</td>
                <td className="px-6 py-3 text-right">
                  <ChangeIndicator current={d2.total} prev={d1.total} type={type} />
                </td>
              </tr>
              {isExpanded && Object.keys({ ...d1.subCategories, ...d2.subCategories }).map(subCat => {
                const v1 = d1.subCategories[subCat] || 0;
                const v2 = d2.subCategories[subCat] || 0;
                return (
                  <tr key={`${cat}-${subCat}`} className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs">
                    <td className="pl-14 py-2">{subCat || '(Unspecified)'}</td>
                    <td className="py-2 text-right px-6">{fmtCurrency(v1)}</td>
                    <td className="py-2 text-right px-6">{fmtCurrency(v2)}</td>
                    <td className="py-2 text-right px-6">
                      <ChangeIndicator current={v2} prev={v1} type={type} />
                    </td>
                  </tr>
                );
              })}
            </React.Fragment>
          );
        })}
      </>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Comparison Analysis</h3>
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700 p-1 rounded-lg border border-slate-200 dark:border-slate-600">
            <select
              value={periodType}
              onChange={e => {
                const newType = e.target.value as 'Yearly' | 'Monthly';
                setPeriodType(newType);
                const newOptions = newType === 'Yearly' ? years.map(String) : months;
                setPeriod1(newOptions.length > 1 ? newOptions[1] : '');
                setPeriod2(newOptions.length > 0 ? newOptions[0] : '');
                setExpandedCategories([]);
              }}
              className="px-3 py-1.5 bg-white dark:bg-slate-600 border border-slate-300 dark:border-slate-500 rounded-md text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option>Yearly</option>
              <option>Monthly</option>
            </select>
          </div>
        </div>

        {/* Period Selectors */}
        <div className="flex items-center justify-center gap-4 bg-brand-50 dark:bg-brand-900/20 p-4 rounded-lg border border-brand-100 dark:border-brand-800">
          <select value={period1} onChange={e => setPeriod1(e.target.value)} className="px-4 py-2 bg-white dark:bg-slate-700 border border-brand-200 dark:border-brand-700 rounded-lg font-medium text-slate-700 dark:text-slate-200 shadow-sm">
            {options.map(o => <option key={`p1-${o}`} value={o}>{formatLabel(o)}</option>)}
          </select>
          <span className="text-brand-400 font-bold text-xl">VS</span>
          <select value={period2} onChange={e => setPeriod2(e.target.value)} className="px-4 py-2 bg-white dark:bg-slate-700 border border-brand-200 dark:border-brand-700 rounded-lg font-medium text-slate-700 dark:text-slate-200 shadow-sm">
            {options.map(o => <option key={`p2-${o}`} value={o}>{formatLabel(o)}</option>)}
          </select>
        </div>

        {/* Comparison Table */}
        {comparisonData && (
          <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-800 dark:bg-slate-900 text-white">
                <tr>
                  <th className="px-6 py-4 font-semibold">Metric / Category</th>
                  <th className="px-6 py-4 text-right font-semibold">{formatLabel(period1)}</th>
                  <th className="px-6 py-4 text-right font-semibold">{formatLabel(period2)}</th>
                  <th className="px-6 py-4 text-right font-semibold">Change</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                  <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">Total Income</td>
                  <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-400">{fmtCurrency(comparisonData.data1.totalIncome)}</td>
                  <td className="px-6 py-4 text-right text-slate-800 dark:text-slate-100 font-bold">{fmtCurrency(comparisonData.data2.totalIncome)}</td>
                  <td className="px-6 py-4 text-right">
                    <ChangeIndicator current={comparisonData.data2.totalIncome} prev={comparisonData.data1.totalIncome} type="income" />
                  </td>
                </tr>
                <tr className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                  <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">Total Expenses</td>
                  <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-400">{fmtCurrency(comparisonData.data1.totalExpenses)}</td>
                  <td className="px-6 py-4 text-right text-slate-800 dark:text-slate-100 font-bold">{fmtCurrency(comparisonData.data2.totalExpenses)}</td>
                  <td className="px-6 py-4 text-right">
                    <ChangeIndicator current={comparisonData.data2.totalExpenses} prev={comparisonData.data1.totalExpenses} type="expense" />
                  </td>
                </tr>
                <ComparisonTable title="Income Categories" cats1={comparisonData.data1.incomeCats} cats2={comparisonData.data2.incomeCats} type="income" />
                <ComparisonTable title="Expense Categories" cats1={comparisonData.data1.expenseCats} cats2={comparisonData.data2.expenseCats} type="expense" />
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
