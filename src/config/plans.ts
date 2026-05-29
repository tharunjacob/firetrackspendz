// ============================================================
// SUBSCRIPTION PLAN CONFIGURATION — Single source of truth
// ============================================================
//
// WHY THIS FILE EXISTS:
// Plan names, feature gates, pricing, and billing periods are
// defined here ONCE. Multiple files need to check "is this user on
// Enterprise?" — they all import from here instead of hardcoding.
//
// HOW TO USE:
// import { PLAN_NAMES, canAccessFeature, getPlanPrice } from '@/config/plans';
// if (plan === PLAN_NAMES.ENTERPRISE) { ... }
// if (canAccessFeature(plan, 'api_access')) { ... }
// const { label, period } = getPlanPrice('pro', 'INR', 'monthly');
//
// WHEN TO EDIT:
// - Adding a new plan? Add it to PLAN_NAMES and PLAN_FEATURES.
// - Adding a new gated feature? Add it to the relevant plan arrays.
// - Changing pricing? Update PLAN_PRICING.
// ============================================================

import type { SubscriptionPlan } from '@/types';

export const PLAN_NAMES: Record<string, SubscriptionPlan> = {
  FREE: 'free',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
} as const;

export type BillingPeriod = 'monthly' | 'yearly';
export type BillingCurrency = 'INR' | 'USD';

interface PriceTier {
  /** Numeric amount in the local currency unit (₹ or $). NOT in paise/cents. */
  amount: number;
  /** Display label including currency symbol — e.g. "₹199", "$4.99". */
  label: string;
  /** Period suffix shown after the price — e.g. "/mo", "/yr". */
  period: string;
}

interface PlanPricing {
  inr: Record<BillingPeriod, PriceTier>;
  usd: Record<BillingPeriod, PriceTier>;
}

// ─── Pricing ────────────────────────────────────────────────────────────────
// India is price-sensitive — INR pricing is set ~5× lower than USD on purpose.
// Annual plans give a meaningful discount (~37% Pro, ~33% Enterprise) to push
// users to yearly billing (better retention, fewer payment failures).
//
// Razorpay charges in INR by default. International users (USD pricing) are
// charged the INR equivalent on their card unless Razorpay International is
// activated and USD plans are created. The displayed USD price is set so the
// INR-equivalent amount is reasonable.
export const PLAN_PRICING: Record<Exclude<SubscriptionPlan, 'free'>, PlanPricing> & {
  free: { inr: { monthly: PriceTier }; usd: { monthly: PriceTier } };
} = {
  free: {
    inr: { monthly: { amount: 0, label: '₹0', period: 'forever' } },
    usd: { monthly: { amount: 0, label: '$0', period: 'forever' } },
  },
  pro: {
    inr: {
      monthly: { amount: 199,  label: '₹199',   period: '/mo' },
      yearly:  { amount: 1499, label: '₹1,499', period: '/yr' },
    },
    usd: {
      monthly: { amount: 4.99, label: '$4.99', period: '/mo' },
      yearly:  { amount: 49,   label: '$49',   period: '/yr' },
    },
  },
  enterprise: {
    inr: {
      monthly: { amount: 499,  label: '₹499',   period: '/mo' },
      yearly:  { amount: 3999, label: '₹3,999', period: '/yr' },
    },
    usd: {
      monthly: { amount: 14.99, label: '$14.99', period: '/mo' },
      yearly:  { amount: 149,   label: '$149',   period: '/yr' },
    },
  },
};

/**
 * Look up a price tier safely. Falls back to monthly if a tier hasn't been
 * defined for that currency/period combo (only happens for the free plan).
 */
export function getPlanPrice(
  plan: SubscriptionPlan,
  currency: BillingCurrency,
  period: BillingPeriod,
): PriceTier {
  const tier = PLAN_PRICING[plan]?.[currency.toLowerCase() as 'inr' | 'usd'];
  if (!tier) return { amount: 0, label: '—', period: '' };
  return (tier as Record<string, PriceTier>)[period] ?? tier.monthly ?? { amount: 0, label: '—', period: '' };
}

