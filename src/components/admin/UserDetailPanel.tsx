import { useState } from 'react';
import { PlanBadge, LevelBadge } from './shared/Badges';
import { MiniStat } from './shared/StatCard';
import { computeHealthScore, scoreColor, churnRiskColor } from './shared/healthScore';
import type { UserProfile, AppLog, AdminTab } from '@/types';

interface UserDetail extends UserProfile {
  transactionCount?: number;
  fileCount?: number;
}

interface Props {
  selectedUser: UserDetail;
  selectedUserTxns: any[];
  logs: AppLog[];
  updateUserPlan: (userId: string, plan: string) => void;
  setMimicEmail: (email: string) => void;
  setActiveTab: (tab: AdminTab) => void;
  setLogSearch: (q: string) => void;
}

// â”€â”€ Timeline helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type EventCategory = 'auth' | 'upload' | 'feature' | 'error' | 'admin' | 'general';

const categoriseEvent = (event: string): EventCategory => {
  if (event.startsWith('auth_') || event.startsWith('session_')) return 'auth';
  if (event.startsWith('upload_')) return 'upload';
  if (event.startsWith('feature_') || event.startsWith('dashboard_')) return 'feature';
  if (event.startsWith('error_') || event === 'error_boundary_caught') return 'error';
  if (event.startsWith('admin_')) return 'admin';
  return 'general';
};

const CATEGORY_STYLES: Record<EventCategory, { dot: string; icon: string; label: string }> = {
  auth:    { dot: 'bg-brand-500',   icon: 'ðŸ”', label: 'Auth' },
  upload:  { dot: 'bg-brand-500', icon: 'ðŸ“¤', label: 'Upload' },
  feature: { dot: 'bg-teal-500',   icon: 'âœ¨', label: 'Feature' },
  error:   { dot: 'bg-red-500',    icon: 'âš ï¸', label: 'Error' },
  admin:   { dot: 'bg-amber-500',  icon: 'ðŸ›¡ï¸', label: 'Admin' },
  general: { dot: 'bg-slate-400',  icon: 'ðŸ“Œ', label: 'General' },
};

const formatMeta = (meta: Record<string, unknown>): string => {
  const keys = Object.keys(meta);
  if (keys.length === 0) return '';
  return keys.slice(0, 3).map(k => `${k}: ${String(meta[k])}`).join(' Â· ');
};

