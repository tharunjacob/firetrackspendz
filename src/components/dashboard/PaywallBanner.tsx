import { useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { Icon } from '@/components/common/Icons';
import { ROUTES } from '@/config/routes';
import type { Transaction } from '@/types';
import { logEvent, EVENTS } from '@/services/logger';

// ============================================================
// Paywall Banner — Compact, non-intrusive banner over the free cap
// Shows date range of visible transactions.
//
// Two variants (the 500-txn cap is identical; only the upsell differs):
//   - 'anonymous': not signed in -> CTA opens the sign-up modal.
//   - 'free':      signed-in free tier -> CTA routes to /pricing to upgrade.
// ============================================================

interface PaywallBannerProps {
  totalCount: number;
  visibleCount: number;
  transactions?: Transaction[];
  /** 'anonymous' (sign up to unlock) or 'free' (upgrade to Pro). Default 'anonymous'. */
  variant?: 'anonymous' | 'free';
}

export const PaywallBanner = ({ totalCount, visibleCount, transactions = [], variant = 'anonymous' }: PaywallBannerProps) => {
  const { setIsAuthOpen } = useApp();
  const navigate = useNavigate();
  const hiddenCount = totalCount - visibleCount;
  const impressionFired = useRef(false);

  // Fire once per session when the paywall becomes visible
  useEffect(() => {
    if (hiddenCount > 0 && !impressionFired.current) {
      impressionFired.current = true;
      logEvent(EVENTS.PAYWALL_IMPRESSION, { totalCount, visibleCount, hiddenCount });
    }
  }, [hiddenCount, totalCount, visibleCount]);

  // Compute date range of visible transactions
  const dateRange = useMemo(() => {
    if (transactions.length === 0) return null;
    const dates = transactions.map(t => t.date).sort();
    const earliest = dates[0];
    const latest = dates[dates.length - 1];
    const formatDate = (d: string) => {
      try {
        return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      } catch { return d; }
    };
    return { from: formatDate(earliest), to: formatDate(latest) };
  }, [transactions]);

  if (hiddenCount <= 0) return null;

  const isFree = variant === 'free';
  const subtext = isFree
    ? 'Upgrade to Pro to unlock all your transactions, unlimited history, and cloud sync.'
    : 'Sign up free to unlock all transactions and cloud sync.';
  const ctaLabel = isFree ? 'Upgrade to Pro →' : 'Sign Up Free →';

  const handleCta = () => {
    logEvent(EVENTS.PAYWALL_CTA_CLICKED, { totalCount, hiddenCount, variant });
    if (isFree) {
      navigate(ROUTES.PRICING);
    } else {
      setIsAuthOpen(true);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-brand-200 dark:border-brand-800 rounded-lg p-4 mb-6 shadow-sm animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="w-8 h-8 bg-brand-100 dark:bg-brand-900/40 rounded-lg flex items-center justify-center shrink-0">
          <Icon name="shield" className="w-4 h-4 text-brand-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Showing <strong>{visibleCount.toLocaleString()}</strong> of <strong>{totalCount.toLocaleString()}</strong> transactions
            {dateRange && (
              <span className="text-slate-500 dark:text-slate-400"> — from <strong>{dateRange.from}</strong> to <strong>{dateRange.to}</strong></span>
            )}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {subtext}
          </p>
        </div>
        <button
          onClick={handleCta}
          className="focus-ring shrink-0 text-sm font-semibold text-brand-600 dark:text-brand-400 border border-brand-300 dark:border-brand-700 px-4 py-2 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/30 transition-colors"
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
};
