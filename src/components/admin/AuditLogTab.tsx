import { useEffect, useState, useMemo } from 'react';
import { getSupabase } from '@/services/supabase';
import { TABLES } from '@/config/database';
import type { AdminAuditEntry } from '@/types';

// ============================================================
// Audit Log Tab â€” every admin action, who did it, and when
// ============================================================

const ACTION_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  toggle_flag:    { bg: 'bg-brand-100',   text: 'text-brand-700',   icon: 'ðŸš©' },
  plan_changed:   { bg: 'bg-brand-100', text: 'text-brand-700', icon: 'ðŸ’³' },
  rule_promoted:  { bg: 'bg-green-100',  text: 'text-green-700',  icon: 'â¬†ï¸' },
  rule_deleted:   { bg: 'bg-red-100',    text: 'text-red-700',    icon: 'ðŸ—‘ï¸' },
  mimic_started:  { bg: 'bg-amber-100',  text: 'text-amber-700',  icon: 'ðŸ‘ï¸' },
  feedback_resolved: { bg: 'bg-teal-100', text: 'text-teal-700',  icon: 'âœ…' },
};

const getActionStyle = (action: string) =>
  ACTION_STYLES[action] || { bg: 'bg-slate-100', text: 'text-slate-700', icon: 'ðŸ“‹' };

const PAGE_SIZE = 50;

export const AuditLogTab = () => {
  const [entries, setEntries] = useState<AdminAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    getSupabase()
      .from(TABLES.ADMIN_AUDIT_LOG)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data, error: err }) => {
        if (err) {
          setError('Could not load audit log. Connect Supabase to see admin actions here.');
        } else {
          setEntries((data as AdminAuditEntry[]) || []);
        }
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    if (!filter.trim()) return entries;
    const q = filter.toLowerCase();
    return entries.filter(e =>
      e.action.includes(q) ||
      e.admin_email.toLowerCase().includes(q) ||
      e.target_type.includes(q) ||
      e.target_id.includes(q)
    );
  }, [entries, filter]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-slate-500 text-sm">Loading audit log...</div>
      </div>
    );
  }

  if (error && entries.length === 0) {
    return (
      <div className="card p-8 text-center border-2 border-dashed border-slate-200">
        <div className="text-4xl mb-3">ðŸ”</div>
        <h3 className="text-lg font-bold text-slate-700 mb-2">Admin Audit Log</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-700">Admin Audit Log</h2>
          <p className="text-xs text-slate-500 mt-0.5">Every admin mutation â€” plan changes, flag toggles, rule actions, mimic sessions.</p>
        </div>
        <span className="text-xs text-slate-500">{filtered.length} entries</span>
      </div>

      {/* Search */}
      <input
        type="text" value={filter}
        onChange={e => { setFilter(e.target.value); setPage(0); }}
        placeholder="Filter by action, admin, target type..."
        className="input-field w-full max-w-sm"
      />

      {entries.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-4xl mb-3">ðŸ“­</p>
          <p className="text-sm font-bold text-slate-600">No audit entries yet</p>
          <p className="text-xs text-slate-500 mt-1">Admin actions (plan changes, flag toggles, etc.) will appear here.</p>
        </div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-700 text-xs text-slate-500 dark:text-slate-400 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">When</th>
                    <th className="px-4 py-3 text-left">Admin</th>
                    <th className="px-4 py-3 text-left">Action</th>
                    <th className="px-4 py-3 text-left">Target</th>
                    <th className="px-4 py-3 text-left">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paged.map(entry => {
                    const style = getActionStyle(entry.action);
                    return (
                      <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                          {new Date(entry.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-medium text-slate-700 truncate max-w-[140px]">{entry.admin_email}</p>
                          <p className="text-xs text-slate-300 font-mono">{entry.admin_id.substring(0, 8)}â€¦</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded ${style.bg} ${style.text}`}>
                            {style.icon} {entry.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          <span className="font-medium">{entry.target_type}</span>
                          <span className="text-slate-300 font-mono ml-1">{entry.target_id.substring(0, 10)}â€¦</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 truncate max-w-[200px]">
                          {Object.entries(entry.details || {})
                            .slice(0, 3)
                            .map(([k, v]) => `${k}: ${String(v)}`)
                            .join(' Â· ')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length > PAGE_SIZE && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                  className="text-sm text-brand-600 disabled:text-slate-300">â† Previous</button>
                <span className="text-xs text-slate-500">
                  Page {page + 1} of {Math.ceil(filtered.length / PAGE_SIZE)}
                </span>
                <button disabled={(page + 1) * PAGE_SIZE >= filtered.length} onClick={() => setPage(p => p + 1)}
                  className="text-sm text-brand-600 disabled:text-slate-300">Next â†’</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
