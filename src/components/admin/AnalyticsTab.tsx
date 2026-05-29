import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, LabelList,
} from 'recharts';
import {
  getFunnel, getCohortRetention, getFeatureAdoption,
  getRevenueMetrics, getSessionAnalytics, getDailyActiveUsers,
} from '@/services/analytics';
import type {
  FunnelStep, CohortRow, FeatureAdoptionRow,
  RevenueMetrics, SessionAnalytics, DAUPoint,
} from '@/types';

// ============================================================
// Analytics Tab — Phase 3
// Funnel · Cohort Retention · Feature Adoption · Sessions · Revenue
// ============================================================

// ── Date Range Picker ────────────────────────────────────────

type Preset = '7d' | '30d' | '90d' | 'custom';

interface DateRange { from: string; to: string }

const today    = () => new Date().toISOString().slice(0, 10);
const daysAgo  = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

const DateRangePicker = ({
  range, setRange,
}: { range: DateRange; setRange: (r: DateRange) => void }) => {
  const [preset, setPreset] = useState<Preset>('30d');

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p === '7d')  setRange({ from: daysAgo(7),  to: today() });
    if (p === '30d') setRange({ from: daysAgo(30), to: today() });
    if (p === '90d') setRange({ from: daysAgo(90), to: today() });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {(['7d','30d','90d'] as Preset[]).map(p => (
        <button key={p} onClick={() => applyPreset(p)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            preset === p ? 'bg-brand-600 text-white' : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'
          }`}>
          {p === '7d' ? 'Last 7 days' : p === '30d' ? 'Last 30 days' : 'Last 90 days'}
        </button>
      ))}
      <div className="flex items-center gap-1.5 ml-2">
        <input type="date" value={range.from}
          onChange={e => { setPreset('custom'); setRange({ ...range, from: e.target.value }); }}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600" />
        <span className="text-slate-400 text-xs">→</span>
        <input type="date" value={range.to}
          onChange={e => { setPreset('custom'); setRange({ ...range, to: e.target.value }); }}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600" />
      </div>
    </div>
  );
};

// ── Empty State ───────────────────────────────────────────────

const EmptyState = ({ label }: { label: string }) => (
  <div className="flex flex-col items-center justify-center py-10 text-slate-400">
    <div className="text-3xl mb-2">📭</div>
    <p className="text-sm">{label}</p>
    <p className="text-xs mt-1 text-slate-300">Connect Supabase to populate with real data</p>
  </div>
);

// ── Section wrapper ───────────────────────────────────────────

const Section = ({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode;
}) => (
  <div className="card p-5">
    <div className="mb-4">
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
    {children}
  </div>
);

// ── Stat card (mini) ──────────────────────────────────────────

const KPI = ({ label, value, sub, color = 'text-slate-800' }: {
  label: string; value: string | number; sub?: string; color?: string;
}) => (
  <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
    <p className="text-xs text-slate-400 dark:text-slate-400 uppercase tracking-wide">{label}</p>
    <p className={`text-2xl font-black mt-1 ${color}`}>{value}</p>
    {sub && <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">{sub}</p>}
  </div>
);

// ── 1. FUNNEL ─────────────────────────────────────────────────

const FunnelSection = ({ steps }: { steps: FunnelStep[] }) => {
  if (!steps.length) return <EmptyState label="No funnel data for this period" />;

  const maxUsers = steps[0]?.users || 1;
  const COLORS = ['#3b82f6','#6366f1','#8b5cf6','#a855f7','#c084fc','#e879f9'];

  return (
    <div className="space-y-2">
      {steps.map((s, i) => (
        <div key={s.step} className="flex items-center gap-3">
          <div className="w-36 text-right text-xs text-slate-500 shrink-0">{s.step}</div>
          <div className="flex-1 relative h-8 bg-slate-100 rounded-lg overflow-hidden">
            <div
              className="h-full rounded-lg transition-all duration-700 flex items-center pl-3"
              style={{
                width: `${Math.max((s.users / maxUsers) * 100, 2)}%`,
                backgroundColor: COLORS[i] || '#3b82f6',
              }}>
              <span className="text-white text-xs font-bold whitespace-nowrap">{s.users.toLocaleString()}</span>
            </div>
          </div>
          <div className="w-24 text-xs text-slate-400 shrink-0 text-right">
            {i === 0 ? '—' : (
              <span className={s.pct_of_prev < 50 ? 'text-red-500' : s.pct_of_prev < 75 ? 'text-amber-500' : 'text-green-500'}>
                {s.pct_of_prev}% prev
              </span>
            )}
          </div>
          <div className="w-16 text-xs font-semibold text-slate-600 shrink-0 text-right">
            {s.pct_of_top}%
          </div>
        </div>
      ))}
      <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-3">
        <KPI label="Top of Funnel" value={(steps[0]?.users || 0).toLocaleString()} sub="sessions" />
        <KPI label="Reached Upload" value={`${steps[2]?.pct_of_top || 0}%`} sub="of sessions" color="text-brand-600" />
        <KPI label="Upgrade Intent" value={`${steps[5]?.pct_of_top || 0}%`} sub="clicked upgrade" color="text-purple-600" />
      </div>
    </div>
  );
};

// ── 2. COHORT RETENTION ───────────────────────────────────────

const CohortSection = ({ rows }: { rows: CohortRow[] }) => {
  if (!rows.length) return <EmptyState label="No cohort data available yet" />;

  // Pivot: cohort_week → { week_num → retention_pct }
  const cohorts = [...new Set(rows.map(r => r.cohort_week))].sort();
  const maxWeek  = Math.max(...rows.map(r => r.week_num), 0);
  const weeks    = Array.from({ length: maxWeek + 1 }, (_, i) => i);

  const retention = (cohort: string, week: number) => {
    const row = rows.find(r => r.cohort_week === cohort && r.week_num === week);
    return row?.retention_pct ?? null;
  };

  const pctColor = (pct: number | null) => {
    if (pct === null) return 'bg-slate-50 dark:bg-slate-700 text-slate-300 dark:text-slate-600';
    if (pct >= 80) return 'bg-green-500 text-white';
    if (pct >= 60) return 'bg-green-400 text-white';
    if (pct >= 40) return 'bg-green-200 text-green-800';
    if (pct >= 20) return 'bg-amber-100 text-amber-700';
    return 'bg-red-50 text-red-400';
  };

  return (
    <div className="overflow-x-auto">
      <table className="text-xs w-full">
        <thead>
          <tr>
            <th className="text-left pr-3 py-2 text-slate-500 font-medium whitespace-nowrap">Cohort</th>
            <th className="text-right px-2 py-2 text-slate-500 font-medium">Size</th>
            {weeks.map(w => (
              <th key={w} className="text-center px-1 py-2 text-slate-400 font-medium min-w-[44px]">
                {w === 0 ? 'Wk0' : `+${w}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map(cohort => {
            const size = rows.find(r => r.cohort_week === cohort)?.cohort_size || 0;
            return (
              <tr key={cohort} className="border-t border-slate-50">
                <td className="pr-3 py-1.5 text-slate-600 font-medium whitespace-nowrap">{cohort}</td>
                <td className="text-right px-2 py-1.5 text-slate-500">{size}</td>
                {weeks.map(w => {
                  const pct = retention(cohort, w);
                  return (
                    <td key={w} className="px-1 py-1.5">
                      <div className={`rounded text-center py-1 font-bold ${pctColor(pct)}`}>
                        {pct !== null ? `${pct}%` : '—'}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ── 3. FEATURE ADOPTION ───────────────────────────────────────

const AdoptionSection = ({ rows }: { rows: FeatureAdoptionRow[] }) => {
  if (!rows.length) return <EmptyState label="No feature usage data for this period" />;

  const chartData = rows.map(r => ({
    feature: r.feature.replace(/_/g, ' '),
    users: r.unique_users,
    uses: r.total_uses,
    pct: r.adoption_pct,
  }));

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={Math.max(rows.length * 40, 160)}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 60 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="feature" width={120} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value, name) => [value, name === 'users' ? 'Unique Users' : 'Total Uses']}
            contentStyle={{ fontSize: 12 }} />
          <Bar dataKey="users" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={18}>
            <LabelList dataKey="pct" position="right" formatter={(v: number) => `${v}%`}
              style={{ fontSize: 11, fill: '#64748b' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
        {rows.slice(0, 4).map(r => (
          <KPI key={r.feature} label={r.feature.replace(/_/g, ' ')}
            value={r.unique_users} sub={`${r.adoption_pct}% adoption`} color="text-indigo-600" />
        ))}
      </div>
    </div>
  );
};

// ── 4. SESSION ANALYTICS ──────────────────────────────────────

const fmtDuration = (sec: number) => {
  if (!sec) return '0s';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m ? `${m}m ${s}s` : `${s}s`;
};

const SessionSection = ({
  stats, dau,
}: { stats: SessionAnalytics; dau: DAUPoint[] }) => (
  <div className="space-y-5">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <KPI label="Total Sessions"   value={stats.total_sessions.toLocaleString()} />
      <KPI label="Unique Users"     value={stats.total_users.toLocaleString()} color="text-brand-600" />
      <KPI label="Avg Duration"     value={fmtDuration(stats.avg_duration_seconds)} color="text-green-600" />
      <KPI label="Pages / Session"  value={stats.avg_pages_per_session.toFixed(1)} color="text-purple-600" />
    </div>

    {dau.length > 0 ? (
      <div>
        <p className="text-xs text-slate-400 mb-2 font-medium">Daily Active Users</p>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={dau} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date_day" tick={{ fontSize: 10 }}
              tickFormatter={d => d.slice(5)} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 12 }}
              labelFormatter={d => `Date: ${d}`}
              formatter={(v: number) => [v, 'DAU']} />
            <Line type="monotone" dataKey="dau" stroke="#3b82f6"
              strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    ) : (
      <EmptyState label="No DAU data for this period" />
    )}
  </div>
);

// ── 5. REVENUE ────────────────────────────────────────────────

const RevenueSection = ({ metrics }: { metrics: RevenueMetrics }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <KPI label="MRR"             value={`$${metrics.mrr.toLocaleString()}`} color="text-green-600" sub="Monthly Recurring" />
      <KPI label="ARR"             value={`$${metrics.arr.toLocaleString()}`} color="text-green-600" sub="Annual Recurring" />
      <KPI label="ARPU"            value={`$${metrics.arpu.toFixed(2)}`}     color="text-brand-600" sub="per paying user" />
      <KPI label="Conversion Rate" value={`${metrics.conversion_rate}%`}     color="text-purple-600" sub="free → paid" />
      <KPI label="LTV Estimate"    value={`$${metrics.ltv_estimate.toFixed(0)}`} color="text-amber-600" sub="2.5× ARR/user" />
    </div>

    <div className="grid grid-cols-3 gap-3">
      <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4 text-center">
        <p className="text-3xl font-black text-slate-800">{metrics.total_users}</p>
        <p className="text-xs text-slate-400 mt-1">Total Users</p>
      </div>
      <div className="bg-purple-50 rounded-xl p-4 text-center">
        <p className="text-3xl font-black text-purple-700">{metrics.pro_users}</p>
        <p className="text-xs text-purple-400 mt-1">Pro × $49/yr</p>
      </div>
      <div className="bg-amber-50 rounded-xl p-4 text-center">
        <p className="text-3xl font-black text-amber-700">{metrics.enterprise_users}</p>
        <p className="text-xs text-amber-400 mt-1">Enterprise × $149/yr</p>
      </div>
    </div>

    {/* Revenue bar visual */}
    {metrics.total_users > 0 && (
      <div>
        <p className="text-xs text-slate-400 mb-2">User Breakdown</p>
        <div className="w-full h-5 rounded-full overflow-hidden flex">
          <div className="bg-slate-300 transition-all" title="Free"
            style={{ width: `${((metrics.total_users - metrics.paying_users) / metrics.total_users) * 100}%` }} />
          <div className="bg-purple-400 transition-all" title="Pro"
            style={{ width: `${(metrics.pro_users / metrics.total_users) * 100}%` }} />
          <div className="bg-amber-400 transition-all" title="Enterprise"
            style={{ width: `${(metrics.enterprise_users / metrics.total_users) * 100}%` }} />
        </div>
        <div className="flex gap-4 mt-1.5">
          {[['bg-slate-300','Free'], ['bg-purple-400','Pro'], ['bg-amber-400','Enterprise']].map(([c, l]) => (
            <div key={l} className="flex items-center gap-1">
              <div className={`w-2.5 h-2.5 rounded-full ${c}`} />
              <span className="text-xs text-slate-400">{l}</span>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

// ── Main AnalyticsTab ─────────────────────────────────────────

export const AnalyticsTab = () => {
  const [range, setRange] = useState<DateRange>({ from: daysAgo(30), to: today() });
  const [loading, setLoading] = useState(false);

  const [funnel,    setFunnel]    = useState<FunnelStep[]>([]);
  const [cohort,    setCohort]    = useState<CohortRow[]>([]);
  const [adoption,  setAdoption]  = useState<FeatureAdoptionRow[]>([]);
  const [revenue,   setRevenue]   = useState<RevenueMetrics>({
    total_users: 0, pro_users: 0, enterprise_users: 0, paying_users: 0,
    arr: 0, mrr: 0, arpu: 0, conversion_rate: 0, ltv_estimate: 0,
  });
  const [session,   setSession]   = useState<SessionAnalytics>({
    total_sessions: 0, total_users: 0, avg_duration_seconds: 0, avg_pages_per_session: 0,
  });
  const [dau,       setDau]       = useState<DAUPoint[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [f, c, a, r, s, d] = await Promise.all([
        getFunnel(range.from, range.to),
        getCohortRetention(8),
        getFeatureAdoption(range.from, range.to),
        getRevenueMetrics(),
        getSessionAnalytics(range.from, range.to),
        getDailyActiveUsers(range.from === daysAgo(7) ? 7 : range.from === daysAgo(90) ? 90 : 30),
      ]);
      setFunnel(f); setCohort(c); setAdoption(a);
      setRevenue(r); setSession(s); setDau(d);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800">Analytics Dashboard</h2>
          <p className="text-xs text-slate-400">User behaviour, feature adoption, cohort retention &amp; revenue</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <DateRangePicker range={range} setRange={setRange} />
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50">
            <span className={loading ? 'animate-spin inline-block' : ''}>↻</span>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* 1. Conversion Funnel */}
      <Section
        title="Conversion Funnel"
        subtitle="Distinct users at each step of the acquisition funnel">
        <FunnelSection steps={funnel} />
      </Section>

      {/* 2. Cohort Retention */}
      <Section
        title="Cohort Retention"
        subtitle="% of each signup cohort still active in subsequent weeks (green = high retention)">
        <CohortSection rows={cohort} />
      </Section>

      {/* 3. Feature Adoption */}
      <Section
        title="Feature Adoption"
        subtitle="Unique users who opened each feature in the selected period">
        <AdoptionSection rows={adoption} />
      </Section>

      {/* 4. Session Analytics */}
      <Section
        title="Session Analytics"
        subtitle="Session depth, duration, and daily active users">
        <SessionSection stats={session} dau={dau} />
      </Section>

      {/* 5. Revenue */}
      <Section
        title="Revenue"
        subtitle="MRR, ARR, ARPU, and conversion metrics from user_profiles">
        <RevenueSection metrics={revenue} />
      </Section>
    </div>
  );
};
