import { useMemo, useState, useRef, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/UIContext';
import type { Transaction } from '@/types';
import { formatAmount, COLORS } from '@/utils/constants';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

const formatPercent = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v);

// ─── Rich Monthly Tooltip (Top 5 Categories) ────────────────
const MonthlyTooltip = ({ active, payload, label, formatCurrency }: any) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  const incomeTop = data.incomeBreakdown || [];
  const expenseTop = data.expenseBreakdown || [];

  return (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 text-sm z-50 min-w-[280px]">
      <p className="font-bold text-slate-800 dark:text-slate-100 mb-2 border-b border-slate-100 dark:border-slate-700 pb-1 text-base">{label}</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-bold text-green-600 mb-1 uppercase">Income (Top 5)</p>
          <p className="font-mono font-bold mb-1 dark:text-slate-100">{formatCurrency(data.income)}</p>
          {incomeTop.slice(0, 5).map((cat: any, i: number) => (
            <div key={i} className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="truncate max-w-[100px]">{cat.name}</span>
              <span>{formatCurrency(cat.value)}</span>
            </div>
          ))}
        </div>
        <div>
          <p className="text-xs font-bold text-red-600 mb-1 uppercase">Expense (Top 5)</p>
          <p className="font-mono font-bold mb-1 dark:text-slate-100">{formatCurrency(data.expenses)}</p>
          {expenseTop.slice(0, 5).map((cat: any, i: number) => (
            <div key={i} className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="truncate max-w-[100px]">{cat.name}</span>
              <span>{formatCurrency(cat.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const MonthlyView = ({ data }: { data?: Transaction[] }) => {
  const { transactions, currency } = useApp();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const GRID_COLOR   = isDark ? '#334155' : '#e2e8f0';
  const TICK_COLOR   = isDark ? '#94a3b8' : '#64748b';
  const CURSOR_COLOR = isDark ? 'rgba(148,163,184,0.1)' : 'rgba(241,245,249,0.8)';
  const txns = data ?? transactions;
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const monthlyData = useMemo(() => {
    const monthMap = new Map<string, { income: number; expenses: number; date: Date; label: string; incomeBreakdown: any[]; expenseBreakdown: any[] }>();
    const breakdownMap = new Map<string, { income: Map<string, number>; expenses: Map<string, number> }>();

    txns.forEach(t => {
      const date = new Date(t.date + 'T00:00:00');
      date.setDate(1);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const label = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;

      if (!monthMap.has(key)) {
        monthMap.set(key, { income: 0, expenses: 0, date, label, incomeBreakdown: [], expenseBreakdown: [] });
        breakdownMap.set(key, { income: new Map(), expenses: new Map() });
      }

      const monthTotals = monthMap.get(key)!;
      const monthBD = breakdownMap.get(key)!;

      if (t.type === 'Income') {
        monthTotals.income += t.amount;
        monthBD.income.set(t.category, (monthBD.income.get(t.category) || 0) + t.amount);
      } else if (t.type === 'Expense') {
        monthTotals.expenses += t.amount;
        monthBD.expenses.set(t.category, (monthBD.expenses.get(t.category) || 0) + t.amount);
      }
    });

    return Array.from(monthMap.values())
      .map(m => {
        const key = `${m.date.getFullYear()}-${m.date.getMonth()}`;
        const bd = breakdownMap.get(key)!;
        const getTop = (map: Map<string, number>) =>
          Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
        return { ...m, incomeBreakdown: getTop(bd.income), expenseBreakdown: getTop(bd.expenses) };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [txns]);

  // Scroll to the right (latest months) on load
  useEffect(() => {
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
      }
    }, 300);
  }, [monthlyData]);

  const tableData = useMemo(() =>
    monthlyData.map(y => ({
      ...y,
      net: y.income - y.expenses,
      savingsRate: y.income > 0 ? (y.income - y.expenses) / y.income : 0,
    })).reverse()
  , [monthlyData]);

  const [yearFilter, setYearFilter] = useState<string>('all');
  const years = useMemo(() => [...new Set(monthlyData.map(m => m.date.getFullYear().toString()))], [monthlyData]);

  const filteredTable = yearFilter === 'all' ? tableData : tableData.filter(r => r.date.getFullYear().toString() === yearFilter);

  const fmtCurrency = (v: number) => formatAmount(v, currency);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl shadow-sm">
        <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Monthly Income vs. Expenses</h3>
        <div className="flex h-[300px] sm:h-[400px] md:h-[500px] border border-slate-100 dark:border-slate-700 rounded-lg overflow-hidden">
          {/* Fixed Y-Axis */}
          <div className="w-[60px] sm:w-[80px] md:w-[100px] h-full bg-white dark:bg-slate-800 z-10 border-r border-slate-100 dark:border-slate-700 shadow-sm shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 20, bottom: 40 }}>
                <YAxis tickFormatter={v => v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : String(v)} tick={{ fill: TICK_COLOR, fontSize: 10 }} width={60} axisLine={false} tickLine={false} />
                <XAxis dataKey="label" hide />
                <Bar dataKey="income" fill="transparent" isAnimationActive={false} />
                <Bar dataKey="expenses" fill="transparent" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-x-auto" ref={scrollContainerRef} style={{ scrollbarWidth: 'thin' }}>
            <div style={{ width: `${Math.max(monthlyData.length * 60, 600)}px`, height: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_COLOR} />
                  <XAxis dataKey="label" tick={{ fill: TICK_COLOR, fontSize: 10 }} axisLine={false} tickLine={false} interval={0} height={36} />
                  <YAxis hide />
                  <Tooltip content={<MonthlyTooltip formatCurrency={fmtCurrency} />} cursor={{ fill: CURSOR_COLOR }} />
                  <Legend verticalAlign="top" align="right" iconType="circle" />
                  <Bar dataKey="income" fill={COLORS.income.dark} name="Income" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="expenses" fill={COLORS.expense.dark} name="Expenses" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">Monthly Summary</h3>
          <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200">
            <option value="all">All Years</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
            <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-700">
              <tr>
                <th className="px-3 sm:px-6 py-2 sm:py-3">Month</th>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-right">Income</th>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-right">Expenses</th>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-right">Net</th>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-right">Rate</th>
              </tr>
            </thead>
            <tbody>
              {filteredTable.map(row => (
                <tr key={row.label} className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                  <td className="px-3 sm:px-6 py-2 sm:py-4 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap text-xs sm:text-sm">{row.label}</td>
                  <td className="px-3 sm:px-6 py-2 sm:py-4 text-right text-green-600 text-xs sm:text-sm">{fmtCurrency(row.income)}</td>
                  <td className="px-3 sm:px-6 py-2 sm:py-4 text-right text-red-600 text-xs sm:text-sm">{fmtCurrency(row.expenses)}</td>
                  <td className={`px-3 sm:px-6 py-2 sm:py-4 text-right font-semibold text-xs sm:text-sm ${row.net >= 0 ? 'text-slate-800 dark:text-slate-100' : 'text-red-600'}`}>{fmtCurrency(row.net)}</td>
                  <td className="px-3 sm:px-6 py-2 sm:py-4 text-right text-xs sm:text-sm">{formatPercent(row.savingsRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
