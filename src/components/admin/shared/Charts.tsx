import { useMemo } from 'react';
import type { AppLog } from '@/types';

export const ErrorTimeline = ({ logs }: { logs: AppLog[] }) => {
  const days = useMemo(() => {
    const now = Date.now();
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(now - (6 - i) * 86400000);
      const dateStr = date.toISOString().slice(0, 10);
      const dayLogs = logs.filter(l => l.created_at.startsWith(dateStr));
      return {
        day: date.toLocaleDateString(undefined, { weekday: 'short' }),
        errors: dayLogs.filter(l => l.level === 'error').length,
        warnings: dayLogs.filter(l => l.level === 'warn').length,
      };
    });
  }, [logs]);

  const maxErrors = Math.max(...days.map(d => d.errors), 1);

  return (
    <div className="flex items-end gap-3 h-32">
      {days.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex flex-col items-center gap-0.5" style={{ height: '80px' }}>
            <div
              className="w-full bg-red-400 rounded-t transition-all"
              style={{ height: `${(d.errors / maxErrors) * 80}px`, minHeight: d.errors > 0 ? '4px' : '0' }}
              title={`${d.errors} errors`}
            />
            <div
              className="w-full bg-amber-300 transition-all"
              style={{ height: `${(d.warnings / Math.max(maxErrors, 1)) * 40}px`, minHeight: d.warnings > 0 ? '2px' : '0' }}
              title={`${d.warnings} warnings`}
            />
          </div>
          <span className="text-xs text-slate-500">{d.day}</span>
          <span className="text-xs font-bold text-slate-600">{d.errors}</span>
        </div>
      ))}
    </div>
  );
};

export const TopErrors = ({ logs }: { logs: AppLog[] }) => {
  const topErrors = useMemo(() => {
    const counts = new Map<string, number>();
    logs.filter(l => l.level === 'error').forEach(l => counts.set(l.event, (counts.get(l.event) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [logs]);

  if (topErrors.length === 0) return <p className="text-sm text-slate-500">No errors recorded.</p>;

  return (
    <div className="space-y-2">
      {topErrors.map(([event, count]) => (
        <div key={event} className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-slate-700 truncate">{event}</p>
              <span className="text-xs text-red-500 font-bold shrink-0">Ã—{count}</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
              <div className="h-full bg-red-400 rounded-full" style={{ width: `${(count / topErrors[0][1]) * 100}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export const FeatureUsage = ({ logs }: { logs: AppLog[] }) => {
  const features = useMemo(() => {
    const featureEvents = [
      'feature_fire_opened', 'feature_ai_advisor_opened', 'feature_net_worth_opened',
      'feature_goals_opened', 'feature_budgets_opened', 'feature_recurring_opened',
      'feature_trends_opened', 'feature_compare_opened',
      'file_processed', 'upload_analysis_completed',
    ];
    const counts = new Map<string, number>();
    logs.forEach(l => {
      if (featureEvents.includes(l.event)) counts.set(l.event, (counts.get(l.event) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [logs]);

  if (features.length === 0) return <p className="text-sm text-slate-500">Not enough data yet.</p>;

  const max = features[0]?.[1] || 1;
  return (
    <div className="space-y-3">
      {features.map(([event, count]) => (
        <div key={event} className="flex items-center gap-3">
          <span className="text-sm text-slate-600 w-52 truncate">{event.replace(/_/g, ' ')}</span>
          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${(count / max) * 100}%` }} />
          </div>
          <span className="text-xs font-bold text-slate-600 w-10 text-right">{count}</span>
        </div>
      ))}
    </div>
  );
};
