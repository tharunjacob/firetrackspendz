import { CurrencyConfig, Currency } from '@/types';

// ============================================================
// Application Constants
// ============================================================

export const APP_NAME = 'TrackSpendZ';
export const APP_VERSION = '2.0.0';

// Pricing
export const PRICING = {
  free: { name: 'Free', price: 0, fileUploads: 3, features: ['Basic Dashboard', '3 File Uploads', 'Local Storage Only'] },
  pro: { name: 'Pro', priceMonthly: 5, priceYearly: 49, features: ['Unlimited Uploads', 'Cloud Sync', 'AI Advisor', 'FIRE Calculator', 'Net Worth Tracker', 'Budgets & Alerts', 'PDF Reports', 'Priority Support'] },
  enterprise: { name: 'Enterprise', priceMonthly: 15, priceYearly: 149, features: ['Everything in Pro', 'Multi-entity Tracking', 'Tax-ready Reports', 'Custom Categories', 'Dedicated Support'] },
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
export const COLORS = {
  brand: '#2563eb',
  income: {
    light: '#A8D8A8',
    medium: '#78B482',
    dark: '#48905C',
    palette: ['#A8D8A8', '#90C695', '#78B482', '#60A26F', '#48905C', '#307e47', '#186c31'],
  },
  expense: {
    light: '#fca5a5',
    medium: '#f87171',
    dark: '#dc2626',
    palette: ['#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d', '#450a0a'],
  },
  categories: [
    '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
    '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4',
    '#84cc16', '#e879f9', '#22d3ee', '#a3e635', '#fb923c',
  ],
  pastel: ['#fecaca', '#fed7aa', '#fef08a', '#d9f99d', '#bfdbfe', '#e9d5ff', '#fbcfe8'],
};

// Category defaults
export const DEFAULT_CATEGORIES = [
  'Food', 'Groceries', 'Transport', 'Shopping', 'Utilities',
  'Entertainment', 'Health', 'Education', 'Investment', 'Salary',
  'Housing', 'EMI', 'Bill Payment', 'Transfer', 'Cash',
  'Travel', 'Insurance', 'Subscription', 'Income', 'Unclassified',
];
