import { useState, useEffect, useCallback } from 'react';
import { getSupabase } from '@/services/supabase';
import { TABLES } from '@/config/database';
import { Icon } from '@/components/common/Icons';

interface AbandonedUser {
  id: string;
  email: string | null;
  full_name: string | null;
  subscription_status: string;
  subscription_period: string | null;
  razorpay_subscription_id: string | null;
  updated_at: string;
  created_at: string;
}

interface Props {
  loadUserDetail: (user: any) => void;
}

export const AbandonedTab = ({ loadUserDetail }: Props) => {
  const [users, setUsers] = useState<AbandonedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'abandoned'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [runMessage, setRunMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const supabase = getSupabase();

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from(TABLES.USER_PROFILES)
      .select('id, email, full_name, subscription_status, subscription_period, razorpay_subscription_id, updated_at, created_at')
      .in('subscription_status', ['pending', 'abandoned'])
      .order('updated_at', { ascending: false });

    if (!error && data) {
      setUsers(data as AbandonedUser[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const triggerGlobalRecovery = async () => {
    setActionLoading('global');
    setRunMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-abandonment-email');
      if (error) throw error;
      
      const processedCount = data?.processed ?? 0;
      const recoveredCount = data?.results?.filter((r: any) => r.status === 'recovered').length ?? 0;
      
      setRunMessage({
        text: `Successfully ran recovery job! Processed ${processedCount} pending checkouts. Sent ${recoveredCount} recovery email(s).`,
        type: 'success'
      });
      await loadData();
    } catch (err: any) {
      console.error(err);
      setRunMessage({
        text: `Failed to run recovery job: ${err.message || 'Unknown error'}`,
        type: 'error'
      });
    } finally {
      setActionLoading(null);
    }
  };

  const triggerSingleRecovery = async (userId: string) => {
    setActionLoading(userId);
    try {
      const { data, error } = await supabase.functions.invoke('send-abandonment-email', {
        body: { user_id: userId }
      });
      if (error) throw error;
      
      const success = data?.results?.[0]?.status === 'recovered';
      if (success) {
        alert('Recovery email sent successfully!');
      } else {
        alert(`Failed to send: ${data?.results?.[0]?.error || data?.results?.[0]?.status || 'Unknown issue'}`);
      }
      await loadData();
    } catch (err: any) {
      console.error(err);
      alert(`Error sending recovery email: ${err.message || 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesStatus = statusFilter === 'all' || u.subscription_status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.full_name || '').toLowerCase().includes(q) ||
      u.id.includes(q);
    return matchesStatus && matchesSearch;
  });

  const pendingCount = users.filter(u => u.subscription_status === 'pending').length;
  const abandonedCount = users.filter(u => u.subscription_status === 'abandoned').length;

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Pending Checkouts</p>
            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{pendingCount}</h3>
            <p className="text-xs text-slate-400 mt-1">Stuck in checkout (last 1 hour)</p>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl text-amber-500">
            <Icon name="cog" className="h-6 w-6 animate-spin" />
          </div>
        </div>

        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Abandoned Checkouts</p>
            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{abandonedCount}</h3>
            <p className="text-xs text-slate-400 mt-1">Pending checkouts &gt; 1 hour (notified)</p>
          </div>
          <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-xl text-red-500">
            <Icon name="warning" className="h-6 w-6" />
          </div>
        </div>

        <div className="card p-4 flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Checkout Recovery Job</p>
            <p className="text-xs text-slate-500 mt-1">
              Runs automated recovery logic: finds pending users &gt; 1hr old, emails them, marks them abandoned.
            </p>
          </div>
          <button
            onClick={triggerGlobalRecovery}
            disabled={actionLoading !== null}
            className="mt-3 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            {actionLoading === 'global' ? (
              <>Running...</>
            ) : (
              <>
                <Icon name="refresh" className="h-4 w-4" />
                Run Recovery Job Now
              </>
            )}
          </button>
        </div>
      </div>

      {/* Message feedback */}
      {runMessage && (
        <div className={`p-3 rounded-lg text-xs font-medium ${
          runMessage.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
        }`}>
          {runMessage.text}
        </div>
      )}

      {/* Filters & search */}
      <div className="flex gap-3 flex-wrap items-center justify-between">
        <div className="flex gap-3 flex-wrap flex-1 max-w-lg">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search checkouts by email or name..."
            className="input-field flex-1 min-w-[200px]"
          />
          <div className="flex gap-1">
            {([
              { key: 'all', label: 'All' },
              { key: 'pending', label: 'Pending Only' },
              { key: 'abandoned', label: 'Abandoned Only' }
            ] as const).map(f => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === f.key
                    ? 'bg-slate-700 text-white'
                    : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <span className="text-xs text-slate-500 font-medium">
          Showing {filteredUsers.length} of {users.length} checkouts
        </span>
      </div>

      {/* List */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading checkouts data...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No matching checkouts found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-700 text-xs text-slate-500 dark:text-slate-400 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Plan details</th>
                  <th className="px-4 py-3 text-left">Razorpay Subscription</th>
                  <th className="px-4 py-3 text-left">Last Updated</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {user.full_name || 'Anonymous User'}
                        </div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">{user.email || 'no-email'}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        user.subscription_status === 'pending'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {user.subscription_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-semibold capitalize text-slate-700 dark:text-slate-300">
                        {user.subscription_period || 'Unknown'} Plan
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {user.razorpay_subscription_id || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(user.updated_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => triggerSingleRecovery(user.id)}
                          disabled={actionLoading !== null}
                          className="px-2 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 dark:bg-amber-950/20 dark:hover:bg-amber-950/40 dark:border-amber-800 text-amber-700 dark:text-amber-400 rounded text-xs font-medium transition-colors"
                        >
                          {actionLoading === user.id ? 'Sending...' : 'Send Recovery Email'}
                        </button>
                        <button
                          onClick={() => loadUserDetail(user)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs font-medium transition-colors"
                        >
                          Inspect
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
