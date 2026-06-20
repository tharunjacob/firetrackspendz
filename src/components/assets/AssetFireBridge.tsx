import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { computeMonthlyNetWorth } from '@/services/assetStorage';
import { formatAmount } from '@/utils/constants';
import { useApp } from '@/contexts/AppContext';
import { calculateFireMetrics } from '@/services/analysis';
import { FIRE_MULTIPLIER } from '@/components/dashboard/views/fire/shared';
import type { AssetSnapshot, NetAssetConfig } from '@/types/assets';
import type { Currency } from '@/types';

interface Props {
  snapshots: AssetSnapshot[];
  config: NetAssetConfig;
  currency: Currency;
}

export const AssetFireBridge: React.FC<Props> = ({ snapshots, config: _config, currency }) => {
  const { transactions } = useApp();
  const monthly = useMemo(() => computeMonthlyNetWorth(snapshots), [snapshots]);
  const latest = monthly[monthly.length - 1];
  const multiplier = FIRE_MULTIPLIER[currency] || 25;
  const fire = useMemo(() => calculateFireMetrics(transactions, multiplier, currency), [transactions, multiplier, currency]);

  const fmt = (n: number) => formatAmount(n, currency);
  const pct = (n: number) => (n * 100).toFixed(1) + '%';

  if (!latest) {
    return (
      <div className="card p-8 text-center text-slate-500">
        <p className="text-lg mb-2">No asset data yet</p>
        <p className="text-sm">Add monthly snapshots to see FIRE projections with real asset data</p>
      </div>
    );
  }

  // Break down by accessibility
  const liquid = latest.byTier['Liquid'] || { principal: 0, currentValue: 0 };
  const investment = latest.byTier['Investment'] || { principal: 0, currentValue: 0 };
  const retirement = latest.byTier['Retirement'] || { principal: 0, currentValue: 0 };

  const accessibleAssets = liquid.currentValue + investment.currentValue;

  // FIRE calculation using actual assets
  const annualExpenses = fire.currentAnnualExpense || 0;
  const personalInflation = fire.personalInflation || 0.06;
  const freedomNumber = annualExpenses > 0 ? annualExpenses * 25 : 0;
  const fireProgress = freedomNumber > 0 ? (accessibleAssets / freedomNumber) * 100 : 0;

  // Months of runway (accessible assets / monthly expenses)
  const monthlyExpenses = annualExpenses / 12;
  const monthsRunway = monthlyExpenses > 0 ? Math.floor(accessibleAssets / monthlyExpenses) : 0;
  const yearsRunway = (monthsRunway / 12).toFixed(1);

  // Monthly savings rate from asset growth
  const assetGrowthRate = monthly.length >= 3
    ? monthly.slice(-6).reduce((sum, m) => sum + m.momChange, 0) / Math.min(monthly.length - 1, 5)
    : 0;

  // Projection: years to FIRE
  const projections = [];
  if (freedomNumber > 0 && accessibleAssets > 0) {
    let projected = accessibleAssets;
    const monthlyContribution = monthly.length >= 2
      ? (monthly[monthly.length - 1].totalPrincipal - monthly[monthly.length - 2].totalPrincipal)
      : 0;
    const annualReturn = assetGrowthRate * 12; // rough annual return from MoM growth

    for (let year = 1; year <= 25; year++) {
      projected = projected * (1 + Math.max(annualReturn, 0.06)) + monthlyContribution * 12;
      const adjustedFreedom = freedomNumber * Math.pow(1 + personalInflation, year);
      projections.push({
        year: `+${year}y`,
        assets: Math.round(projected),
        freedom: Math.round(adjustedFreedom),
        reached: projected >= adjustedFreedom,
      });
    }
  }

  const yearsToFire = projections.findIndex(p => p.reached);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="card p-6 bg-gradient-to-r from-orange-500 to-red-500 text-white">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-xs text-orange-200 uppercase tracking-wider">FIRE Progress</p>
            <p className="text-4xl font-bold mt-1">{fireProgress.toFixed(1)}%</p>
            <p className="text-sm text-orange-100 mt-1">
              {fmt(accessibleAssets)} of {fmt(freedomNumber)}
            </p>
          </div>
          <div>
            <p className="text-xs text-orange-200 uppercase tracking-wider">Years to FIRE</p>
            <p className="text-4xl font-bold mt-1">
              {yearsToFire >= 0 ? `~${yearsToFire + 1}` : freedomNumber > 0 ? '25+' : '—'}
            </p>
            <p className="text-sm text-orange-100 mt-1">at current growth + contributions</p>
          </div>
          <div>
            <p className="text-xs text-orange-200 uppercase tracking-wider">Runway</p>
            <p className="text-4xl font-bold mt-1">{yearsRunway} yrs</p>
            <p className="text-sm text-orange-100 mt-1">{monthsRunway} months at current expenses</p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-600">Path to Financial Independence</span>
          <span className="text-sm font-bold text-brand-600">{fireProgress.toFixed(1)}%</span>
        </div>
        <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-orange-400 to-green-500 rounded-full transition-all"
            style={{ width: `${Math.min(fireProgress, 100)}%` }} />
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-500">
          <span>0%</span>
          <span>25% — Coast FIRE</span>
          <span>50% — Lean FIRE</span>
          <span>100% — FIRE</span>
        </div>
      </div>

      {/* Accessibility breakdown for FIRE */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4 border-l-4 border-green-500">
          <p className="text-xs text-slate-500 uppercase">Liquid Assets</p>
          <p className="text-xl font-bold text-slate-800">{fmt(liquid.currentValue)}</p>
          <p className="text-xs text-slate-500">Emergency fund + cash — immediate access</p>
        </div>
        <div className="card p-4 border-l-4 border-brand-500">
          <p className="text-xs text-slate-500 uppercase">Investment Assets</p>
          <p className="text-xl font-bold text-slate-800">{fmt(investment.currentValue)}</p>
          <p className="text-xs text-slate-500">Accessible with effort — drives FIRE</p>
        </div>
        <div className="card p-4 border-l-4 border-amber-500">
          <p className="text-xs text-slate-500 uppercase">Retirement Assets</p>
          <p className="text-xl font-bold text-slate-800">{fmt(retirement.currentValue)}</p>
          <p className="text-xs text-slate-500">Locked — bonus at retirement age</p>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-xs text-slate-500">Annual Expenses</p>
          <p className="text-lg font-bold">{annualExpenses > 0 ? fmt(annualExpenses) : 'Upload statements'}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-slate-500">Freedom Number (25x)</p>
          <p className="text-lg font-bold text-brand-600">{freedomNumber > 0 ? fmt(freedomNumber) : '—'}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-slate-500">Personal Inflation</p>
          <p className="text-lg font-bold">{pct(personalInflation)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-slate-500">Avg Monthly Growth</p>
          <p className={`text-lg font-bold ${assetGrowthRate >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {pct(assetGrowthRate)}
          </p>
        </div>
      </div>

      {/* Projection chart */}
      {projections.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-4">FIRE Projection — Assets vs Freedom Number</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={projections.filter((_, i) => i % 2 === 0 || i < 10)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }}
                tickFormatter={v => v >= 1e7 ? (v / 1e7).toFixed(0) + 'Cr' : v >= 1e5 ? (v / 1e5).toFixed(0) + 'L' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : v.toString()} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Bar dataKey="assets" name="Projected Assets" radius={[4, 4, 0, 0]}>
                {projections.filter((_, i) => i % 2 === 0 || i < 10).map((p, i) => (
                  <Cell key={i} fill={p.reached ? '#22c55e' : '#2563eb'} />
                ))}
              </Bar>
              <Bar dataKey="freedom" name="Freedom Number" fill="#f59e0b" fillOpacity={0.3} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-slate-500 mt-2 text-center">
            Green bars = FIRE achieved. Projection uses {pct(Math.max(assetGrowthRate * 12, 0.06))} annual return and {pct(personalInflation)} inflation.
          </p>
        </div>
      )}

      {annualExpenses === 0 && (
        <div className="card p-6 bg-amber-50 border border-amber-200 text-center">
          <p className="text-amber-700 font-medium mb-1">Upload expense statements for accurate FIRE numbers</p>
          <p className="text-sm text-amber-600">
            The FIRE calculator needs your expense data to compute the freedom number.
            Go to the main dashboard and upload your bank/credit card statements.
          </p>
        </div>
      )}
    </div>
  );
};
