import { useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/UIContext';
import type { Transaction } from '@/types';
import { formatAmount, COLORS } from '@/utils/constants';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

// ─── Rich Yearly Tooltip showing top‑5 category breakdowns ──
const YearlyTooltip = ({ active, payload, label, formatCurrency }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 text-sm z-50 min-w-[200px]">
      <p className="font-bold text-slate-800 dark:text-slate-100 mb-3 border-b border-slate-100 dark:border-slate-700 pb-1 text-base">{label}</p>
      {payload.map((pld: any, index: number) => {
        const breakdown = pld.payload[pld.dataKey === 'income' ? 'incomeBreakdown' : 'expenseBreakdown'] || [];
        return (
          <div key={index} className="mb-4 last:mb-0">
            <div className="flex items-center justify-between gap-4 mb-2">
              <span style={{ color: pld.fill }} className="font-bold text-base">{pld.name} Total</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{formatCurrency(pld.value)}</span>
            </div>
            {breakdown.length > 0 && (
              <div className="pl-2 border-l-2 border-slate-100 dark:border-slate-700 space-y-1">
                <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Top Categories</p>
                {breakdown.slice(0, 5).map((item: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                    <span>{item.name}</span>
                    <span>{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const formatPercent = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v);

export const YearlyView = ({ data }: { data?: Transaction[] }) => {
  const { transactions, currency } = useApp();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const TICK_COLOR = isDark ? '#94a3b8' : '#64748b';
  const txns = data ?? transactions;

  const yearlyData = useMemo(() => {
    const yearMap = new Map<number, { income: number; expenses: number; incomeBreakdown: any[]; expenseBreakdown: any[] }>();
    const breakdownMap = new Map<number, { income: Map<string, number>; expenses: Map<string, number> }>();

    txns.forEach(t => {
      const year = new Date(t.date + 'T00:00:00').getFullYear();
      if (!yearMap.has(year)) {
        yearMap.set(year, { income: 0, expenses: 0, incomeBreakdown: [], expenseBreakdown: [] });
        breakdownMap.set(year, { income: new Map(), expenses: new Map() });
      }
      const yTotals = yearMap.get(year)!;
      const yBreakdown = breakdownMap.get(year)!;

      if (t.type === 'Income') {
        yTotals.income += t.amount;
        yBreakdown.income.set(t.category, (yBreakdown.income.get(t.category) || 0) + t.amount);
      } else if (t.type === 'Expense') {
        yTotals.expenses += t.amount;
        yBreakdown.expenses.set(t.category, (yBreakdown.expenses.get(t.category) || 0) + t.amount);
      }
    });

    return Array.from(yearMap.entries())
      .map(([year, totals]) => {
        const bd = breakdownMap.get(year)!;
        const getTop5 = (m: Map<string, number>) => Array.from(m.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5);
        return {
          year: year.toString(),
          ...totals,
          incomeBreakdown: getTop5(bd.income),
          expenseBreakdown: getTop5(bd.expenses),
        };
      })
      .sort((a, b) => parseInt(a.year) - parseInt(b.year));
  }, [txns]);

  const tableData = useMemo(() =>
    yearlyData.map(y => ({
      ...y,
      net: y.income - y.expenses,
      savingsRate: y.income > 0 ? (y.income - y.expenses) / y.income : 0,
    })).reverse()
  , [yearlyData]);

  const fmtCurrency = (v: number) => formatAmount(v, currency);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Yearly Income vs. Expenses</h3>
        <div style={{ width: '100%', height: 400 }}>
          <ResponsiveContainer>
            <BarChart data={yearlyData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="year" tick={{ fill: TICK_COLOR, fontSize: 12 }} />
              <YAxis tickFormatter={fmtCurrency} tick={{ fill: TICK_COLOR, fontSize: 12 }} />
              <Tooltip content={<YearlyTooltip formatCurrency={fmtCurrency} />} />
              <Legend />
              <Bar dataKey="income" fill={COLORS.income.dark} name="Income" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" fill={COLORS.expense.dark} name="Expenses" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Yearly Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
            <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-700">
              <tr>
                <th className="px-6 py-3">Year</th>
                <th className="px-6 py-3 text-right">Income</th>
                <th className="px-6 py-3 text-right">Expenses</th>
                <th className="px-6 py-3 text-right">Net Savings</th>
                <th className="px-6 py-3 text-right">Savings Rate</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map(row => (
                <tr key={row.year} className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                  <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">{row.year}</td>
                  <td className="px-6 py-4 text-right text-green-600">{fmtCurrency(row.income)}</td>
                  <td className="px-6 py-4 text-right text-red-600">{fmtCurrency(row.expenses)}</td>
                  <td className={`px-6 py-4 text-right font-semibold ${row.net >= 0 ? 'text-slate-800 dark:text-slate-100' : 'text-red-600'}`}>{fmtCurrency(row.net)}</td>
                  <td className="px-6 py-4 text-right">{formatPercent(row.savingsRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
