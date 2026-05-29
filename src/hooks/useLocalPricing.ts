import { useState, useEffect } from 'react';
import {
  PLAN_PRICING,
  getMonthlyEquivalent,
  type BillingCurrency,
  type BillingPeriod,
} from '@/config/plans';

/**
 * Region-aware pricing hook.
 *
 * Detects whether the user is in India (via timezone) and returns INR or USD
 * pricing accordingly. Supports both monthly and yearly billing periods.
 *
 * Note: timezone detection isn't IP-accurate — Indians abroad on IST get INR,
 * Americans visiting India on US time get USD. Good enough for a price-display
 * heuristic; actual billing currency is set by the Razorpay plan, not this hook.
 */
export const useLocalPricing = () => {
  const [isIndia, setIsIndia] = useState(false);

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz === 'Asia/Calcutta' || tz === 'Asia/Kolkata') {
        setIsIndia(true);
      }
    } catch {
      // Older browsers — fall back to USD pricing.
    }
  }, []);

  const currency: BillingCurrency = isIndia ? 'INR' : 'USD';
  const currencyKey = isIndia ? 'inr' : 'usd';

  const get = (tier: 'pro' | 'enterprise', period: BillingPeriod) => {
    const t = PLAN_PRICING[tier][currencyKey][period];
    return {
      price: t.label,
      period: t.period,
      amount: t.amount,
      sub: period === 'yearly' ? getMonthlyEquivalent(tier, currency) : null,
    };
  };

  return {
    isIndia,
    currency,
    pro: {
      monthly: get('pro', 'monthly'),
      yearly: get('pro', 'yearly'),
      // Back-compat shape — defaults to the format the old PricingPage used.
      price: isIndia ? PLAN_PRICING.pro.inr.monthly.label : PLAN_PRICING.pro.usd.yearly.label,
      period: isIndia ? PLAN_PRICING.pro.inr.monthly.period : PLAN_PRICING.pro.usd.yearly.period,
      sub: isIndia ? null : getMonthlyEquivalent('pro', 'USD'),
    },
    enterprise: {
      monthly: get('enterprise', 'monthly'),
      yearly: get('enterprise', 'yearly'),
      price: isIndia ? PLAN_PRICING.enterprise.inr.monthly.label : PLAN_PRICING.enterprise.usd.yearly.label,
      period: isIndia ? PLAN_PRICING.enterprise.inr.monthly.period : PLAN_PRICING.enterprise.usd.yearly.period,
      sub: isIndia ? null : getMonthlyEquivalent('enterprise', 'USD'),
    },
  };
};
