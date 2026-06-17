/**
 * Razorpay integration service (client-side).
 *
 * Architecture:
 *   1. Client calls the `razorpay-create-subscription` edge function.
 *      The edge function creates a Razorpay subscription server-side
 *      using the secret key, and returns { subscriptionId, keyId }.
 *   2. Client loads checkout.js and opens the Razorpay checkout modal
 *      with that subscription_id.
 *   3. User authorizes the mandate (UPI / card). Razorpay's checkout
 *      calls our `handler` with razorpay_payment_id, razorpay_subscription_id,
 *      and razorpay_signature.
 *   4. Client posts those to `razorpay-verify-subscription` for
 *      signature verification + DB write. (Webhook also fires server-side
 *      and is the source of truth — verify endpoint is a fast-path UX nicety
 *      that updates the user's plan immediately on success.)
 *   5. Recurring charges are billed automatically by Razorpay. Each
 *      `subscription.charged` webhook updates next_billing_date.
 *
 * Required env vars:
 * - VITE_RAZORPAY_KEY_ID     (publishable, ships to client — safe)
 *
 * Server-side secrets (set via `supabase secrets set ...`):
 * - RAZORPAY_KEY_ID
 * - RAZORPAY_KEY_SECRET
 * - RAZORPAY_WEBHOOK_SECRET
 * - RAZORPAY_PLAN_PRO_INR_MONTHLY  etc. (see RAZORPAY_SETUP.md)
 */

import type { BillingCurrency, BillingPeriod } from '@/config/plans';

const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || '';
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

/**
 * True when the client-side publishable key is configured.
 * The Pricing page falls back to a "payments being set up" message when false.
 */
export const isRazorpayAvailable = (): boolean => !!RAZORPAY_KEY_ID;

// ─── Razorpay checkout types ─────────────────────────────────────────────────
// We declare a minimal shape rather than depending on @types/razorpay so the
// bundle stays small and we don't pull in a fragile global type.

export interface RazorpayCheckoutSuccess {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckoutOptions {
  key: string;
  subscription_id: string;
  name: string;
  description?: string;
  image?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler: (response: RazorpayCheckoutSuccess) => void;
  modal?: { ondismiss?: () => void; escape?: boolean };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (err: unknown) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (opts: RazorpayCheckoutOptions) => RazorpayInstance;
  }
}

// ─── Script loader ──────────────────────────────────────────────────────────
let scriptPromise: Promise<void> | null = null;

/**
 * Lazy-load the Razorpay checkout SDK. Multiple callers share one fetch.
 * Resolves when window.Razorpay is callable.
 */
function loadCheckoutScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR unsupported'));
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${CHECKOUT_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Razorpay')));
      if (window.Razorpay) resolve();
      return;
    }
    const tag = document.createElement('script');
    tag.src = CHECKOUT_SCRIPT;
    tag.async = true;
    tag.onload = () => resolve();
    tag.onerror = () => {
      scriptPromise = null;
      reject(new Error('Failed to load Razorpay checkout'));
    };
    document.head.appendChild(tag);
  });
  return scriptPromise;
}

// ─── Edge function calls ────────────────────────────────────────────────────

interface CreateSubscriptionResponse {
  subscriptionId: string;
  keyId: string;
}

/**
 * Ask the edge function to create a Razorpay subscription for this user
 * on the (tier, currency, period) combo. The edge function maps that to a
 * Razorpay plan_id from its env vars.
 */
async function createSubscription(args: {
  tier: 'pro' | 'enterprise';
  currency: BillingCurrency;
  period: BillingPeriod;
  accessToken: string;
}): Promise<CreateSubscriptionResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  let response: Response;
  try {
  response = await fetch(`${SUPABASE_URL}/functions/v1/razorpay-create-subscription`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.accessToken}`,
    },
    body: JSON.stringify({
      tier: args.tier,
      currency: args.currency,
      period: args.period,
    }),
    signal: controller.signal,
  });
  } finally { clearTimeout(timeoutId); }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Could not create subscription');
  }
  return response.json();
}

/**
 * Server-side signature verification + plan promotion.
 * The webhook also handles this — calling verify is a fast UX path so we can
 * close the upgrade flow immediately without waiting for the webhook.
 */
async function verifySubscription(args: {
  payment: RazorpayCheckoutSuccess;
  accessToken: string;
}): Promise<{ ok: true }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  let response: Response;
  try {
  response = await fetch(`${SUPABASE_URL}/functions/v1/razorpay-verify-subscription`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.accessToken}`,
    },
    body: JSON.stringify(args.payment),
    signal: controller.signal,
  });
  } finally { clearTimeout(timeoutId); }
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Could not verify payment');
  }
  return response.json();
}

