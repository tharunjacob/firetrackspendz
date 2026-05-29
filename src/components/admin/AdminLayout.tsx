import { useState, useEffect, useCallback } from 'react';
import { getSupabase } from '@/services/supabase';
import { TABLES } from '@/config/database';
import { Icon } from '@/components/common/Icons';
import { logEvent, EVENTS } from '@/services/logger';
import { logAdminAction } from '@/services/adminAudit';
import type { UserProfile, LearningRule, AppLog, AdminTab } from '@/types';

import { OverviewTab } from './OverviewTab';
import { UsersTab } from './UsersTab';
import { UserDetailPanel } from './UserDetailPanel';
import { RulesTab } from './RulesTab';
import { LogsTab } from './LogsTab';
import { HealthTab } from './HealthTab';
import { MimicTab } from './MimicTab';
import { FeedbackTab } from './FeedbackTab';
import { AnalyticsTab } from './AnalyticsTab';
import { FeatureFlagsTab } from './FeatureFlagsTab';
import { AuditLogTab } from './AuditLogTab';
import { FormatPresetsTab } from './FormatPresetsTab';

// ============================================================
// Shared interfaces (used across multiple tabs)
// ============================================================

export interface AdminStats {
  totalUsers: number; activeUsers: number; totalTransactions: number;
  proUsers: number; enterpriseUsers: number; freeUsers: number;
  totalRevenue: number; newUsersThisWeek: number; errorRate: number;
}

export interface UserDetail extends UserProfile {
  transactionCount?: number;
  lastActive?: string;
  fileCount?: number;
}

// ============================================================
// AdminLayout â€” owns all state and data fetching
// ============================================================

interface Props {
  adminEmail: string;
  adminId: string;
}

const TABS: { key: AdminTab; label: string; icon: string }[] = [
  { key: 'overview',   label: 'Overview',   icon: 'chart' },
  { key: 'users',      label: 'Users',      icon: 'user' },
  { key: 'rules',      label: 'Rules',      icon: 'cog' },
  { key: 'logs',       label: 'Logs',       icon: 'search' },
  { key: 'health',     label: 'Health',     icon: 'shield' },
  { key: 'mimic',      label: 'Mimic',      icon: 'user' },
  { key: 'feedback',   label: 'Feedback',   icon: 'mail' },
  { key: 'analytics',  label: 'Analytics',  icon: 'chart' },
  { key: 'flags',      label: 'Flags',      icon: 'cog' },
  { key: 'audit',      label: 'Audit',      icon: 'shield' },
  { key: 'formats',    label: 'Formats',    icon: 'chart' },
];

