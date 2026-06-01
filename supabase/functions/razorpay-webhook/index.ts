// supabase/functions/razorpay-webhook/index.ts
//
// Receives Razorpay webhook events and updates user_profiles. This is the
// SOURCE OF TRUTH for subscription state — verify-subscription only exists
// to give the client a fast confirmation; the webhook is what guarantees
// state stays in sync if the client tab closes mid-flow.
//
// Subscribe to these events in Razorpay Dashboard → Webhooks:
//   subscription.activated   — first successful charge, plan should be active
//   subscription.charged     — recurring successful charge, update next_billing_date
//   subscription.completed   — all billing cycles consumed, plan ended cleanly
//   subscription.cancelled   — user or admin cancelled
//   subscription.paused      — temporarily paused
//   subscription.resumed     — resumed from pause
//   subscription.halted      — payment failures stopped further attempts
//   subscription.pending     — Razorpay is retrying a failed charge
//   subscription.authenticated — mandate authorized, awaiting first charge
//   subscription.expired     — auth payment window lapsed without authorization
//
// Deploy WITHOUT JWT verification (Razorpay doesn't send a Supabase token):
//   supabase functions deploy razorpay-webhook --no-verify-jwt
//
// Add the webhook URL to Razorpay Dashboard:
//   https://<your-project>.supabase.co/functions/v1/razorpay-webhook

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse, verifyRazorpaySignature } from '../_shared/razorpay.ts';

interface RazorpaySubscriptionEntity {
  id: string;
  status: string;
  plan_id?: string;
  customer_id?: string;
  current_start?: number | null;
  current_end?: number | null;
  charge_at?: number | null;
  ended_at?: number | null;
  notes?: Record<string, string>;
}