/**
 * Cancel the current subscription. Razorpay supports immediate cancel or
 * cancel-at-cycle-end (default). We cancel at cycle end so the user keeps
 * Pro access until they've already paid for.
 */
export async function cancelSubscription(args: {
  cancelAtCycleEnd: boolean;
  accessToken: string;
}): Promise<{ status: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  let response: Response;
  try {
  response = await fetch(`${SUPABASE_URL}/functions/v1/razorpay-cancel-subscription`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.accessToken}`,
    },
    body: JSON.stringify({ cancel_at_cycle_end: args.cancelAtCycleEnd }),
    signal: controller.signal,
  });
  } finally { clearTimeout(timeoutId); }
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Could not cancel subscription');
  }
  return response.json();
}

export interface SubscriptionDetails {
  id: string;
  status: string;
  plan_id: string;
  current_start: number | null;
  current_end: number | null;
  charge_at: number | null;
  total_count: number;
  paid_count: number;
  short_url: string | null;
}

/**
 * Fetch the user's current Razorpay subscription from the edge function.
 * Used by the Subscription Manager UI in /settings.
 */
export async function fetchSubscriptionDetails(accessToken: string): Promise<SubscriptionDetails | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  let response: Response;
  try {
  response = await fetch(`${SUPABASE_URL}/functions/v1/razorpay-get-subscription`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: controller.signal,
  });
  } finally { clearTimeout(timeoutId); }
  if (response.status === 404) return null;
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Could not load subscription');
  }
  return response.json();
}

// ─── Full upgrade flow ──────────────────────────────────────────────────────

export interface UpgradeArgs {
  tier: 'pro' | 'enterprise';
  currency: BillingCurrency;
  period: BillingPeriod;
  accessToken: string;
  user: { id: string; email: string; name?: string; contact?: string };
}

export interface UpgradeResult {
  success: boolean;
  /** Filled on success — the payment that authorized the mandate. */
  payment?: RazorpayCheckoutSuccess;
  /** Filled when the user dismissed the modal without paying. */
  dismissed?: boolean;
  /** Filled on any error path. */
  error?: string;
}

/**
 * Run the full upgrade dance:
 *   create subscription → load checkout → open modal → verify on success.
 * Returns once the modal closes (either via payment or dismiss).
 */
export async function startUpgrade(args: UpgradeArgs): Promise<UpgradeResult> {
  if (!isRazorpayAvailable()) {
    return {
      success: false,
      error: 'Payment processing is being set up. Please try again soon or contact support.',
    };
  }

  // 1. Server creates the subscription (returns sub_xxx and the publishable key).
  let session: CreateSubscriptionResponse;
  try {
    session = await createSubscription({
      tier: args.tier,
      currency: args.currency,
      period: args.period,
      accessToken: args.accessToken,
    });
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Subscription create failed' };
  }

  // 2. Load checkout SDK.
  try {
    await loadCheckoutScript();
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Could not load Razorpay' };
  }
  if (!window.Razorpay) {
    return { success: false, error: 'Razorpay checkout unavailable' };
  }

  // 3. Open the modal and wrap the callbacks in a promise.
  return new Promise<UpgradeResult>((resolve) => {
    let settled = false;
    const settle = (r: UpgradeResult) => {
      if (settled) return;
      settled = true;
      resolve(r);
    };

    const rzp = new window.Razorpay!({
      key: session.keyId,
      subscription_id: session.subscriptionId,
      name: 'TrackSpendZ (Krexo LLP)',
      description: `${args.tier === 'pro' ? 'Pro' : 'Enterprise'} — billed ${args.period} (charged as Krexo LLP)`,
      prefill: {
        email: args.user.email,
        name: args.user.name,
        contact: args.user.contact,
      },
      notes: {
        user_id: args.user.id,
        tier: args.tier,
        period: args.period,
        currency: args.currency,
      },
      theme: { color: '#0066ff' },
      modal: {
        ondismiss: () => settle({ success: false, dismissed: true }),
      },
      handler: async (response) => {
        try {
          await verifySubscription({ payment: response, accessToken: args.accessToken });
          settle({ success: true, payment: response });
        } catch (e) {
          // The mandate is authorized in Razorpay — the webhook will still
          // eventually promote the user. Surface a soft error to the UI.
          settle({
            success: false,
            payment: response,
            error: e instanceof Error ? e.message : 'Verification failed — your plan will activate within a minute',
          });
        }
      },
    });
    rzp.on('payment.failed', (err) => {
      const msg = (err as { error?: { description?: string } })?.error?.description || 'Payment failed';
      settle({ success: false, error: msg });
    });
    rzp.open();
  });
}
