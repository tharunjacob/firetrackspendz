import { useMemo, useState } from 'react';
import { PlanBadge } from './shared/Badges';
import { computeHealthScore, churnRiskColor, scoreColor } from './shared/healthScore';
import type { UserProfile, AppLog } from '@/types';

interface UserDetail extends UserProfile {
  transactionCount?: number;
  lastActive?: string;
  fileCount?: number;
}

interface Props {
  users: UserDetail[];
  logs: AppLog[];
  loadUserDetail: (u: UserDetail) => void;
}

type ActivityFilter = 'all' | 'active' | 'dormant' | 'new';
type RiskFilter = 'all' | 'low' | 'medium' | 'high';

const PAGE_SIZE = 25;

const isActiveUser = (user: UserDetail, logs: AppLog[]): boolean => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  return logs.some(l => l.user_id === user.id && l.created_at >= thirtyDaysAgo);
};

const isNewUser = (user: UserDetail): boolean => {
  if (!user.created_at) return false;
  return new Date(user.created_at).getTime() > Date.now() - 7 * 86400000;
};

export const UsersTab = ({ users, logs, loadUserDetail }: Props) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [userPage, setUserPage] = useState(0);
  const [planFilter, setPlanFilter] = useState<'all' | 'free' | 'pro' | 'enterprise'>('all');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');

  // Pre-compute health scores for all users (memoized — only recalcs when users/logs change)
  const healthScores = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeHealthScore>>();
    users.forEach(u => {
      const userLogs = logs.filter(l => l.user_id === u.id);
      map.set(u.id, computeHealthScore(u, userLogs));
    });
    return map;
  }, [users, logs]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return users.filter(u => {
      const matchesSearch = !q ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.full_name || '').toLowerCase().includes(q) ||
        u.id.includes(q);

      const matchesPlan = planFilter === 'all' || (u.subscription_plan || 'free') === planFilter;

      const active = isActiveUser(u, logs);
      const newUser = isNewUser(u);
      const matchesActivity =
        activityFilter === 'all' ? true :
        activityFilter === 'active' ? active :
        activityFilter === 'new' ? newUser :
        /* dormant */ !active && !newUser;

      const hs = healthScores.get(u.id);
      const matchesRisk = riskFilter === 'all' || hs?.churnRisk === riskFilter;

      return matchesSearch && matchesPlan && matchesActivity && matchesRisk;
    });
  }, [users, logs, searchQuery, planFilter, activityFilter, riskFilter, healthScores]);

  const paginatedUsers = filteredUsers.slice(userPage * PAGE_SIZE, (userPage + 1) * PAGE_SIZE);

  const resetPage = () => setUserPage(0);

  return (
    <div className="space-y-4">
      {/* Search + Plan Filter */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text" value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); resetPage(); }}
          placeholder="Search by email, name, or ID..."
          className="input-field flex-1 min-w-[200px]"
        />
        <div className="flex gap-1 flex-wrap">
          {(['all', 'free', 'pro', 'enterprise'] as const).map(p => (
            <button key={p} onClick={() => { setPlanFilter(p); resetPage(); }}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors capitalize ${
                planFilter === p ? 'bg-brand-600 text-white' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'
              }`}>
              {p}
            </button>
          ))}
        </div>
        <span className="text-sm text-slate-500 self-center whitespace-nowrap">
          {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Activity + Risk Segment Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Activity</span>
        <div className="flex gap-1">
          {([
            { key: 'all', label: 'All' },
            { key: 'active', label: 'Active' },
            { key: 'dormant', label: 'Dormant' },
            { key: 'new', label: 'New (7d)' },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => { setActivityFilter(key); resetPage(); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activityFilter === key
                  ? 'bg-slate-700 text-white'
                  : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'
              }`}>
              {label}
            </button>
          ))}
        </div>

        <span className="text-xs text-slate-500 font-medium uppercase tracking-wide ml-2">Churn Risk</span>
        <div className="flex gap-1">
          {([
            { key: 'all', label: 'All', cls: '' },
            { key: 'low', label: 'Low', cls: 'text-green-700' },
            { key: 'medium', label: 'Medium', cls: 'text-amber-700' },
            { key: 'high', label: 'High', cls: 'text-red-700' },
          ] as const).map(({ key, label, cls }) => (
            <button key={key} onClick={() => { setRiskFilter(key); resetPage(); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                riskFilter === key
                  ? 'bg-slate-700 text-white'
                  : `bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 ${cls}`
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700 text-xs text-slate-500 dark:text-slate-400 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Plan</th>
                <th className="px-4 py-3 text-right">Txns</th>
                <th className="px-4 py-3 text-right">Files</th>
                <th className="px-4 py-3 text-center">Health</th>
                <th className="px-4 py-3 text-center">Risk</th>
                <th className="px-4 py-3 text-left">Joined</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedUsers.map(u => {
                const hs = healthScores.get(u.id);
                return (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer" onClick={() => loadUserDetail(u)}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{u.email}</p>
                      <p className="text-xs text-slate-500">
                        {u.full_name || '—'} · {u.id.substring(0, 8)}...
                        {isNewUser(u) && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-xs font-bold bg-brand-100 text-brand-700">NEW</span>
                        )}
                      </p>
                    </td>
                    <td className="px-4 py-3"><PlanBadge plan={u.subscription_plan} /></td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600">{u.transactionCount || 0}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600">{u.fileCount || 0}</td>
                    <td className="px-4 py-3 text-center">
                      {hs ? (
                        <span className={`text-sm font-bold ${scoreColor(hs.score)}`}>
                          {hs.score}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {hs ? (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${churnRiskColor(hs.churnRisk)}`}>
                          {hs.churnRisk}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={e => { e.stopPropagation(); loadUserDetail(u); }}
                        className="text-xs text-brand-600 hover:underline">View</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredUsers.length === 0 && (
            <p className="text-center text-sm text-slate-500 py-8">No users found.</p>
          )}
        </div>
        {filteredUsers.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <button disabled={userPage === 0} onClick={() => setUserPage(p => p - 1)}
              className="text-sm text-brand-600 disabled:text-slate-300">← Previous</button>
            <span className="text-xs text-slate-500">
              Page {userPage + 1} of {Math.ceil(filteredUsers.length / PAGE_SIZE)}
            </span>
            <button disabled={(userPage + 1) * PAGE_SIZE >= filteredUsers.length} onClick={() => setUserPage(p => p + 1)}
              className="text-sm text-brand-600 disabled:text-slate-300">Next →</button>
          </div>
        )}
      </div>
    </div>
  );
};
