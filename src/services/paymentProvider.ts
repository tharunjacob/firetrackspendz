/**
 * Payment provider abstraction.
 *
 * Today: only Razorpay is wired up. Stripe was the previous provider and
 * may come back for USD billing alongside Razorpay (see RAZORPAY_SETUP.md
 * § "Adding Stripe back for international").
 *
 * The Pricing page and Settings page import from THIS file, not directly
 * from razorpay.ts, so that switching providers is a one-file change.
 */

import {
  startUpgrade,
  cancelSubscription,
  fetchSubscriptionDetails,
  isRazorpayAvailable,
  type UpgradeArgs,
  type UpgradeResult,
  type SubscriptionDetails,
} from './razorpay';

export type PaymentProvider = 'razorpay' | 'stripe';

/**
 * Which provider this user (or this currency) should be billed by.
 * Currently always Razorpay. A future split could route USD users to Stripe:
 *
 *   if (currency === 'USD') return 'stripe';
 *   return 'razorpay';
 */
export function getProvider(_currency?: 'INR' | 'USD'): PaymentProvider {
  return 'razorpay';
}

/** True when *any* configured payment provider can process payments. */
export function isPaymentAvailable(): boolean {
  return isRazorpayAvailable();
}

/** Kick off an upgrade. Routes to the right provider based on currency. */
export function upgrade(args: UpgradeArgs): Promise<UpgradeResult> {
  // Single-provider for now — when adding Stripe, branch on getProvider(args.currency).
  return startUpgrade(args);
}

export { cancelSubscription, fetchSubscriptionDetails };
export type { UpgradeArgs, UpgradeResult, SubscriptionDetails };