interface RazorpayWebhookPayload {
  event: string;
  payload: {
    subscription?: { entity: RazorpaySubscriptionEntity };
    payment?: { entity: { subscription_id?: string; amount?: number; currency?: string } };
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  // 1. Verify the webhook signature. Use the RAW body — parsing destroys it.
  const rawBody = await req.text();
  const signature = req.headers.get('x-razorpay-signature') ?? '';
  const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET') ?? '';

  if (!webhookSecret) {
    console.error('[razorpay-webhook] RAZORPAY_WEBHOOK_SECRET not configured');
    return jsonResponse({ error: 'Webhook not configured' }, 500);
  }

  const valid = await verifyRazorpaySignature(rawBody, signature, webhookSecret);
  if (!valid) {
    console.warn('[razorpay-webhook] Invalid signature');
    return jsonResponse({ error: 'Invalid signature' }, 401);
  }

  let event: RazorpayWebhookPayload;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  // 2. Service-role client — webhooks bypass RLS.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // 3. Resolve which user this event belongs to. We look up by
  //    razorpay_subscription_id (set during razorpay-create-subscription).
  const subEntity = event.payload?.subscription?.entity;
  const paymentEntity = event.payload?.payment?.entity;
  const subscriptionId = subEntity?.id ?? paymentEntity?.subscription_id;

  if (!subscriptionId) {
    // Some events (e.g. payment.captured for one-off payments) won't have a
    // subscription — we don't care about those. Acknowledge and return.
    console.info('[razorpay-webhook] No subscription_id in event', event.event);
    return jsonResponse({ received: true });
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, subscription_plan, subscription_status, razorpay_subscription_id')
    .eq('razorpay_subscription_id', subscriptionId)
    .maybeSingle();

  if (!profile) {
    // The user_id is also in subscription.notes — try as a fallback. This can
    // happen if the create-subscription DB write failed but Razorpay succeeded.
    const userIdFromNotes = subEntity?.notes?.user_id;
    if (userIdFromNotes) {
      await supabase
        .from('user_profiles')
        .update({ razorpay_subscription_id: subscriptionId })
        .eq('id', userIdFromNotes);
    } else {
      console.warn('[razorpay-webhook] Unknown subscription', subscriptionId);
      // Still return 200 — otherwise Razorpay will keep retrying forever.
      return jsonResponse({ received: true, unknown: true });
    }
  }

  // 4. Map the event to a profile patch.
  // Resolve the plan tier for plan-bearing events (activated/charged). Razorpay
  // stamps the tier into subscription.notes at create time, but a delayed
  // 'subscription.charged' can occasionally arrive WITHOUT notes. Defaulting to
  // 'pro' in that case would silently downgrade an Enterprise subscriber, so we
  // only take the tier from notes when it's actually present; otherwise we keep
  // the paid tier already on the profile. 'pro' is the last resort, used only
  // when we have neither notes nor an existing paid plan to fall back to.
  const existingPaidTier =
    profile?.subscription_plan === 'enterprise' || profile?.subscription_plan === 'pro'
      ? profile.subscription_plan
      : null;
  const tier = (subEntity?.notes?.tier ?? existingPaidTier ?? 'pro') as 'pro' | 'enterprise';
  const next = subEntity?.charge_at ? new Date(subEntity.charge_at * 1000).toISOString() : null;

  const patches: Record<string, Record<string, unknown>> = {
    'subscription.activated': {
      subscription_plan: tier,
      subscription_status: 'active',
      next_billing_date: next,
    },
    'subscription.charged': {
      subscription_plan: tier,
      subscription_status: 'active',
      next_billing_date: next,
    },
    'subscription.authenticated': {
      subscription_status: 'authenticated',
    },
    'subscription.pending': {
      subscription_status: 'pending',
    },
    'subscription.halted': {
      subscription_status: 'halted',
    },
    'subscription.cancelled': {
      // Razorpay sends this both for immediate cancels (status goes to 'cancelled'
      // straight away) and for end-of-cycle cancels (status flips later). We
      // mark canceled and downgrade to free. Clear cancel_at_period_end now that
      // the scheduled cancel has actually taken effect — the pending marker has
      // served its purpose.
      subscription_status: 'canceled',
      subscription_plan: 'free',
      next_billing_date: null,
      cancel_at_period_end: false,
    },
    'subscription.paused': {
      subscription_status: 'past_due',
    },
    'subscription.resumed': {
      subscription_status: 'active',
    },
    'subscription.completed': {
      subscription_status: 'completed',
      subscription_plan: 'free',
      next_billing_date: null,
      cancel_at_period_end: false,
    },
    'subscription.expired': {
      subscription_status: 'expired',
      subscription_plan: 'free',
      next_billing_date: null,
      cancel_at_period_end: false,
    },
  };

  const patch = patches[event.event];
  if (!patch) {
    // We don't care about this event type — ack and move on.
    return jsonResponse({ received: true, ignored: event.event });
  }

  // Enrich the patch with subscription period and currency from notes if available
  const finalPatch = { ...patch };
  const period = subEntity?.notes?.period;
  const currency = subEntity?.notes?.currency;
  if (period) {
    finalPatch.subscription_period = period;
  }
  if (currency) {
    finalPatch.preferred_currency = currency;
  }

  // ─── Out-of-order delivery guard ────────────────────────────────────────────
  // Razorpay does NOT guarantee webhook delivery order. A delayed
  // 'subscription.charged' (or 'activated'/'resumed') can arrive AFTER a
  // 'subscription.cancelled'/'completed'/'expired' for the SAME subscription.
  // Without this guard, that stale event would flip a churned user back to
  // active/pro and resurrect a subscription they already lost.
  //
  // Terminal states are final for a given razorpay_subscription_id. A legitimate
  // re-subscribe always mints a NEW subscription_id (razorpay-create-subscription
  // overwrites razorpay_subscription_id and resets status), so the lookup above
  // would NOT resolve to a terminal profile in that case — which makes it always
  // safe to refuse re-activation here when the current status is terminal.
  //
  // (A stricter alternative would persist each event's timestamp on the profile
  // and reject any event older than the last applied one. That needs a new
  // column + migration; the terminal-state check below covers the dangerous
  // reactivation case without a schema change.)
  const TERMINAL_STATUSES = ['canceled', 'completed', 'expired'];
  const REACTIVATING_EVENTS = ['subscription.activated', 'subscription.charged', 'subscription.resumed'];
  if (
    REACTIVATING_EVENTS.includes(event.event) &&
    profile?.subscription_status &&
    TERMINAL_STATUSES.includes(profile.subscription_status)
  ) {
    console.warn('[razorpay-webhook] Ignoring out-of-order re-activation', {
      event: event.event,
      currentStatus: profile.subscription_status,
      subscriptionId,
    });
    // Return 200 so Razorpay stops retrying — the skip is intentional, not a failure.
    return jsonResponse({ received: true, skipped: 'terminal_state', event: event.event });
  }

  const target = supabase.from('user_profiles').update(finalPatch);
  if (profile?.id) {
    await target.eq('id', profile.id);
  } else {
    await target.eq('razorpay_subscription_id', subscriptionId);
  }

  return jsonResponse({ received: true, event: event.event });
});
