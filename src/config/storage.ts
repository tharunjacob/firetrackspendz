// ============================================================
// LOCAL STORAGE KEYS — Single source of truth
// ============================================================
//
// WHY THIS FILE EXISTS:
// Every localStorage key the app uses is defined here. This
// prevents silent data loss from typos in key names across
// different files.
//
// HOW TO USE:
// import { STORAGE_KEYS } from '@/config/storage';
// localStorage.getItem(STORAGE_KEYS.SAVINGS_GOALS);
//
// NAMING CONVENTION:
// All keys are prefixed with 'tsz_' to avoid collisions with
// other apps on the same domain.
//
// WHEN TO EDIT:
// - Storing something new in localStorage? Add the key here.
// - NEVER use a raw localStorage key string anywhere else.
// ============================================================

export const STORAGE_KEYS = {
  // User data
  SAVINGS_GOALS: 'tsz_savings_goals',
  BUDGETS: 'tsz_budgets',
  DEBTS: 'tsz_debts',
  FAMILY_MEMBERS: 'tsz_family_members',
  API_KEYS: 'tsz_api_keys',
  DISMISSED_NOTIFICATIONS: 'tsz_dismissed_notifications',
  FEEDBACK_SUBMISSIONS: 'tsz_feedback_submissions',

  // App state
  LEARNING_RULES: 'trackspendz_mappings_v2',
  NET_ASSET_CONFIG: 'net_asset_config',

  // Asset DB
  INDEXEDDB_NAME: 'trackspendz_assets',
  INDEXEDDB_STORE: 'snapshots',

  // Core Transactions DB
  TXN_DB_NAME: 'TrackSpendzDB',
  TXN_STORE_NAME: 'transactions',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

// ============================================================
// FREE TIER LIMITS
// ============================================================

export const LIMITS = {
  /** Max transactions visible without sign-up */
  FREE_PREVIEW_TRANSACTIONS: 500,
  /** Max family members on Enterprise plan */
  MAX_FAMILY_MEMBERS: 5,
  /** Max API keys on Enterprise plan */
  MAX_API_KEYS: 5,
  /** Max file size for free users (10 MB) */
  MAX_FILE_SIZE_FREE: 10 * 1024 * 1024,
  /** Max file size for Pro/Enterprise users (50 MB) */
  MAX_FILE_SIZE_PRO: 50 * 1024 * 1024,
} as const;
