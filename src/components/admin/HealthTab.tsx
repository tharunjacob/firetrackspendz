import { useEffect, useRef, useState, useMemo } from 'react';
import { HealthCard } from './shared/Badges';
import { ErrorTimeline, TopErrors, FeatureUsage } from './shared/Charts';
import type { AppLog } from '@/types';

interface AdminStats {
  totalUsers: number; activeUsers: number; proUsers: number;
  enterpriseUsers: number; errorRate: number;
}

interface Props {
  stats: AdminStats;
  logs: AppLog[];
  onRefresh?: () => void;
}

export const HealthTab = ({ stats, logs, onRefresh }: Props) => {
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-refresh every 30s when toggled on
  useEffect(() => {
    if (autoRefresh && onRefresh) {
      intervalRef.current = setInterval(onRefresh, 30_000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, onRefresh]);

  // Error spike detection â€” compare last-hour vs avg hourly over 24h
  const spikeAlert = useMemo(() => {
    const now = Date.now();
    const oneHourAgo  = new Date(now - 3_600_000).toISOString();
    const oneDayAgo   = new Date(now - 86_400_000).toISOString();

    const recentErrors = logs.filter(l => l.level === 'error' && l.created_at >= oneHourAgo).length;
    const dayErrors    = logs.filter(l => l.level === 'error' && l.created_at >= oneDayAgo).length;
    const avgHourly    = dayErrors / 24;

    if (avgHourly >= 1 && recentErrors >= avgHourly * 3) {
      return { recentErrors, avgHourly: avgHourly.toFixed(1) };
    }
    return null;
  }, [logs]);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-slate-700">System Health</h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
            <div
              onClick={() => setAutoRefresh(v => !v)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                autoRefresh ? 'bg-brand-600' : 'bg-slate-200'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                autoRefresh ? 'translate-x-4' : 'translate-x-0.5'
              }`} />
            </div>
            Auto-refresh (30s)
          </label>
          {onRefresh && (
            <button onClick={onRefresh}
              className="text-sm px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600">
              â†» Refresh now
            </button>
          )}
        </div>
      </div>

      {/* Error Spike Alert */}
      {spikeAlert && (
        <div className="bg-red-50 border border-red-300 rounded-lg px-5 py-4 flex items-start gap-3">
          <span className="text-2xl">ðŸš¨</span>
          <div>
            <p className="font-bold text-red-700 text-sm">Error Spike Detected</p>
            <p className="text-red-600 text-xs mt-0.5">
              <strong>{spikeAlert.recentErrors} errors</strong> in the last hour â€” that's{' '}
              {Math.round(spikeAlert.recentErrors / Number(spikeAlert.avgHourly))}Ã— the 24-hour average of{' '}
              {spikeAlert.avgHourly}/hr. Investigate immediately.
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <HealthCard
          label="Error Rate (24h)"
          value={`${stats.errorRate.toFixed(1)}%`}
          status={stats.errorRate < 1 ? 'healthy' : stats.errorRate < 5 ? 'warning' : 'critical'}
        />
        <HealthCard
          label="Active Users (30d)"
          value={`${stats.activeUsers} / ${stats.totalUsers}`}
          status={stats.totalUsers > 0 && (stats.activeUsers / stats.totalUsers) > 0.3 ? 'healthy' : 'warning'}
        />
        <HealthCard
          label="Paid Conversion"
          value={`${stats.totalUsers > 0 ? (((stats.proUsers + stats.enterpriseUsers) / stats.totalUsers) * 100).toFixed(1) : 0}%`}
          status={(stats.proUsers + stats.enterpriseUsers) / Math.max(stats.totalUsers, 1) > 0.05 ? 'healthy' : 'warning'}
        />
      </div>

      {/* Charts */}
      <div className="card p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3">Error Events â€” Last 7 Days</h3>
        <ErrorTimeline logs={logs} />
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3">Top Error Events</h3>
        <TopErrors logs={logs} />
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3">Feature Usage (from logs)</h3>
        <FeatureUsage logs={logs} />
      </div>
    </div>
  );
};
