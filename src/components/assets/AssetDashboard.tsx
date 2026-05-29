import React, { useMemo, useState } from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { AssetSnapshot, NetAssetConfig } from '@/types/assets';
import { computeMonthlyNetWorth, computeCategoryReturns } from '@/services/assetStorage';
import { formatAmount } from '@/utils/constants';
import type { Currency } from '@/types';

const CHART_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6'];

interface Props {
  snapshots: AssetSnapshot[];
  config: NetAssetConfig;
  currency: Currency;
}

export const AssetDashboard: React.FC<Props> = ({ snapshots, config, currency }) => {
  const [ownerFilter, setOwnerFilter] = useState<string>('All');

  const filtered = useMemo(() =>
    ownerFilter === 'All' ? snapshots : snapshots.filter(s => s.owner === ownerFilter),
    [snapshots, ownerFilter]
  );

  const monthly = useMemo(() => computeMonthlyNetWorth(filtered), [filtered]);
  const catReturns = useMemo(() => computeCategoryReturns(filtered), [filtered]);
  const latest = monthly[monthly.length - 1];
  const prev = monthly[monthly.length - 2];
  const first = monthly[0];
  const owners = [...new Set(snapshots.map(s => s.owner))];

  if (!latest) {
    return (
      <div className="text-center py-16 text-slate-400">
        <p className="text-lg mb-2">No asset data yet</p>
        <p className="text-sm">Add your first monthly snapshot to see your dashboard</p>
      </div>
    );
  }

  const fmt = (n: number) => formatAmount(n, currency);
  const pct = (n: number) => (n * 100).toFixed(1) + '%';
  const fmtDate = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  };

  // Chart data
  const trendData = monthly.map(m => ({
    date: fmtDate(m.date),
    total: Math.round(m.totalCurrentValue),
    principal: Math.round(m.totalPrincipal),
    gains: Math.round(m.totalGain),
    ...Object.fromEntries(Object.entries(m.byOwner).map(([k, v]) => [k, Math.round(v.currentValue)])),
  }));

  const tierData = latest ? Object.entries(latest.byTier).map(([name, vals]) => ({
    name,
    value: Math.round(vals.currentValue),
    principal: Math.round(vals.principal),
  })) : [];

  const momChange = prev ? latest.totalCurrentValue - prev.totalCurrentValue : 0;
  const sinceInception = first ? (latest.totalCurrentValue - first.totalCurrentValue) / first.totalCurrentValue : 0;

  return (
    <div className="space-y-6">
      {/* Owner Filter */}
      {owners.length > 1 && (
        <div className="flex gap-2">
          <button onClick={() => setOwnerFilter('All')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${ownerFilter === 'All' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            Household
          </button>
          {owners.map(o => (
            <button key={o} onClick={() => setOwnerFilter(o)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${ownerFilter === o ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {o}
            </button>
          ))}
        </div>
      )}

      {/* Hero Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="card p-4 col-span-2 lg:col-span-1 bg-gradient-to-br from-brand-600 to-purple-600 text-white">
          <p className="text-xs text-brand-200 uppercase tracking-wider">Net Worth</p>
          <p className="text-2xl font-extrabold mt-1">{fmt(latest.totalCurrentValue)}</p>
          <p className="text-xs text-brand-200 mt-1">{fmtDate(latest.date)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-slate-500 uppercase tracking-wider">MoM Change</p>
          <p className={`text-xl font-bold ${momChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {momChange >= 0 ? '+' : ''}{fmt(momChange)}
          </p>
          <p className="text-xs text-slate-400">{pct(latest.momChange)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Total Invested</p>
          <p className="text-xl font-bold text-slate-800">{fmt(latest.totalPrincipal)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Total Gains</p>
          <p className={`text-xl font-bold ${latest.totalGain >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {latest.totalGain >= 0 ? '+' : ''}{fmt(latest.totalGain)}
          </p>
          <p className="text-xs text-slate-400">Return: {pct(latest.gainPercent)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Since Inception</p>
          <p className={`text-xl font-bold ${sinceInception >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {pct(sinceInception)}
          </p>
          <p className="text-xs text-slate-400">from {fmtDate(first.date)}</p>
        </div>
      </div>

      {/* Owner Split (if household view) */}
      {ownerFilter === 'All' && owners.length > 1 && latest.byOwner && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(latest.byOwner).map(([name, vals]) => (
            <div key={name} className="card p-4">
              <p className="text-xs text-slate-500">{name}</p>
              <p className="text-lg font-bold text-slate-800">{fmt(vals.currentValue)}</p>
              <p className="text-xs text-slate-400">
                {pct(vals.currentValue / latest.totalCurrentValue)} of household
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Net Worth Timeline */}
      <div className="card p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-4">Net Worth Timeline</h3>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : v} />
            <Tooltip formatter={(v: number) => fmt(v)} />
            <Legend />
            <Area type="monotone" dataKey="total" name="Current Value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} strokeWidth={2} />
            <Area type="monotone" dataKey="principal" name="Invested" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.08} strokeWidth={1.5} strokeDasharray="4 4" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Owner Lines (if multi-owner) */}
      {ownerFilter === 'All' && owners.length > 1 && (
        <div className="card p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Individual Growth</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : v} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend />
              {owners.map((o, i) => (
                <Line key={o} type="monotone" dataKey={o} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Accessibility Waterfall */}
        <div className="card p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Accessibility Breakdown</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={tierData} cx="50%" cy="50%" outerRadius={100} innerRadius={55} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {tierData.map((_, i) => <Cell key={i} fill={config.tiers[i]?.color || CHART_COLORS[i]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => fmt(v)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {tierData.map((t, i) => (
              <div key={t.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: config.tiers[i]?.color || CHART_COLORS[i] }} />
                  <span className="text-slate-600">{t.name}</span>
                </div>
                <span className="font-medium text-slate-800">{fmt(t.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Category Returns */}
        <div className="card p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Returns by Category</h3>
          <div className="space-y-3">
            {catReturns.map((cr) => {
              const pctWidth = Math.min(Math.abs(cr.returnPercent) * 100, 100);
              const isPositive = cr.returnPercent >= 0;
              return (
                <div key={cr.category}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-600 truncate">{cr.category}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">{fmt(cr.currentValue)}</span>
                      <span className={`text-xs font-bold min-w-[60px] text-right ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                        {isPositive ? '+' : ''}{pct(cr.returnPercent)}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${isPositive ? 'bg-green-400' : 'bg-red-400'}`} style={{ width: `${pctWidth}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Gains Attribution */}
      {prev && (
        <div className="card p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-1">Gains Attribution — Last Month</h3>
          <p className="text-xs text-slate-400 mb-4">Where did the {momChange >= 0 ? 'growth' : 'change'} come from?</p>
          <div className="space-y-2">
            {catReturns.map(cr => {
              const prevEntry = computeCategoryReturns(filtered, prev.date).find(p => p.category === cr.category);
              const prevVal = prevEntry?.currentValue || 0;
              const principalDelta = cr.principal - (prevEntry?.principal || 0);
              const marketDelta = (cr.currentValue - prevVal) - principalDelta;
              return (
                <div key={cr.category} className="flex items-center gap-4 text-sm">
                  <span className="w-32 truncate text-slate-600">{cr.category}</span>
                  <div className="flex-1 flex gap-4 items-center">
                    {principalDelta !== 0 && (
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600">
                        New money: {principalDelta >= 0 ? '+' : ''}{fmt(principalDelta)}
                      </span>
                    )}
                    {marketDelta !== 0 && (
                      <span className={`text-xs px-2 py-0.5 rounded ${marketDelta >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                        Market: {marketDelta >= 0 ? '+' : ''}{fmt(marketDelta)}
                      </span>
                    )}
                  </div>
                  <span className={`text-xs font-bold ${cr.momChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {cr.momChange >= 0 ? '+' : ''}{pct(cr.momChange)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MoM Change Trend */}
      <div className="card p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-4">Monthly Growth Rate</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthly.slice(1).map(m => ({ date: fmtDate(m.date), change: +(m.momChange * 100).toFixed(2) }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v + '%'} />
            <Tooltip formatter={(v: number) => v.toFixed(2) + '%'} />
            <Bar dataKey="change" name="MoM %" radius={[4, 4, 0, 0]}>
              {monthly.slice(1).map((m, i) => (
                <Cell key={i} fill={m.momChange >= 0 ? '#22c55e' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
