// ============================================================
// Net Asset Tracker — Type Definitions
// ============================================================

/** A user-defined asset category (e.g., "Mutual Funds", "Stocks", "Gold") */
export interface AssetCategory {
  id: string;
  name: string;
  tier: string;        // accessibility tier name (e.g., "Liquid", "Investment")
  icon?: string;       // emoji or icon key
  sortOrder: number;
}

/** A user-defined accessibility tier (e.g., "Liquid", "Investment", "Retirement") */
export interface AccessibilityTier {
  id: string;
  name: string;
  description: string;
  color: string;       // hex color for charts
  sortOrder: number;
}

/** A single monthly snapshot entry for one owner + category */
export interface AssetSnapshot {
  id: string;
  user_id: string;
  date: string;               // YYYY-MM-DD
  owner: string;              // person name
  category: string;           // asset category name
  accessibility_tier: string; // tier name
  principal: number;          // amount invested / deposited
  current_value: number;      // current market value
  currency: string;
  notes?: string;
  created_at: string;
}

/** An owner within the household */
export interface AssetOwner {
  name: string;
  relation: string;   // "Self", "Spouse", "Partner", "Child", "Parent", "Other"
}

/** User's net asset configuration (stored in profile or local) */
export interface NetAssetConfig {
  owners: AssetOwner[];
  categories: AssetCategory[];
  tiers: AccessibilityTier[];
}

/** Computed: monthly totals for a single date */
export interface MonthlyNetWorth {
  date: string;
  totalPrincipal: number;
  totalCurrentValue: number;
  totalGain: number;
  gainPercent: number;
  momChange: number;          // month-over-month % change in current value
  byOwner: Record<string, { principal: number; currentValue: number }>;
  byCategory: Record<string, { principal: number; currentValue: number }>;
  byTier: Record<string, { principal: number; currentValue: number }>;
}

/** Computed: per-category return summary */
export interface CategoryReturn {
  category: string;
  tier: string;
  principal: number;
  currentValue: number;
  gainLoss: number;
  returnPercent: number;   // (currentValue - principal) / principal
  momChange: number;       // vs previous month
}

// ---- Default configs ----

export const DEFAULT_TIERS: AccessibilityTier[] = [
  { id: 'liquid', name: 'Liquid', description: 'Cash and savings you can access immediately', color: '#22c55e', sortOrder: 1 },
  { id: 'investment', name: 'Investment', description: 'Invested assets accessible with some effort or tax', color: '#2563eb', sortOrder: 2 },
  { id: 'retirement', name: 'Retirement', description: 'Locked until retirement age', color: '#f59e0b', sortOrder: 3 },
];

export const DEFAULT_CATEGORIES: AssetCategory[] = [
  { id: 'savings', name: 'Savings', tier: 'Liquid', icon: '🏦', sortOrder: 1 },
  { id: 'fixed-deposit', name: 'Fixed Deposit', tier: 'Liquid', icon: '📄', sortOrder: 2 },
  { id: 'mutual-funds', name: 'Mutual Funds', tier: 'Investment', icon: '📈', sortOrder: 3 },
  { id: 'stocks', name: 'Stocks', tier: 'Investment', icon: '📊', sortOrder: 4 },
  { id: 'bonds', name: 'Bonds', tier: 'Investment', icon: '🏛️', sortOrder: 5 },
  { id: 'gold', name: 'Gold', tier: 'Investment', icon: '🥇', sortOrder: 6 },
  { id: 'crypto', name: 'Crypto', tier: 'Investment', icon: '₿', sortOrder: 7 },
  { id: 'real-estate', name: 'Real Estate', tier: 'Investment', icon: '🏠', sortOrder: 8 },
  { id: 'retirement-401k', name: '401k / Pension', tier: 'Retirement', icon: '🏦', sortOrder: 9 },
  { id: 'retirement-ira', name: 'IRA / Tax-Advantaged', tier: 'Retirement', icon: '📋', sortOrder: 10 },
  { id: 'employer-match', name: 'Employer Match', tier: 'Retirement', icon: '🤝', sortOrder: 11 },
  { id: 'other', name: 'Other', tier: 'Investment', icon: '📦', sortOrder: 99 },
];

export const OWNER_RELATIONS = ['Self', 'Spouse', 'Partner', 'Child', 'Parent', 'Other'] as const;

/** Column mapping for AI-detected asset file structures */
export interface AssetFileMapping {
  dateColumn: string;
  dateFormat?: string;
  ownerColumn?: string;
  categoryColumn?: string;
  tierColumn?: string;
  principalColumn?: string;
  currentValueColumn?: string;
  currencyColumn?: string;
  notesColumn?: string;
}
