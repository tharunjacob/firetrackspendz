import { useEffect, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import {
  fetchSubscriptionDetails,
  cancelSubscription,
  type SubscriptionDetails,
} from '@/services/paymentProvider';
import { getSupabase } from '@/services/supabase';

/**
 * In-app replacement for Stripe's customer portal.
 *
 * Razorpay doesn't offer a hosted "manage your subscription" page, so we
 * render plan, next charge date, and a Cancel button. Cancel defaults to
 * cancel-at-cycle-end so the user keeps Pro access until what they've
 * already paid for runs out.
 */
const formatDate = (unix: number | null): string => {
  if (!unix) return '—';
  return new Date(unix * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const SubscriptionManager = () => {
  const { plan, profile, showToast, refreshProfile } = useApp();
  const [details, setDetails] = useState<SubscriptionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await getSupabase().auth.getSession();
        if (!session) { setLoading(false); return; }
        const d = await fetchSubscriptionDetails(session.access_token);
        if (!cancelled) setDetails(d);
      } catch (e) {
        if (!cancelled) {
          console.warn('[SubscriptionManager] Failed to load', e);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.razorpay_subscription_id]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const { data: { session } } = await getSupabase().auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await cancelSubscription({
        cancelAtCycleEnd: true,
        accessToken: session.access_token,
      });
      showToast?.(
        res.status === 'cancelled'
          ? 'Subscription cancelled.'
          : 'Cancellation scheduled — Pro stays active until your next billing date.',
        'success',
      );
      setConfirmCancel(false);
      // Re-fetch so the UI reflects the new state.
      const updated = await fetchSubscriptionDetails(session.access_token);
      setDetails(updated);
      await refreshProfile();
    } catch (e) {
      showToast?.(e instanceof Error ? e.message : 'Could not cancel subscription', 'error');
    } finally {
      setCancelling(false);
    }
  };

  if (plan === 'free') return null;

  if (loading) {
    return (
      <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-xs text-slate-500">
        Loading subscription details...
      </div>
    );
  }

  if (!details) {
    // Plan is non-free but we can't find a Razorpay subscription — likely an
    // admin-mocked upgrade or pre-Razorpay user. Hide the manager.
    return null;
  }

  const periodLabel = profile?.subscription_period === 'yearly' ? 'Yearly' : 'Monthly';
  const isCancelled = details.status === 'cancelled' || details.status === 'completed';
  // A cancel-at-cycle-end was requested: the user keeps Pro until the period
  // ends. The edge function persists this on the profile, so the banner shows
  // even across refreshes and even if the end-of-cycle webhook is delayed.
  const isCancelScheduled = !isCancelled && profile?.cancel_at_period_end === true;

  return (
    <div className="mt-4 border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50/50 dark:bg-slate-800/50">
      <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
        Subscription
      </h3>

      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
        <div>
          <p className="text-xs text-slate-500">Billing</p>
          <p className="font-medium text-slate-700 dark:text-slate-200">{periodLabel}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Status</p>
          <p className="font-medium text-slate-700 dark:text-slate-200 capitalize">{details.status}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">{isCancelled ? 'Ended on' : 'Next charge'}</p>
          <p className="font-medium text-slate-700 dark:text-slate-200">
            {formatDate(details.charge_at ?? details.current_end)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Cycles paid</p>
          <p className="font-medium text-slate-700 dark:text-slate-200">
            {details.paid_count} / {details.total_count}
          </p>
        </div>
      </div>

      {isCancelScheduled && (
        <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-700 dark:text-amber-300">
          Cancellation scheduled. You'll keep Pro access until {formatDate(details.current_end)}.
        </div>
      )}

      {!isCancelled && !isCancelScheduled && (
        confirmCancel ? (
          <div className="space-y-2">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Cancel at the end of your billing period? You'll keep Pro until {formatDate(details.current_end)}.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="btn-danger text-xs px-3 py-1.5 disabled:opacity-50"
              >
                {cancelling ? 'Cancelling...' : 'Yes, cancel'}
              </button>
              <button
                onClick={() => setConfirmCancel(false)}
                disabled={cancelling}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                Keep my plan
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmCancel(true)}
            className="text-xs text-slate-500 hover:text-red-600 underline"
          >
            Cancel subscription
          </button>
        )
      )}
    </div>
  );
};
