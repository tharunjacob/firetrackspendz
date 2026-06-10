import { useMemo, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/UIContext';
import type { Transaction } from '@/types';
import { formatAmount, COLORS } from '@/utils/constants';
import { getMonthlyBreakdown, getDeepInsights, calculateFireMetrics, getMonthlySavingsRates } from '@/services/analysis';
import { MetricCard, type Tone } from '@/components/dashboard/MetricCard';
import { FIRE_MULTIPLIER } from './fire/shared';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from 'recharts';

// ─── Helpers ────────────────────────────────────────────────
const formatPercent = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v);

/** Group to top‑N + "Others" */
const groupTopN = (data: { name: string; value: number }[], n = 5) => {
  if (data.length <= n) return data;
  const topN = data.slice(0, n);
  const others = data.slice(n).reduce((s, i) => s + i.value, 0);
  if (others > 0) topN.push({ name: 'Others', value: others });
  return topN;
};

// ─── Donut Tooltip ───────────────────────────────────────────
const DonutTooltip = ({ active, payload, formatCurrency, total }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  const pct = total > 0 ? d.value / total : 0;
  return (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 text-sm z-50 min-w-[180px]">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-slate-700">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.payload.fill }} />
        <p className="font-bold text-slate-800 dark:text-slate-100 text-base">{d.name}</p>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Amount:</span><span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(d.value)}</span></div>
        <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Percentage:</span><span className="font-mono font-semibold text-brand-600">{formatPercent(pct)}</span></div>
      </div>
    </div>
  );
};

// ─── Donut Chart Card (matches live version) ────────────────
const DonutChartCard = ({ title, data, colors, formatCurrency }: {
  title: string; data: { name: string; value: number }[]; colors: string[]; formatCurrency: (v: number) => string;
}) => {
  const grouped = useMemo(() => groupTopN(data, 5), [data]);
  const total = useMemo(() => data.reduce((s, e) => s + e.value, 0), [data]);
  const chartData = useMemo(() => grouped.map((e, i) => ({ ...e, fill: colors[i % colors.length] })), [grouped, colors]);

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm h-full flex flex-col items-center justify-center min-h-[400px]">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2 text-center">{title}</h3>
        <p className="text-slate-500 text-sm text-center">Upload a statement to see your {title.toLowerCase()} breakdown here.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl shadow-sm h-full flex flex-col">
      <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 text-center">{title}</h3>
      <div className="flex-grow grid grid-cols-1 md:grid-cols-3 items-center min-h-[260px] md:min-h-[350px]">
        {/* Donut */}
        <div className="col-span-1 md:col-span-2 h-[220px] md:h-full relative">
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">{formatCurrency(total)}</span>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total</span>
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                innerRadius="60%" outerRadius="80%" paddingAngle={2}>
                {chartData.map((e, i) => <Cell key={i} fill={e.fill} stroke="#fff" strokeWidth={2} />)}
              </Pie>
              <Tooltip content={<DonutTooltip formatCurrency={formatCurrency} total={total} />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Legend */}
        <div className="col-span-1 flex flex-row md:flex-col flex-wrap md:flex-nowrap justify-center gap-3 pl-0 md:pl-4 md:border-l border-slate-100 dark:border-slate-700 pt-4 md:pt-0 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {chartData.map((e, i) => (
            <div key={i} className="flex items-center gap-2 text-sm w-full sm:w-auto md:w-full">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: e.fill }} />
              <div className="flex flex-col min-w-0">
                <span className="font-medium text-slate-700 dark:text-slate-200 truncate" title={e.name}>{e.name}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{formatCurrency(e.value)} ({formatPercent(e.value / total)})</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Bar Tooltip ─────────────────────────────────────────────
