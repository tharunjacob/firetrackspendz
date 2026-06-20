import { useState, useEffect } from 'react';
import { useUI } from '@/contexts/UIContext';
import {
  PLAN_PRICING,
  getMonthlyEquivalent,
  type BillingCurrency,
  type BillingPeriod,
} from '@/config/plans';

/**
 * Region-aware pricing hook.
 *
 * Subscribes to the app-wide UIContext currency setting and falls back
 * to local timezone detection. Returns pricing details accordingly.
 */
export const useLocalPricing = () => {
  const { currency: uiCurrency } = useUI();
  const [isIndiaTz, setIsIndiaTz] = useState(false);

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz === 'Asia/Calcutta' || tz === 'Asia/Kolkata') {
        setIsIndiaTz(true);
      }
    } catch {
      // Older browsers — fall back to USD pricing.
    }
  }, []);

  const billingCurrency: BillingCurrency = uiCurrency === 'INR'
    ? 'INR'
    : (uiCurrency === 'USD' ? 'USD' : (isIndiaTz ? 'INR' : 'USD'));

  const isIndia = billingCurrency === 'INR';
  const currencyKey = isIndia ? 'inr' : 'usd';

  const get = (tier: 'pro' | 'enterprise', period: BillingPeriod) => {
    const t = PLAN_PRICING[tier][currencyKey][period];
    return {
      price: t.label,
      period: t.period,
      amount: t.amount,
      originalPrice: t.originalLabel || null,
      sub: period === 'yearly' ? getMonthlyEquivalent(tier, billingCurrency) : null,
    };
  };

  return {
    isIndia,
    currency: billingCurrency,
    pro: {
      monthly: get('pro', 'monthly'),
      yearly: get('pro', 'yearly'),
      // Back-compat shape — defaults to the format the old PricingPage used.
      price: isIndia ? PLAN_PRICING.pro.inr.monthly.label : PLAN_PRICING.pro.usd.yearly.label,
      originalPrice: isIndia ? null : PLAN_PRICING.pro.usd.yearly.originalLabel,
      period: isIndia ? PLAN_PRICING.pro.inr.monthly.period : PLAN_PRICING.pro.usd.yearly.period,
      sub: isIndia ? null : getMonthlyEquivalent('pro', 'USD'),
    },
    enterprise: {
      monthly: get('enterprise', 'monthly'),
      yearly: get('enterprise', 'yearly'),
      price: isIndia ? PLAN_PRICING.enterprise.inr.monthly.label : PLAN_PRICING.enterprise.usd.yearly.label,
      originalPrice: isIndia ? null : PLAN_PRICING.enterprise.usd.yearly.originalLabel,
      period: isIndia ? PLAN_PRICING.enterprise.inr.monthly.period : PLAN_PRICING.enterprise.usd.yearly.period,
      sub: isIndia ? null : getMonthlyEquivalent('enterprise', 'USD'),
    },
  };
};
