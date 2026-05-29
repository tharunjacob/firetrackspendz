/**
 * Stripe integration — DEPRECATED.
 *
 * TrackSpendZ migrated to Razorpay as the sole payment provider. This file
 * is kept ONLY as a re-enablement reference for future USD billing.
 *
 * Do not call these functions from app code — they throw to surface mistakes.
 * Use `@/services/paymentProvider` instead.
 *
 * To re-enable Stripe for USD billing:
 *   1. Re-deploy the supabase/functions/create-checkout and stripe-webhook
 *      edge functions (templates preserved in git history before this commit).
 *   2. Restore VITE_STRIPE_PUBLISHABLE_KEY in .env.example.
 *   3. Update `getProvider(currency)` in paymentProvider.ts to return
 *      'stripe' for USD users.
 *   4. Add a Stripe-flavored startUpgrade() that mirrors razorpay.startUpgrade().
 */

const DEPRECATED_MSG =
  'Stripe is no longer active — TrackSpendZ uses Razorpay. ' +
  'Import from @/services/paymentProvider instead.';

/** @deprecated Use isPaymentAvailable() from paymentProvider.ts */
export const isStripeAvailable = (): boolean => false;

/** @deprecated Use upgrade() from paymentProvider.ts */
export async function createCheckoutSession(): Promise<string> {
  throw new Error(DEPRECATED_MSG);
}

/** @deprecated Razorpay has no Stripe-style customer portal — use SubscriptionManager UI instead. */
export async function createPortalSession(): Promise<string> {
  throw new Error(DEPRECATED_MSG);
}

/**
 * Admin-only mock upgrade. Used from the admin panel for testing.
 * Kept here because admin code still imports it — moves to a dedicated
 * admin service in a future cleanup pass.
 */
export async function mockUpgrade(
  userId: string,
  plan: 'pro' | 'enterprise',
): Promise<string> {
  const { supabase } = await import('./supabase');
  const { TABLES } = await import('@/config/database');
  if (!supabase) throw new Error('Supabase not configured');

  const { error } = await supabase
    .from(TABLES.USER_PROFILES)
    .update({
      subscription_plan: plan,
      subscription_status: 'active',
      subscription_provider: 'razorpay',
    })
    .eq('id', userId);

  if (error) throw error;
  return `${window.location.origin}/dashboard?payment=success&plan=${plan}`;
}
