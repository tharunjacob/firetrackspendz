import { CurrencyConfig, Currency } from '@/types';

// ============================================================
// Application Constants
// ============================================================

export const APP_NAME = 'TrackSpendZ';
export const APP_VERSION = '2.0.0';

// Pricing
export const PRICING = {
  free: { name: 'Free', price: 0, fileUploads: 3, features: ['Basic Dashboard', '3 File Uploads', 'Local Storage Only'] },
  pro: { name: 'Pro', priceMonthly: 4.99, priceYearly: 49.99, features: ['Unlimited Uploads', 'Cloud Sync', 'AI Advisor', 'FIRE Calculator', 'Net Worth Tracker', 'Budgets & Alerts', 'CSV & JSON Exports', 'Priority Support'] },
  enterprise: { name: 'Enterprise', priceMonthly: 15, priceYearly: 149, features: ['Everything in Pro', 'Household Tracking', 'Advanced Custom Rules', 'Dedicated Support'] },
} as const;

// Currencies
export const CURRENCIES: Record<Currency, CurrencyConfig> = {
  USD: { symbol: '$', locale: 'en-US', name: 'US Dollar' },
  EUR: { symbol: '\u20AC', locale: 'de-DE', name: 'Euro' },
  INR: { symbol: '\u20B9', locale: 'en-IN', name: 'Indian Rupee' },
  GBP: { symbol: '\u00A3', locale: 'en-GB', name: 'British Pound' },
  AUD: { symbol: 'A$', locale: 'en-AU', name: 'Australian Dollar' },
  CAD: { symbol: 'C$', locale: 'en-CA', name: 'Canadian Dollar' },
  SGD: { symbol: 'S$', locale: 'en-SG', name: 'Singapore Dollar' },
  AED: { symbol: 'AED', locale: 'ar-AE', name: 'UAE Dirham' },
};

export const detectUserCurrency = (): Currency => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return 'USD';
    if (tz.includes('Kolkata') || tz.includes('Calcutta') || tz.includes('India')) return 'INR';
    if (tz.includes('London') || tz.includes('Belfast')) return 'GBP';
    if (tz.startsWith('Europe/')) return 'EUR';
    if (tz.includes('Sydney') || tz.includes('Melbourne') || tz.includes('Australia')) return 'AUD';
    if (tz.includes('Toronto') || tz.includes('Vancouver') || tz.includes('Canada')) return 'CAD';
    if (tz.includes('Singapore')) return 'SGD';
    if (tz.includes('Dubai')) return 'AED';
    return 'USD';
  } catch { return 'USD'; }
};

export const formatAmount = (value: number, currency: Currency): string => {
  const cfg = CURRENCIES[currency];
  return new Intl.NumberFormat(cfg.locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export const formatCompact = (value: number, currency: Currency): string => {
  const cfg = CURRENCIES[currency];
  if (Math.abs(value) >= 10_000_000) return cfg.symbol + (value / 10_000_000).toFixed(1) + 'Cr';
  if (Math.abs(value) >= 100_000) return cfg.symbol + (value / 100_000).toFixed(1) + 'L';
  if (Math.abs(value) >= 1_000) return cfg.symbol + (value / 1_000).toFixed(1) + 'K';
  return cfg.symbol + value.toFixed(0);
};

// Chart colors
//
// Two distinct roles, kept strictly separate:
//   · Semantic signals — `income` (green) and `expense` (red). Used ONLY to
//     mean positive vs negative (income-vs-expense bars/lines). Never reused
//     as category identity.
//   · `categories` — a cohesive, slightly desaturated categorical palette
//     anchored on Classic Blue (#2563EB) for category identity in donuts,
//     trends and breakdowns. Deliberately avoids signal green/red so the two
//     roles never collide.
export const COLORS = {
  brand: '#2563eb',
  income:  { medium: '#78B482', dark: '#48905C' },
  expense: { medium: '#f87171', dark: '#dc2626' },
  categories: [
    '#2563eb', // blue (brand)
    '#0d9488', // teal
    '#8b5cf6', // violet
    '#f59e0b', // amber
    '#db2777', // pink
    '#0ea5e9', // sky
    '#6366f1', // indigo
    '#ea580c', // orange
    '#0891b2', // cyan
    '#7c3aed', // deep violet
    '#64748b', // slate
    '#c026d3', // fuchsia
  ],
};

// Category defaults
export const DEFAULT_CATEGORIES = [
  'Food', 'Groceries', 'Transport', 'Shopping', 'Utilities',
  'Entertainment', 'Health', 'Education', 'Investment', 'Salary',
  'Housing', 'EMI', 'Bill Payment', 'Transfer', 'Cash',
  'Travel', 'Insurance', 'Subscription', 'Income', 'Unclassified',
];