export const AdminLayout = ({ adminEmail, adminId }: Props) => {
  const supabase = getSupabase();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(false);

  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0, activeUsers: 0, totalTransactions: 0,
    proUsers: 0, enterpriseUsers: 0, freeUsers: 0,
    totalRevenue: 0, newUsersThisWeek: 0, errorRate: 0,
  });
  const [users, setUsers] = useState<UserDetail[]>([]);
  const [rules, setRules] = useState<LearningRule[]>([]);
  const [logs, setLogs] = useState<AppLog[]>([]);
  const [feedbackItems, setFeedbackItems] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [selectedUserTxns, setSelectedUserTxns] = useState<any[]>([]);
  const [mimicEmail, setMimicEmail] = useState('');
  const [logSearch, setLogSearch] = useState('');

  // â”€â”€ Data loaders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const loadUsers = useCallback(async () => {
    const { data: profiles } = await supabase.from(TABLES.USER_PROFILES).select('*').order('created_at', { ascending: false });
    if (!profiles) return;

    const { data: txnCounts } = await supabase.rpc('get_user_transaction_counts') || { data: null };
    const countMap = new Map((txnCounts || []).map((r: any) => [r.user_id, r.count]));
    const { data: fileCounts } = await supabase.rpc('get_user_file_counts') || { data: null };
    const fileMap = new Map((fileCounts || []).map((r: any) => [r.user_id, r.count]));

    const enriched: UserDetail[] = profiles.map(p => ({
      ...p,
      transactionCount: countMap.get(p.id) || 0,
      fileCount: fileMap.get(p.id) || 0,
    }));
    setUsers(enriched);

    const now = Date.now();
    const thirtyDaysAgo = new Date(now - 30 * 86400000).toISOString();
    const sevenDaysAgo  = new Date(now - 7  * 86400000).toISOString();
    const proCount  = profiles.filter(p => p.subscription_plan === 'pro').length;
    const entCount  = profiles.filter(p => p.subscription_plan === 'enterprise').length;

    setStats(prev => ({
      ...prev,
      totalUsers: profiles.length,
      activeUsers: profiles.filter(p => p.updated_at && p.updated_at > thirtyDaysAgo).length,
      proUsers: proCount,
      enterpriseUsers: entCount,
      freeUsers: profiles.length - proCount - entCount,
      totalRevenue: proCount * 49 + entCount * 149,
      newUsersThisWeek: profiles.filter(p => p.created_at && p.created_at > sevenDaysAgo).length,
      totalTransactions: ([...countMap.values()] as number[]).reduce((a, b) => a + b, 0),
    }));
  }, []);

  const loadRules = useCallback(async () => {
    const { data } = await supabase.from(TABLES.CATEGORY_RULES).select('*').order('created_at', { ascending: false }).limit(500);
    if (data) setRules(data);
  }, []);

  const loadLogs = useCallback(async () => {
    const { data } = await supabase.from(TABLES.APP_LOGS).select('*').order('created_at', { ascending: false }).limit(500);
    if (data) setLogs(data as AppLog[]);
  }, []);

  const loadHealthStats = useCallback(async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const { count: errorCount } = await supabase.from(TABLES.APP_LOGS).select('*', { count: 'exact', head: true }).eq('level', 'error').gte('created_at', yesterday);
    const { count: totalLogs }  = await supabase.from(TABLES.APP_LOGS).select('*', { count: 'exact', head: true }).gte('created_at', yesterday);
    setStats(prev => ({
      ...prev,
      errorRate: totalLogs && totalLogs > 0 ? ((errorCount || 0) / totalLogs) * 100 : 0,
    }));
  }, []);

  const loadFeedback = useCallback(async () => {
    const { data } = await supabase.from(TABLES.FEEDBACK).select('*').order('created_at', { ascending: false }).limit(100);
    setFeedbackItems(data || []);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadUsers(), loadRules(), loadLogs(), loadHealthStats(), loadFeedback()]);
    } finally {
      setLoading(false);
    }
  }, [loadUsers, loadRules, loadLogs, loadHealthStats, loadFeedback]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // â”€â”€ Mutations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const resolveFeedback = async (id: string) => {
    const { error } = await supabase.from(TABLES.FEEDBACK).update({ status: 'resolved' }).eq('id', id);
    if (!error) {
      setFeedbackItems(prev => prev.map(f => f.id === id ? { ...f, status: 'resolved' } : f));
      logEvent(EVENTS.ADMIN_FEEDBACK_RESOLVED, { feedbackId: id });
    }
  };

  const loadUserDetail = async (u: UserDetail) => {
    setSelectedUser(u);
    setActiveTab('user-detail');
    const { data: txns } = await supabase.from(TABLES.TRANSACTIONS).select('*').eq('user_id', u.id).order('date', { ascending: false }).limit(100);
    setSelectedUserTxns(txns || []);
  };

  const promoteRule = async (rule: LearningRule) => {
    const { error } = await supabase.from(TABLES.CATEGORY_RULES).update({ scope: 'system' }).eq('id', rule.id);
    if (!error) {
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, scope: 'system' as any } : r));
      logEvent(EVENTS.ADMIN_RULE_PROMOTED, { ruleId: rule.id, keyword: rule.keyword, value: rule.value });
      logAdminAction(adminId, adminEmail, 'rule_promoted', 'category_rule', String(rule.id ?? ''), {
        keyword: rule.keyword, value: rule.value,
      });
    }
  };

  const deleteRule = async (rule: LearningRule) => {
    if (!confirm(`Delete rule "${rule.keyword} â†’ ${rule.value}"?`)) return;
    const { error } = await supabase.from(TABLES.CATEGORY_RULES).delete().eq('id', rule.id);
    if (!error) {
      setRules(prev => prev.filter(r => r.id !== rule.id));
      logEvent(EVENTS.ADMIN_RULE_DELETED, { ruleId: rule.id, keyword: rule.keyword, value: rule.value });
      logAdminAction(adminId, adminEmail, 'rule_deleted', 'category_rule', String(rule.id ?? ''), {
        keyword: rule.keyword, value: rule.value,
      });
    }
  };

  const updateUserPlan = async (userId: string, plan: string) => {
    const prevPlan = users.find(u => u.id === userId)?.subscription_plan;
    const { error } = await supabase.from(TABLES.USER_PROFILES).update({ subscription_plan: plan }).eq('id', userId);
    if (!error) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, subscription_plan: plan as any } : u));
      if (selectedUser?.id === userId) setSelectedUser(prev => prev ? { ...prev, subscription_plan: plan as any } : prev);
      logEvent(EVENTS.ADMIN_PLAN_CHANGED, { targetUserId: userId, fromPlan: prevPlan, toPlan: plan });
      logAdminAction(adminId, adminEmail, 'plan_changed', 'user', userId, {
        from: prevPlan, to: plan,
      });
    }
  };

  const startMimic = () => {
    if (!mimicEmail.trim()) return;
    const targetUser = users.find(u => u.email?.toLowerCase() === mimicEmail.toLowerCase());
    if (!targetUser) { alert('User not found. Check the email address.'); return; }
    logEvent(EVENTS.ADMIN_MIMIC_STARTED, { targetEmail: mimicEmail, targetUserId: targetUser.id });
    logAdminAction(adminId, adminEmail, 'mimic_started', 'user', targetUser.id, {
      targetEmail: mimicEmail,
    });
    const url = new URL(window.location.origin + '/dashboard');
    url.searchParams.set('mimic_user_id', targetUser.id);
    url.searchParams.set('mimic_email', encodeURIComponent(targetUser.email || mimicEmail));
    window.open(url.toString(), '_blank');
  };

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':     return <OverviewTab stats={stats} logs={logs} />;
      case 'users':        return <UsersTab users={users} logs={logs} loadUserDetail={loadUserDetail} />;
      case 'user-detail':  return selectedUser
        ? <UserDetailPanel selectedUser={selectedUser} selectedUserTxns={selectedUserTxns} logs={logs}
            updateUserPlan={updateUserPlan} setMimicEmail={setMimicEmail} setActiveTab={setActiveTab} setLogSearch={setLogSearch} />
        : null;
      case 'rules':        return <RulesTab rules={rules} promoteRule={promoteRule} deleteRule={deleteRule} />;
      case 'logs':         return <LogsTab logs={logs} initialSearch={logSearch} />;
      case 'health':       return <HealthTab stats={stats} logs={logs} onRefresh={loadAll} />;
      case 'mimic':        return <MimicTab users={users} mimicEmail={mimicEmail} setMimicEmail={setMimicEmail} startMimic={startMimic} />;
      case 'feedback':     return <FeedbackTab feedbackItems={feedbackItems} resolveFeedback={resolveFeedback} />;
      case 'analytics':    return <AnalyticsTab />;
      case 'flags':        return <FeatureFlagsTab adminId={adminId} adminEmail={adminEmail} />;
      case 'audit':        return <AuditLogTab />;
      case 'formats':      return <FormatPresetsTab />;
      default:             return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Control Room</h1>
          <p className="text-xs text-slate-500 mt-0.5">Admin access â€” {adminEmail}</p>
        </div>
        <button onClick={loadAll} disabled={loading}
          className="flex items-center gap-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors disabled:opacity-50">
          <Icon name="refresh" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading...' : 'Refresh All'}
        </button>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {TABS.map(tab => (
          <button key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.key ? 'bg-brand-600 text-white' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600'
            }`}>
            <Icon name={tab.icon as any} className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
        {activeTab === 'user-detail' && selectedUser && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white">
            <Icon name="user" className="w-4 h-4" />
            {selectedUser.email}
          </div>
        )}
      </div>

      {/* Tab Content */}
      {renderTab()}
    </div>
  );
};
