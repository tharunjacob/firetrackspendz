import { useMemo, useEffect } from 'react';
import { logEvent, EVENTS } from '@/services/logger';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/UIContext';
import type { Transaction } from '@/types';
import { formatAmount, COLORS } from '@/utils/constants';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { canAccessFeature } from '@/config/plans';
import { UpgradePrompt } from '@/components/common/UpgradePrompt';

// ─── Generic Tooltip ─────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, formatCurrency }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 text-sm z-50 max-w-xs">
      <p className="font-bold text-slate-800 dark:text-slate-100 mb-2 border-b border-slate-100 dark:border-slate-700 pb-1">{label}</p>
      {payload.map((pld: any, index: number) => (
        <div key={index} className="flex items-center justify-between gap-4 mb-1">
          <span style={{ color: pld.fill || pld.stroke }} className="font-medium">{pld.name}</span>
          <span className="font-mono text-slate-600 dark:text-slate-400">{formatCurrency(pld.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Category Trend Stacked Bar Chart ────────────────────────
const CategoryTrendChart = ({ data, type, formatCurrency }: {
  data: Transaction[]; type: 'Income' | 'Expense'; formatCurrency: (v: number) => string;
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const TICK_COLOR = isDark ? '#94a3b8' : '#64748b';
  const { yearlyData, topCategories } = useMemo(() => {
    const years = [...new Set(data.map(t => new Date(t.date + 'T00:00:00').getFullYear()))].sort();
    const catTotals = new Map<string, number>();
    data.filter(t => t.type === type).forEach(t => {
      catTotals.set(t.category, (catTotals.get(t.category) || 0) + t.amount);
    });
    const topCats = Array.from(catTotals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(c => c[0]);

    const yearly = years.map(year => {
      const yearData: Record<string, string | number> = { year: year.toString() };
      let otherTotal = 0;
      data.filter(t => new Date(t.date + 'T00:00:00').getFullYear() === year && t.type === type)
        .forEach(t => {
          if (topCats.includes(t.category)) yearData[t.category] = ((yearData[t.category] as number) || 0) + t.amount;
          else otherTotal += t.amount;
        });
      yearData['Others'] = otherTotal;
      return yearData;
    });
    return { yearlyData: yearly, topCategories: [...topCats, 'Others'] };
  }, [data, type]);

  const colors = type === 'Income' ? COLORS.income.palette : COLORS.expense.palette;

  return (
    <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl shadow-sm">
      <h3 className="text-sm sm:text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">{type} Trends (Top 5 + Others)</h3>
      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer>
          <BarChart data={yearlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="year" tick={{ fill: TICK_COLOR, fontSize: 10 }} />
            <YAxis tickFormatter={v => v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : String(v)} tick={{ fill: TICK_COLOR, fontSize: 10 }} width={36} />
            <Tooltip content={<CustomTooltip formatCurrency={formatCurrency} />} />
            <Legend />
            {topCategories.map((cat, i) => (
              <Bar key={cat} dataKey={cat} stackId="a" name={cat} fill={colors[i % colors.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ─── Trends View ─────────────────────────────────────────────
export const TrendsView = ({ data }: { data?: Transaction[] }) => {
  useEffect(() => { logEvent(EVENTS.FEATURE_TRENDS_OPENED); }, []);
  const { transactions, currency, plan } = useApp();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const TICK_COLOR = isDark ? '#94a3b8' : '#64748b';

  const txns = data ?? transactions;

  const trendData = useMemo(() => {
    const trendMap = new Map<string, { income: number; expenses: number; date: Date }>();
    txns.forEach(t => {
      const date = new Date(t.date + 'T00:00:00');
      date.setDate(1);
      const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      if (!trendMap.has(monthKey)) trendMap.set(monthKey, { income: 0, expenses: 0, date });
      const monthTotals = trendMap.get(monthKey)!;
      if (t.type === 'Income') monthTotals.income += t.amount;
      else if (t.type === 'Expense') monthTotals.expenses += t.amount;
    });
    return Array.from(trendMap.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map(d => ({
        ...d,
        month: `${d.date.toLocaleString('default', { month: 'short' })} '${d.date.getFullYear().toString().slice(2)}`,
      }));
  }, [txns]);

  if (!canAccessFeature(plan, 'trend_analysis')) {
    return <UpgradePrompt feature="Trend Analysis" description="See how your spending patterns change over time" />;
  }

  const fmtCurrency = (v: number) => formatAmount(v, currency);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Overall Income vs Expense Trends – Line Chart */}
      <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl shadow-sm">
        <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Overall Income vs Expense Trends</h3>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fill: TICK_COLOR, fontSize: 10 }} />
              <YAxis tickFormatter={v => v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : String(v)} tick={{ fill: TICK_COLOR, fontSize: 10 }} width={38} />
              <Tooltip content={<CustomTooltip formatCurrency={fmtCurrency} />} />
              <Legend />
              <Line type="monotone" dataKey="income" name="Income" stroke={COLORS.income.dark} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="expenses" name="Expenses" stroke={COLORS.expense.dark} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Income & Expense Trend by Category – Stacked Bar Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryTrendChart data={txns} type="Income" formatCurrency={fmtCurrency} />
        <CategoryTrendChart data={txns} type="Expense" formatCurrency={fmtCurrency} />
      </div>
    </div>
  );
};
