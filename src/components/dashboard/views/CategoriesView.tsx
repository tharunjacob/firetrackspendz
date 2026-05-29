import { useMemo, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/UIContext';
import { formatAmount, COLORS } from '@/utils/constants';
import { getCategoryBreakdown } from '@/services/analysis';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ShareCard } from '../ShareCard';
import { Icon } from '@/components/common/Icons';

export const CategoriesView = ({ data }: { data?: import('@/types').Transaction[] }) => {
  const { transactions, currency } = useApp();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const GRID_COLOR = isDark ? '#334155' : '#e2e8f0';
  const txns = data ?? transactions;
  const [viewType, setViewType] = useState<'Expense' | 'Income'>('Expense');
  const [showShareCard, setShowShareCard] = useState(false);

  const categories = useMemo(() => getCategoryBreakdown(txns, viewType), [txns, viewType]);
  const top5 = categories.slice(0, 5);
  const othersTotal = categories.slice(5).reduce((s, c) => s + c.value, 0);
  const pieData = othersTotal > 0 ? [...top5, { name: 'Others', value: othersTotal, percentage: 0 }] : top5;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Categories Analysis</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowShareCard(!showShareCard)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
              showShareCard ? 'bg-indigo-600 text-white' : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/50'
            }`}
          >
            <Icon name="share" className="w-4 h-4" /> Share
          </button>
          {(['Expense', 'Income'] as const).map(t => (
            <button key={t} onClick={() => setViewType(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewType === t ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {showShareCard && <ShareCard />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">Distribution</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} dataKey="value" paddingAngle={2}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS.categories[i % COLORS.categories.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => formatAmount(v, currency)} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">Top Categories</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={categories.slice(0, 10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : String(v)} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={72} />
              <Tooltip formatter={(v: number) => formatAmount(v, currency)} />
              <Bar dataKey="value" fill={viewType === 'Expense' ? COLORS.expense.medium : COLORS.income.medium} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Full Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Category</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Amount</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Share</th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 w-40">Bar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {categories.map((cat, i) => (
                <tr key={cat.name} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                  <td className="px-4 py-3 flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.categories[i % COLORS.categories.length] }} />
                    <span className="font-medium dark:text-slate-200">{cat.name}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold dark:text-slate-200">{formatAmount(cat.value, currency)}</td>
                  <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400">{cat.percentage.toFixed(1)}%</td>
                  <td className="px-4 py-3">
                    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                      <div className="h-2 rounded-full" style={{ width: `${cat.percentage}%`, backgroundColor: COLORS.categories[i % COLORS.categories.length] }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
