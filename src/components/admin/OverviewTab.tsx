import { StatCard } from './shared/StatCard';
import type { AppLog } from '@/types';

interface AdminStats {
  totalUsers: number; activeUsers: number; totalTransactions: number;
  proUsers: number; enterpriseUsers: number; freeUsers: number;
  totalRevenue: number; newUsersThisWeek: number; errorRate: number;
}

export const OverviewTab = ({ stats, logs }: { stats: AdminStats; logs: AppLog[] }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      <StatCard label="Total Users" value={stats.totalUsers} />
      <StatCard label="Active (30d)" value={stats.activeUsers} color="text-brand-600" />
      <StatCard label="New This Week" value={stats.newUsersThisWeek} color="text-green-600" />
      <StatCard label="Pro Users" value={stats.proUsers} color="text-brand-600" />
      <StatCard label="Enterprise" value={stats.enterpriseUsers} color="text-amber-600" />
    </div>

    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <StatCard label="Free Users" value={stats.freeUsers} />
      <StatCard label="Total Transactions" value={stats.totalTransactions.toLocaleString()} />
      <StatCard label="ARR" value={`$${stats.totalRevenue.toLocaleString()}`} color="text-green-600" />
      <StatCard label="Error Rate (24h)" value={`${stats.errorRate.toFixed(1)}%`} color={stats.errorRate > 5 ? 'text-red-500' : 'text-green-600'} />
    </div>

    <div className="card p-5">
      <h3 className="text-sm font-bold text-slate-700 mb-3">Revenue Breakdown</h3>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-brand-50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-brand-700">${stats.proUsers * 49}</p>
          <p className="text-xs text-brand-500 mt-1">{stats.proUsers} Pro Ã— $49/yr</p>
        </div>
        <div className="bg-amber-50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-amber-700">${stats.enterpriseUsers * 149}</p>
          <p className="text-xs text-amber-500 mt-1">{stats.enterpriseUsers} Enterprise Ã— $149/yr</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-green-700">${stats.totalRevenue}</p>
          <p className="text-xs text-green-500 mt-1">Total ARR</p>
        </div>
      </div>
    </div>

    <div className="card p-5">
      <h3 className="text-sm font-bold text-slate-700 mb-3">Recent Error Logs</h3>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {logs.filter(l => l.level === 'error').slice(0, 10).map((log, i) => (
          <div key={i} className="flex items-start gap-3 text-sm py-2 border-b border-slate-50 last:border-0">
            <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 shrink-0">ERROR</span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-700 truncate">{log.event}</p>
              <p className="text-xs text-slate-500">{log.email || 'System'} â€” {new Date(log.created_at).toLocaleString()}</p>
            </div>
          </div>
        ))}
        {logs.filter(l => l.level === 'error').length === 0 && (
          <p className="text-sm text-slate-500 text-center py-4">No errors in recent logs.</p>
        )}
      </div>
    </div>
  </div>
);