export const UserDetailPanel = ({
  selectedUser, selectedUserTxns, logs, updateUserPlan, setMimicEmail, setActiveTab, setLogSearch,
}: Props) => {
  const [showTimeline, setShowTimeline] = useState(true);
  const userLogs = logs.filter(l => l.user_id === selectedUser.id);
  const recentLogs = userLogs.slice(0, 50);
  const timelineLogs = userLogs.slice(0, 30);

  const hs = computeHealthScore(selectedUser, userLogs);

  return (
    <div className="space-y-6">
      <button onClick={() => setActiveTab('users')} className="text-sm text-brand-600 hover:underline">
        â† Back to Users
      </button>

      {/* User Info */}
      <div className="card p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="w-14 h-14 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center font-bold text-xl mb-3">
              {(selectedUser.email || 'U')[0].toUpperCase()}
            </div>
            <h2 className="text-xl font-bold text-slate-800">{selectedUser.email}</h2>
            <p className="text-sm text-slate-500">{selectedUser.full_name || 'No name'} Â· ID: {selectedUser.id}</p>
          </div>
          <div className="flex flex-col gap-2">
            <PlanBadge plan={selectedUser.subscription_plan} />
            <select
              value={selectedUser.subscription_plan || 'free'}
              onChange={e => updateUserPlan(selectedUser.id, e.target.value)}
              className="input-field text-xs w-32"
            >
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <MiniStat label="Transactions" value={selectedUser.transactionCount || 0} />
          <MiniStat label="Files Uploaded" value={selectedUser.fileCount || 0} />
          <MiniStat label="Currency" value={selectedUser.preferred_currency || 'INR'} />
          <MiniStat label="Joined" value={selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString() : 'â€”'} />
        </div>

        {/* Health Score */}
        <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-700 rounded-xl">
          <p className="text-xs text-slate-400 uppercase font-bold mb-3">Health Score</p>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold ${scoreColor(hs.score)}`}>{hs.score}</span>
              <span className="text-slate-400 text-sm">/ 100</span>
            </div>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full capitalize ${churnRiskColor(hs.churnRisk)}`}>
              {hs.churnRisk} churn risk
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3">
            {[
              { label: 'Login Frequency', value: hs.loginFrequency, max: 40 },
              { label: 'Feature Depth', value: hs.featureDepth, max: 30 },
              { label: 'Data Freshness', value: hs.dataFreshness, max: 30 },
            ].map(({ label, value, max }) => (
              <div key={label}>
                <p className="text-xs text-slate-400 mb-1">{label} <span className="text-slate-600 font-medium">{value}/{max}</span></p>
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-500 rounded-full transition-all"
                    style={{ width: `${(value / max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {(selectedUser.razorpay_subscription_id || selectedUser.razorpay_customer_id || selectedUser.stripe_customer_id) && (
          <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg text-xs space-y-1">
            {selectedUser.razorpay_subscription_id && (
              <div>
                <span className="text-slate-500">Razorpay Subscription: </span>
                <span className="font-mono text-slate-700">{selectedUser.razorpay_subscription_id}</span>
              </div>
            )}
            {selectedUser.razorpay_customer_id && (
              <div>
                <span className="text-slate-500">Razorpay Customer: </span>
                <span className="font-mono text-slate-700">{selectedUser.razorpay_customer_id}</span>
              </div>
            )}
            {selectedUser.subscription_period && (
              <div>
                <span className="text-slate-500">Billing: </span>
                <span className="font-mono text-slate-700 capitalize">{selectedUser.subscription_period}</span>
              </div>
            )}
            {selectedUser.stripe_customer_id && (
              <div>
                <span className="text-slate-500">Legacy Stripe Customer: </span>
                <span className="font-mono text-slate-700">{selectedUser.stripe_customer_id}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* User Timeline */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700">Activity Timeline</h3>
          <button
            onClick={() => setShowTimeline(v => !v)}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            {showTimeline ? 'Hide' : 'Show'}
          </button>
        </div>
        {showTimeline && (
          <div className="p-4 max-h-80 overflow-y-auto">
            {timelineLogs.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-4">No activity recorded.</p>
            ) : (
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-3 top-0 bottom-0 w-px bg-slate-200" />
                <div className="space-y-3">
                  {timelineLogs.map((log, i) => {
                    const cat = categoriseEvent(log.event);
                    const style = CATEGORY_STYLES[cat];
                    const meta = formatMeta(log.metadata || {});
                    return (
                      <div key={i} className="flex gap-3 items-start">
                        {/* Dot */}
                        <div className={`relative z-10 w-6 h-6 rounded-full ${style.dot} flex items-center justify-center flex-shrink-0 text-xs`}>
                          <span style={{ fontSize: '10px' }}>{style.icon}</span>
                        </div>
                        {/* Content */}
                        <div className="flex-1 min-w-0 pb-1">
                          <p className="text-xs font-semibold text-slate-700 leading-tight">{log.event}</p>
                          {meta && <p className="text-xs text-slate-400 mt-0.5 truncate">{meta}</p>}
                          <p className="text-xs text-slate-300 mt-0.5">
                            {new Date(log.created_at).toLocaleString()}
                          </p>
                        </div>
                        <LevelBadge level={log.level} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-700">Recent Transactions (up to 100)</h3>
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 uppercase sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-left">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {selectedUserTxns.map((t, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="px-3 py-2 whitespace-nowrap">{t.date}</td>
                  <td className="px-3 py-2 truncate max-w-[200px]">{t.notes || t.original_description || 'â€”'}</td>
                  <td className="px-3 py-2">{t.category}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                      t.type === 'Income' ? 'bg-green-100 text-green-700' :
                      t.type === 'Transfer' ? 'bg-brand-100 text-brand-700' : 'bg-red-100 text-red-700'
                    }`}>{t.type}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{t.amount?.toLocaleString()}</td>
                  <td className="px-3 py-2 text-slate-400">{t.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {selectedUserTxns.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-8">No transactions found.</p>
          )}
        </div>
      </div>

      {/* Activity Logs */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-700">Raw Activity Logs</h3>
        </div>
        <div className="overflow-x-auto max-h-60">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 uppercase sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left">Time</th>
                <th className="px-3 py-2 text-left">Event</th>
                <th className="px-3 py-2 text-left">Level</th>
                <th className="px-3 py-2 text-left">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recentLogs.map((log, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2 font-medium">{log.event}</td>
                  <td className="px-3 py-2"><LevelBadge level={log.level} /></td>
                  <td className="px-3 py-2 text-slate-400 truncate max-w-[250px]">{JSON.stringify(log.metadata || {})}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {recentLogs.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-6">No activity logs.</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => { setMimicEmail(selectedUser.email || ''); setActiveTab('mimic'); }}
            className="text-sm px-4 py-2 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 font-medium">
            Mimic This User
          </button>
          <button onClick={() => { setLogSearch(selectedUser.email || ''); setActiveTab('logs'); }}
            className="text-sm px-4 py-2 bg-brand-50 text-brand-700 rounded-lg hover:bg-brand-100 font-medium">
            View All Logs
          </button>
        </div>
      </div>
    </div>
  );
};
