// ============================================================
// CONFIGURATION INDEX — Re-exports all config modules
// ============================================================
//
// Import from '@/config' to access any configuration:
//   import { ROUTES, TABLES, STORAGE_KEYS, PLAN_NAMES } from '@/config';
//
// Or import from specific modules:
//   import { ROUTES } from '@/config/routes';
//   import { TABLES } from '@/config/database';
// ============================================================

export { ROUTES } from './routes';
export type { RoutePath } from './routes';

export { TABLES, RPC } from './database';
export type { TableName } from './database';

export { STORAGE_KEYS, LIMITS } from './storage';
export type { StorageKey } from './storage';

export { PLAN_NAMES, PLAN_PRICING, PLAN_FEATURES, canAccessFeature, isPlanAtLeast } from './plans';
