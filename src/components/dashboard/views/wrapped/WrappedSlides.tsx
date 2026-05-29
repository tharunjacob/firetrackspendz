import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { COLORS } from '@/utils/constants';
import type { WrappedStats } from '@/types';
import { logEvent, EVENTS } from '@/services/logger';
import { useTheme } from '@/contexts/UIContext';

const StatCard = ({ label, value, sub, accent }: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) => (
  <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm flex flex-col">
    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</span>
    <span className={`text-2xl sm:text-3xl font-bold ${accent || 'text-slate-800 dark:text-slate-100'} leading-tight`}>{value}</span>
    {sub && <span className="text-sm text-slate-500 dark:text-slate-400 mt-1">{sub}</span>}
  </div>
);

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 text-sm">
      <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">{label}</p>
      <p className="text-brand-600 font-mono">{payload[0].value.toFixed(1)}%</p>
    </div>
  );
};

interface Props {
  stats: WrappedStats;
  isPro: boolean;
  fmt: (v: number) => string;
}

export const WrappedSlides = ({ stats, isPro, fmt }: Props) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const GRID_COLOR = isDark ? '#334155' : '#e2e8f0';
  return (
  <>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard label="Total Income" value={fmt(stats.totalIncome)} accent="text-emerald-600" />
      <StatCard label="Total Expenses" value={fmt(stats.totalExpenses)} accent="text-red-500" />
      <StatCard
        label="Savings Rate"
        value={`${stats.savingsRate.toFixed(1)}%`}
        sub={`${fmt(stats.netSavings)} saved`}
        accent={stats.savingsRate >= 20 ? 'text-emerald-600' : stats.savingsRate >= 0 ? 'text-amber-600' : 'text-red-500'}
      />
    </div>

    {!isPro && (
      <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-brand-100 dark:bg-brand-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-brand-600">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Upgrade to Pro for Your Full Year Review</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-5">
          See your top spending categories, best and worst months, monthly savings trends,
          biggest expense, recurring costs, and generate a shareable year review card.
        </p>
        <button
          onClick={() => logEvent(EVENTS.PAYWALL_CTA_CLICKED, { source: 'wrapped_view' })}
          className="bg-brand-600 hover:bg-brand-700 text-white font-semibold px-8 py-3 rounded-lg transition-all shadow-md hover:shadow-md text-sm"
        >
          Upgrade to Pro
        </button>
      </div>
    )}

    {isPro && (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm flex flex-col items-center justify-center">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Net Savings</span>
            <span className={`text-4xl font-bold ${stats.netSavings >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {fmt(stats.netSavings)}
            </span>
            <span className="text-sm text-slate-500 dark:text-slate-400 mt-1">Income minus Expenses</span>
          </div>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm flex flex-col items-center justify-center">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Top Spending Category</span>
            <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stats.topCategory.name}</span>
            <span className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {fmt(stats.topCategory.amount)} ({stats.topCategory.pct.toFixed(1)}% of expenses)
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Monthly Savings Rate</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.monthlySavingsRates} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                  domain={['auto', 'auto']}
                />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke={COLORS.brand}
                  strokeWidth={2.5}
                  dot={{ fill: COLORS.brand, r: 4 }}
                  activeDot={{ r: 6, fill: COLORS.brand }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Best Month</span>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.bestMonth.month}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Saved {fmt(stats.bestMonth.savings)}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Worst Month</span>
            <p className="text-2xl font-bold text-red-500 mt-1">{stats.worstMonth.month}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {stats.worstMonth.savings >= 0 ? `Saved ${fmt(stats.worstMonth.savings)}` : `Overspent by ${fmt(Math.abs(stats.worstMonth.savings))}`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Biggest Single Expense</span>
            <p className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1">{fmt(stats.biggestExpense.amount)}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate" title={stats.biggestExpense.notes}>
              {stats.biggestExpense.notes}
            </p>
            {stats.biggestExpense.date && (
              <p className="text-xs text-slate-400 mt-0.5">{stats.biggestExpense.date}</p>
            )}
          </div>
          <StatCard
            label="Recurring Annual"
            value={fmt(stats.recurringTotal)}
            sub="Auto-pay & subscriptions"
            accent="text-brand-600"
          />
          <StatCard
            label="Total Transactions"
            value={stats.totalTransactions.toLocaleString()}
            accent="text-brand-600"
          />
          <StatCard
            label="Unique Merchants"
            value={stats.uniqueMerchants.toLocaleString()}
            accent="text-cyan-600"
          />
        </div>
      </>
    )}
  </>
  );
};
