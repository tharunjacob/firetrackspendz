import { useMemo, useState } from 'react';
import { LevelBadge } from './shared/Badges';
import type { AppLog } from '@/types';

const PAGE_SIZE = 25;

export const LogsTab = ({ logs, initialSearch = '' }: { logs: AppLog[]; initialSearch?: string }) => {
  const [logFilter, setLogFilter] = useState<'all' | 'error' | 'warn' | 'info' | 'failures'>('all');
  const [logSearch, setLogSearch] = useState(initialSearch);
  const [logPage, setLogPage] = useState(0);

  const filteredLogs = useMemo(() => {
    let result = logs;
    if (logFilter === 'failures') {
      result = result.filter(l => l.event === 'upload_analysis_failed');
    } else if (logFilter !== 'all') {
      result = result.filter(l => l.level === logFilter);
    }
    if (logSearch) {
      const q = logSearch.toLowerCase();
      result = result.filter(l =>
        l.event.toLowerCase().includes(q) ||
        (l.email || '').toLowerCase().includes(q) ||
        JSON.stringify(l.metadata || {}).toLowerCase().includes(q)
      );
    }
    return result;
  }, [logs, logFilter, logSearch]);

  const paginatedLogs = filteredLogs.slice(logPage * PAGE_SIZE, (logPage + 1) * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <input type="text" value={logSearch}
          onChange={e => { setLogSearch(e.target.value); setLogPage(0); }}
          placeholder="Search events, emails, metadata..."
          className="input-field flex-1 min-w-[200px]"
        />
        <div className="flex gap-1">
          {(['all', 'error', 'warn', 'info', 'failures'] as const).map(f => (
            <button key={f} onClick={() => { setLogFilter(f); setLogPage(0); }}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                logFilter === f ? 'bg-brand-600 text-white' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'
              }`}>
              {f === 'failures' ? 'FAILURES' : f.toUpperCase()}
            </button>
          ))}
        </div>
        <span className="text-sm text-slate-500 self-center">{filteredLogs.length} entries</span>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700 text-xs text-slate-500 dark:text-slate-400 uppercase sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left">Time</th>
                <th className="px-4 py-3 text-left">Level</th>
                <th className="px-4 py-3 text-left">Event</th>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Path</th>
                <th className="px-4 py-3 text-left">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedLogs.map((log, i) => (
                <tr key={i} className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 ${log.level === 'error' ? 'bg-red-50/30 dark:bg-red-950/20' : ''}`}>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3"><LevelBadge level={log.level} /></td>
                  <td className="px-4 py-3 font-medium text-slate-700">{log.event}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 truncate max-w-[150px]">{log.email || 'System'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{log.path || '—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => alert(JSON.stringify(log.metadata, null, 2))}
                      className="text-xs text-brand-600 hover:underline">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredLogs.length === 0 && (
            <p className="text-center text-sm text-slate-500 py-8">No matching logs.</p>
          )}
        </div>
        {filteredLogs.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <button disabled={logPage === 0} onClick={() => setLogPage(p => p - 1)}
              className="text-sm text-brand-600 disabled:text-slate-300">← Previous</button>
            <span className="text-xs text-slate-500">
              Page {logPage + 1} of {Math.ceil(filteredLogs.length / PAGE_SIZE)}
            </span>
            <button disabled={(logPage + 1) * PAGE_SIZE >= filteredLogs.length} onClick={() => setLogPage(p => p + 1)}
              className="text-sm text-brand-600 disabled:text-slate-300">Next →</button>
          </div>
        )}
      </div>
    </div>
  );
};