const CustomBarTooltip = ({ active, payload, label, currency }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-lg shadow-md px-4 py-3 text-xs">
      <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.fill || p.color }} />
          <span className="text-slate-500 dark:text-slate-400">{p.name}:</span>
          <span className="font-bold text-slate-800 dark:text-slate-100">{formatAmount(p.value, currency)}</span>
        </div>
      ))}
      {payload.length === 2 && (
        <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-700">
          <span className="text-slate-500 dark:text-slate-400">Net: </span>
          <span className={`font-bold ${payload[0].value - payload[1].value >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {formatAmount(payload[0].value - payload[1].value, currency)}
          </span>
        </div>
      )}
    </div>
  );
};

// ─── Rate Tooltip ────────────────────────────────────────────
const RateTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const rawRate = payload[0].payload.rawRate ?? payload[0].value;
  return (
    <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-lg shadow-md px-4 py-3 text-xs">
      <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1.5">{label}</p>
      <div className="flex items-center gap-2 py-0.5">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: payload[0].color || payload[0].fill }} />
        <span className="text-slate-500 dark:text-slate-400">Savings Rate:</span>
        <span className={`font-bold ${rawRate >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {rawRate.toFixed(1)}%
        </span>
      </div>
    </div>
  );
};

// ─── Summary View (matches live dashboard) ──────────────────
export const SummaryView = ({ data }: { data?: Transaction[] }) => {
  const { transactions, currency, setActiveTab } = useApp();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const GRID_COLOR = isDark ? '#334155' : '#e2e8f0';
  const txns = data ?? transactions;

  const categoryData = useMemo(() => {
    const incomeMap = new Map<string, number>();
    const expenseMap = new Map<string, number>();
    txns.forEach(t => {
      if (t.type === 'Income') incomeMap.set(t.category, (incomeMap.get(t.category) || 0) + t.amount);
      else if (t.type === 'Expense') expenseMap.set(t.category, (expenseMap.get(t.category) || 0) + t.amount);
    });
    const toArr = (m: Map<string, number>) =>
      Array.from(m.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    return { income: toArr(incomeMap), expense: toArr(expenseMap) };
  }, [txns]);

  const monthly = useMemo(() => getMonthlyBreakdown(txns), [txns]);
  const [chartMode, setChartMode] = useState<'absolute' | 'rate'>('absolute');
  const chartData = useMemo(() => getMonthlySavingsRates(monthly), [monthly]);

  const insights = useMemo(() => getDeepInsights(txns), [txns]);
  const multiplier = FIRE_MULTIPLIER[currency] || 25;
  const fire = useMemo(() => calculateFireMetrics(txns, multiplier), [txns, multiplier]);
  const last6Months = monthly.slice(-6);

  const fmtCurrency = (v: number) => formatAmount(v, currency);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Donut Charts – matches live version */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <DonutChartCard title="Income Sources" data={categoryData.income} colors={COLORS.categories} formatCurrency={fmtCurrency} />
        <DonutChartCard title="Top Expense Categories" data={categoryData.expense} colors={COLORS.categories} formatCurrency={fmtCurrency} />
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-xs text-slate-500 uppercase">Monthly Avg Expense</p>
          <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{fmtCurrency(fire.avgMonthlyExpense)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-slate-500 uppercase">Savings Rate</p>
          <p className={`text-xl font-bold ${(fire.savingsRate || 0) >= 20 ? 'text-green-600' : 'text-amber-600'}`}>
            {(fire.savingsRate || 0).toFixed(1)}%
          </p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-slate-500 uppercase">Personal Inflation</p>
          <p className="text-xl font-bold text-red-500">{(fire.personalInflation * 100).toFixed(1)}%</p>
        </div>
        <button
          type="button"
          className="stat-card text-left focus-ring cursor-pointer hover:ring-2 hover:ring-brand-400 hover:ring-offset-2 transition-shadow"
          onClick={() => setActiveTab('FIRE Calculator')}
        >
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">FIRE Number</p>
          <p className="text-xl font-bold text-brand-600">{fmtCurrency(fire.fireNumberCurrent)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Based on {multiplier}× annual expenses</p>
          <p className="text-xs text-brand-500 mt-1 font-medium">→ Full Analysis</p>
        </button>
      </div>

      {/* Insight Cards */}
      {insights.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {insights.map((insight, i) => {
            const tone: Tone = insight.trend === 'good' ? 'positive' : insight.trend === 'bad' ? 'negative' : 'warning';
            return (
              <MetricCard
                key={i}
                eyebrow={insight.title}
                value={insight.value}
                valueTone={tone}
                description={insight.description}
              />
            );
          })}
        </div>
      )}

      {/* Income vs Expense – Last 6 months */}
      <div className="card p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">Income vs Expenses (Last 6 Months)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={last6Months} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={m => m.slice(5)} />
            <YAxis tick={{ fontSize: 10 }} width={38} tickFormatter={v => v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : v} />
            <Tooltip content={<CustomBarTooltip currency={currency} />} />
            <Legend />
            <Bar dataKey="income" fill={COLORS.income.medium} radius={[4, 4, 0, 0]} name="Income" animationDuration={800} />
            <Bar dataKey="expense" fill={COLORS.expense.medium} radius={[4, 4, 0, 0]} name="Expense" animationDuration={1000} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Net Savings Trend */}
      <div className="card p-4 sm:p-5">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {chartMode === 'absolute' ? 'Net Savings Trend' : 'Savings Rate Trend'}
          </h3>
          <div className="flex bg-slate-100 dark:bg-slate-700 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setChartMode('absolute')}
              className={`px-3 py-1 rounded-md transition-all ${
                chartMode === 'absolute'
                  ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white font-semibold shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Absolute
            </button>
            <button
              onClick={() => setChartMode('rate')}
              className={`px-3 py-1 rounded-md transition-all ${
                chartMode === 'rate'
                  ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white font-semibold shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Savings Rate (%)
            </button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <defs>
              <linearGradient id="savingsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.brand} stopOpacity={0.15} />
                <stop offset="95%" stopColor={COLORS.brand} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={m => m.slice(5)} />
            {chartMode === 'absolute' ? (
              <YAxis tick={{ fontSize: 10 }} width={38} tickFormatter={v => v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : v} />
            ) : (
              <YAxis tick={{ fontSize: 10 }} width={38} domain={[-50, 100]} tickFormatter={v => `${v}%`} />
            )}
            <Tooltip content={chartMode === 'absolute' ? <CustomBarTooltip currency={currency} /> : <RateTooltip />} />
            <Legend />
            {chartMode === 'absolute' ? (
              <>
                <Line type="monotone" dataKey="savings" stroke={COLORS.brand} strokeWidth={2.5} dot={{ r: 3, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 2 }} name="Net Savings" animationDuration={1000} />
                <Line type="monotone" dataKey="expense" stroke={COLORS.expense.medium} strokeWidth={1.5} dot={false} strokeDasharray="4 4" name="Expense" animationDuration={1200} />
              </>
            ) : (
              <Line type="monotone" dataKey="rate" stroke={COLORS.brand} strokeWidth={2.5} dot={{ r: 3, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 2 }} name="Savings Rate" animationDuration={1000} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
