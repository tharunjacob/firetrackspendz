import { getSupabase } from '@/services/supabase';
import { RPC } from '@/config/database';
import type {
  FunnelStep, CohortRow, FeatureAdoptionRow,
  RevenueMetrics, SessionAnalytics, DAUPoint, ErrorTimelinePoint,
} from '@/types';

// ============================================================
// Analytics Service — wraps the 7 admin RPCs
// All functions return empty/zero defaults on error so the UI
// always renders gracefully without a live Supabase connection.
// ============================================================

export const getFunnel = async (fromDate: string, toDate: string): Promise<FunnelStep[]> => {
  const { data, error } = await getSupabase().rpc(RPC.GET_ANALYTICS_FUNNEL, {
    from_date: fromDate,
    to_date: toDate,
  });
  if (error) { console.warn('get_analytics_funnel:', error.message); return []; }
  return (data || []) as FunnelStep[];
};

export const getCohortRetention = async (numWeeks = 8): Promise<CohortRow[]> => {
  const { data, error } = await getSupabase().rpc(RPC.GET_COHORT_RETENTION, { num_weeks: numWeeks });
  if (error) { console.warn('get_cohort_retention:', error.message); return []; }
  return (data || []) as CohortRow[];
};

export const getFeatureAdoption = async (fromDate: string, toDate: string): Promise<FeatureAdoptionRow[]> => {
  const { data, error } = await getSupabase().rpc(RPC.GET_FEATURE_ADOPTION, {
    from_date: fromDate,
    to_date: toDate,
  });
  if (error) { console.warn('get_feature_adoption:', error.message); return []; }
  return (data || []) as FeatureAdoptionRow[];
};

export const getRevenueMetrics = async (): Promise<RevenueMetrics> => {
  const empty: RevenueMetrics = {
    total_users: 0, pro_users: 0, enterprise_users: 0, paying_users: 0,
    arr: 0, mrr: 0, arpu: 0, conversion_rate: 0, ltv_estimate: 0,
  };
  const { data, error } = await getSupabase().rpc(RPC.GET_REVENUE_METRICS);
  if (error) { console.warn('get_revenue_metrics:', error.message); return empty; }
  // RPC returns rows [{metric, value}] — pivot to object
  const rows = (data || []) as { metric: string; value: number }[];
  return rows.reduce<RevenueMetrics>((acc, { metric, value }) => {
    (acc as any)[metric] = Number(value);
    return acc;
  }, { ...empty });
};

export const getSessionAnalytics = async (fromDate: string, toDate: string): Promise<SessionAnalytics> => {
  const empty: SessionAnalytics = { total_sessions: 0, total_users: 0, avg_duration_seconds: 0, avg_pages_per_session: 0 };
  const { data, error } = await getSupabase().rpc(RPC.GET_SESSION_ANALYTICS, {
    from_date: fromDate,
    to_date: toDate,
  });
  if (error) { console.warn('get_session_analytics:', error.message); return empty; }
  return ((data && data[0]) || empty) as SessionAnalytics;
};

export const getDailyActiveUsers = async (numDays = 30): Promise<DAUPoint[]> => {
  const { data, error } = await getSupabase().rpc(RPC.GET_DAILY_ACTIVE_USERS, { num_days: numDays });
  if (error) { console.warn('get_daily_active_users:', error.message); return []; }
  return (data || []) as DAUPoint[];
};

export const getErrorTimeline = async (numDays = 7): Promise<ErrorTimelinePoint[]> => {
  const { data, error } = await getSupabase().rpc(RPC.GET_ERROR_TIMELINE, { num_days: numDays });
  if (error) { console.warn('get_error_timeline:', error.message); return []; }
  return (data || []) as ErrorTimelinePoint[];
};
