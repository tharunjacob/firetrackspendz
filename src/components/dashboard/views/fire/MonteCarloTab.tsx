import { useMemo, useState, useEffect, useCallback } from 'react';
import type { Currency, MonteCarloResult } from '@/types';
import { formatAmount } from '@/utils/constants';
import { runMonteCarloSimulation } from '@/services/monteCarlo';
import { calculateFireMetrics } from '@/services/analysis';
import {
  ResponsiveContainer, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { InfoTooltip } from './shared';
import { useTheme } from '@/contexts/UIContext';

const MC_PRESETS = [
  { label: 'Conservative', expectedReturn: 6, returnStdDev: 10 },
  { label: 'Moderate', expectedReturn: 8, returnStdDev: 15 },
  { label: 'Aggressive', expectedReturn: 10, returnStdDev: 20 },
] as const;

interface Props {
  fire: ReturnType<typeof calculateFireMetrics>;
  currency: Currency;
  multiplier: number;
  netWorthTotal: number | null;
}

export const MonteCarloTab = ({ fire, currency, multiplier: _multiplier, netWorthTotal }: Props) => {
  const [params, setParams] = useState({
    currentSavings: netWorthTotal ?? 0,
    monthlyContribution: Math.max(0, Math.round(fire.avgMonthlyExpense * 0.3)),
    yearsToRetirement: 20,
    yearsInRetirement: 30,
    withdrawalRate: 4,
    expectedReturn: 8,
    returnStdDev: 15,
    inflationRate: fire.personalInflation * 100 || 6,
  });
  const [result, setResult] = useState<MonteCarloResult | null>(null);
  const [running, setRunning] = useState(false);

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const GRID_COLOR    = isDark ? '#334155' : '#f1f5f9';
  const BAND_FILL_1   = isDark ? 'rgba(59,130,246,0.12)' : '#dbeafe';
  const BAND_FILL_2   = isDark ? 'rgba(59,130,246,0.08)' : '#bfdbfe';
  const MEDIAN_STROKE = isDark ? '#60a5fa' : '#3b82f6';

  useEffect(() => {
    if (netWorthTotal !== null) {
      setParams(prev => prev.currentSavings === 0 ? { ...prev, currentSavings: netWorthTotal } : prev);
    }
  }, [netWorthTotal]);

  const runSim = useCallback(() => {
    setRunning(true);
    setTimeout(() => {
      const r = runMonteCarloSimulation(params, 1000);
      setResult(r);
      setRunning(false);
    }, 50);
  }, [params]);

  const set = useCallback((key: string, val: number) =>
    setParams(prev => ({ ...prev, [key]: val })), []);

  const applyPreset = useCallback((preset: typeof MC_PRESETS[number]) => {
    setParams(prev => ({ ...prev, expectedReturn: preset.expectedReturn, returnStdDev: preset.returnStdDev }));
  }, []);

  const chartData = useMemo(() => {
    if (!result) return [];
    const total = params.yearsToRetirement + params.yearsInRetirement;
    return Array.from({ length: total + 1 }, (_, i) => ({
      year: i,
      p10: result.percentiles.p10[i],
      p25: result.percentiles.p25[i],
      p50: result.percentiles.p50[i],
      p75: result.percentiles.p75[i],
      p90: result.percentiles.p90[i],
    }));
  }, [result, params]);

  const successInterpretation = (rate: number) => {
    if (rate >= 90) return 'Your plan has a high chance of lasting through retirement.';
    if (rate >= 70) return 'Your plan has a moderate chance of lasting through retirement.';
    return 'Your plan has a low chance of lasting through retirement — consider adjusting your inputs.';
  };

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Simulation Parameters</h3>
          <div className="flex gap-2">
            {MC_PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                  params.expectedReturn === p.expectedReturn && params.returnStdDev === p.returnStdDev
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-brand-400 hover:text-brand-600'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { key: 'currentSavings', label: 'Current Portfolio', step: 50000 },
            { key: 'monthlyContribution', label: 'Monthly Contribution', step: 5000 },
            { key: 'yearsToRetirement', label: 'Years to Retirement', step: 1 },
            { key: 'yearsInRetirement', label: 'Years in Retirement', step: 1 },
            { key: 'withdrawalRate', label: 'Withdrawal Rate (%)', step: 0.25 },
            { key: 'expectedReturn', label: 'Expected Return (%)', step: 0.5 },
            {
              key: 'returnStdDev',
              label: 'Market Volatility (%)',
              step: 1,
              tooltip: 'How much markets fluctuate year to year. 15% is typical for a stock-heavy portfolio.',
            },
            { key: 'inflationRate', label: 'Inflation Rate (%)', step: 0.5 },
          ].map(({ key, label, step, tooltip }) => (
            <div key={key}>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center mb-1">
                {label}
                {tooltip && <InfoTooltip text={tooltip} />}
              </label>
              <input
                type="number" step={step}
                value={params[key as keyof typeof params]}
                onChange={e => set(key, Number(e.target.value))}
                className="input-field w-full text-sm"
              />
              {key === 'currentSavings' && netWorthTotal !== null && (
                <p className="text-xs text-brand-600 mt-0.5">
                  Net worth: {formatAmount(Math.round(netWorthTotal), currency)}
                </p>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={runSim}
          disabled={running}
          className="mt-5 px-6 py-2.5 bg-brand-600 text-white rounded-lg font-medium text-sm hover:bg-brand-700 transition-colors disabled:opacity-50"
        >
          {running ? 'Running 1,000 simulations...' : 'Run Monte Carlo Simulation'}
        </button>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`card p-6 border-l-4 ${
              result.successRate >= 90 ? 'border-l-green-500' :
              result.successRate >= 70 ? 'border-l-amber-500' :
              'border-l-red-500'
            }`}>
              <p className="text-xs text-slate-400 uppercase font-bold mb-1">Success Rate</p>
              <p className={`text-4xl font-black ${
                result.successRate >= 90 ? 'text-green-600' :
                result.successRate >= 70 ? 'text-amber-600' : 'text-red-600'
              }`}>{result.successRate}%</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                of 1,000 simulations survived {params.yearsInRetirement} years of retirement
              </p>
              <p className={`text-xs font-medium mt-2 ${
                result.successRate >= 90 ? 'text-green-600' :
                result.successRate >= 70 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {successInterpretation(result.successRate)}
              </p>
            </div>
            <div className="card p-6">
              <p className="text-xs text-slate-400 uppercase font-bold mb-1">Median Ending Balance</p>
              <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{formatAmount(result.medianEndingBalance, currency)}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">50th percentile after {params.yearsToRetirement + params.yearsInRetirement} years</p>
            </div>
            <div className="card p-6">
              <p className="text-xs text-slate-400 uppercase font-bold mb-1">
                {result.failureYear ? 'Avg Failure Year' : 'No Failures Detected'}
              </p>
              <p className="text-2xl font-black text-slate-800 dark:text-slate-100">
                {result.failureYear ? `Year ${result.failureYear}` : 'N/A'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {result.failureYear
                  ? `Portfolio depleted around year ${result.failureYear} in failed simulations`
                  : 'All simulations had sufficient funds'}
              </p>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">Portfolio Projection — Percentile Bands</h3>
            <div className="text-xs text-slate-400 mb-2 flex gap-4">
              <span><span className="inline-block w-3 h-3 bg-brand-100 mr-1 rounded" />10th–90th percentile</span>
              <span><span className="inline-block w-3 h-3 bg-brand-200 mr-1 rounded" />25th–75th percentile</span>
              <span><span className="inline-block w-3 h-3 bg-brand-500 mr-1 rounded" />Median (50th)</span>
              <span className="text-red-400">| Year {params.yearsToRetirement} = Retirement</span>
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                <XAxis dataKey="year" tick={{ fontSize: 10 }} label={{ value: 'Year', position: 'insideBottom', offset: -5, fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => v >= 1e7 ? `${(v / 1e7).toFixed(0)}Cr` : v >= 1e5 ? `${(v / 1e5).toFixed(0)}L` : `${(v / 1e3).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => formatAmount(Math.round(v as number), currency)} labelFormatter={(l: string) => `Year ${l}`} />
                <Area dataKey="p90" stroke="none" fill={BAND_FILL_1} fillOpacity={0.5} name="90th pct" />
                <Area dataKey="p75" stroke="none" fill={BAND_FILL_2} fillOpacity={0.6} name="75th pct" />
                <Area dataKey="p25" stroke="none" fill={BAND_FILL_2} fillOpacity={0} name="25th pct" />
                <Area dataKey="p10" stroke="none" fill={BAND_FILL_1} fillOpacity={0} name="10th pct" />
                <Line dataKey="p50" stroke={MEDIAN_STROKE} strokeWidth={2} dot={false} name="Median" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-6 bg-slate-50 dark:bg-slate-700/50">
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">What does this mean?</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {result.successRate >= 90
                ? `Your plan has a ${result.successRate}% chance of success — this is excellent. The classic 4% withdrawal rule aims for ~95% success over 30 years. You're in great shape.`
                : result.successRate >= 70
                ? `Your plan has a ${result.successRate}% success rate. Consider reducing your withdrawal rate or increasing your savings to improve the odds. Aim for 90%+ for confidence.`
                : `Your plan only succeeds ${result.successRate}% of the time. This is risky. Consider: (1) saving more per month, (2) lowering your withdrawal rate, (3) extending your working years, or (4) building part-time income in retirement.`}
            </p>
          </div>
        </>
      )}
    </div>
  );
};
