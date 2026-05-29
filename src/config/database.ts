// ============================================================
// DATABASE TABLE & COLUMN NAMES — Single source of truth
// ============================================================
//
// WHY THIS FILE EXISTS:
// Every Supabase table name and RPC function name is defined
// here ONCE. If a table is renamed in Supabase, change it here
// and every query across the app updates automatically.
//
// HOW TO USE:
// import { TABLES, RPC } from '@/config/database';
// supabase.from(TABLES.TRANSACTIONS).select('*');
// supabase.rpc(RPC.GET_USER_TRANSACTION_COUNTS);
//
// WHEN TO EDIT:
// - Adding a new table in Supabase? Add it here first.
// - Renaming a table? Change the value here.
// - Adding a new RPC function? Add it to the RPC object.
// - NEVER use a raw table name string anywhere else.
// ============================================================

export const TABLES = {
  TRANSACTIONS: 'transactions',
  USER_PROFILES: 'user_profiles',
  CATEGORY_RULES: 'category_rules',
  APP_LOGS: 'app_logs',
  ASSET_SNAPSHOTS: 'asset_snapshots',
  USER_FILES: 'user_files',
  BUDGETS: 'budgets',
  SUPPORT_TICKETS: 'support_tickets',
  TICKET_MESSAGES: 'ticket_messages',
  FEEDBACK: 'feedback',
  ADMIN_AUDIT_LOG: 'admin_audit_log',
  FEATURE_FLAGS: 'feature_flags',
  USER_ACHIEVEMENTS: 'user_achievements',
  REFERRALS: 'referrals',
  USER_SETTINGS: 'user_settings',
  FORMAT_PRESETS: 'format_presets',
} as const;

export const RPC = {
  GET_USER_TRANSACTION_COUNTS: 'get_user_transaction_counts',
  GET_USER_FILE_COUNTS: 'get_user_file_counts',
  IS_ADMIN: 'is_admin',
  // Analytics RPCs — used by the Analytics tab in admin panel
  GET_ANALYTICS_FUNNEL:   'get_analytics_funnel',
  GET_COHORT_RETENTION:   'get_cohort_retention',
  GET_FEATURE_ADOPTION:   'get_feature_adoption',
  GET_REVENUE_METRICS:    'get_revenue_metrics',
  GET_SESSION_ANALYTICS:  'get_session_analytics',
  GET_DAILY_ACTIVE_USERS: 'get_daily_active_users',
  GET_ERROR_TIMELINE:     'get_error_timeline',
  // Format library RPCs
  INCREMENT_FORMAT_SUCCESS: 'increment_format_success',
  INCREMENT_FORMAT_FAILURE: 'increment_format_failure',
} as const;

export type TableName = typeof TABLES[keyof typeof TABLES];