/**
 * Compute the equivalent monthly cost for a yearly plan — used for the
 * "just $4.08/month billed yearly" sub-label on the pricing card.
 */
export function getMonthlyEquivalent(
  plan: Exclude<SubscriptionPlan, 'free'>,
  currency: BillingCurrency,
): string {
  const yearly = getPlanPrice(plan, currency, 'yearly').amount;
  if (!yearly) return '';
  const monthly = yearly / 12;
  const symbol = currency === 'INR' ? '₹' : '$';
  // INR amounts round to whole rupees; USD keeps 2 decimals.
  const formatted = currency === 'INR' ? Math.round(monthly).toLocaleString('en-IN') : monthly.toFixed(2);
  return `${symbol}${formatted}/mo billed yearly`;
}

/**
 * Yearly savings vs. paying monthly for 12 months, as a whole-number percent.
 * Returns 0 if either tier is missing/free.
 */
export function getYearlySavingsPercent(
  plan: Exclude<SubscriptionPlan, 'free'>,
  currency: BillingCurrency,
): number {
  const monthly = getPlanPrice(plan, currency, 'monthly').amount;
  const yearly = getPlanPrice(plan, currency, 'yearly').amount;
  if (!monthly || !yearly) return 0;
  const fullYear = monthly * 12;
  return Math.round(((fullYear - yearly) / fullYear) * 100);
}

/**
 * Largest yearly discount across the paid tiers for a currency — used for the
 * "Save up to X%" badge on the pricing toggle. We use the max (with "up to"
 * copy) because the discount differs per tier and currency (e.g. INR ~37% Pro
 * vs ~33% Enterprise; USD ~18% / ~17%), so a single fixed figure would be
 * misleading. Driving it off PLAN_PRICING keeps the badge honest if prices change.
 */
export function getMaxYearlySavingsPercent(currency: BillingCurrency): number {
  return Math.max(
    getYearlySavingsPercent('pro', currency),
    getYearlySavingsPercent('enterprise', currency),
  );
}

/** Features gated by plan. If a feature isn't listed for a plan, it's not available. */
export const PLAN_FEATURES: Record<SubscriptionPlan, string[]> = {
  free: [
    'basic_categorization',
    'monthly_breakdowns',
    'local_storage',
  ],
  pro: [
    'basic_categorization',
    'monthly_breakdowns',
    'local_storage',
    'unlimited_transactions',
    'ai_advisor',
    'fire_calculator',
    'net_worth',
    'budgets',
    'cloud_sync',
    'trend_analysis',
    'recurring_detection',
    'anomaly_detection',
    'notifications',
    'goals',
    'fire_scenarios',
    'fire_monte_carlo',
    'financial_wrapped',
    'shareable_milestones',
    'debt_payoff',
  ],
  enterprise: [
    'basic_categorization',
    'monthly_breakdowns',
    'local_storage',
    'unlimited_transactions',
    'ai_advisor',
    'fire_calculator',
    'net_worth',
    'budgets',
    'cloud_sync',
    'trend_analysis',
    'recurring_detection',
    'anomaly_detection',
    'notifications',
    'goals',
    'fire_scenarios',
    'fire_monte_carlo',
    'financial_wrapped',
    'shareable_milestones',
    'debt_payoff',
    'family_dashboard',
    'api_access',
    'custom_categories',
    'tax_reports',
    'csv_pdf_export',
    'dedicated_support',
  ],
};

/**
 * Check if a plan has access to a specific feature.
 * Safe to call with any string — returns false for unknown features.
 */
export const canAccessFeature = (plan: SubscriptionPlan, feature: string): boolean => {
  return PLAN_FEATURES[plan]?.includes(feature) ?? false;
};

/**
 * Check if a plan is at least a certain tier.
 * Useful for "Pro or higher" checks.
 */
export const isPlanAtLeast = (current: SubscriptionPlan, minimum: SubscriptionPlan): boolean => {
  const order: SubscriptionPlan[] = ['free', 'pro', 'enterprise'];
  return order.indexOf(current) >= order.indexOf(minimum);
};
