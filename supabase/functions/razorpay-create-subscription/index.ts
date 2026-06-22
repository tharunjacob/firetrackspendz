// supabase/functions/razorpay-create-subscription/index.ts
//
// Creates a Razorpay subscription for the authenticated user on the
// (tier, currency, period) combo the client requested. Returns the
// subscription_id + publishable key so the client can open Checkout.
//
// Deploy:
//   supabase functions deploy razorpay-create-subscription --no-verify-jwt
//
// Secrets required:
//   RAZORPAY_KEY_ID
//   RAZORPAY_KEY_SECRET
//   RAZORPAY_PLAN_PRO_INR_MONTHLY        (and the 7 other variants — see RAZORPAY_SETUP.md)
//   SUPABASE_URL                         (set automatically by Supabase)
//   SUPABASE_ANON_KEY                    (set automatically)
//   SUPABASE_SERVICE_ROLE_KEY            (set automatically)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import {
  corsHeaders,
  jsonResponse,
  authenticateUser,
  getPlanId,
  razorpayFetch,
} from '../_shared/razorpay.ts';

// total_count is the number of billing cycles Razorpay will attempt before
// the subscription is "completed". We use 10 years' worth so users effectively
// have a perpetual subscription until they cancel. Razorpay's hard limit is
// 1200 for monthly and 100 for yearly.
const CYCLE_LIMITS = {
  monthly: 120, // 10 years of monthly billing
  yearly: 10,   // 10 years of yearly billing
} as const;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const { user, serviceClient } = await authenticateUser(req);

    const rzpKeyId = Deno.env.get('RAZORPAY_KEY_ID') ?? '';
    const rzpKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET') ?? '';
    // Never log key material (not even prefixes/lengths) — these end up in
    // function logs. Log only presence for diagnostics.
    if (!rzpKeyId || !rzpKeySecret) {
      console.error('[razorpay-create-subscription] Razorpay credentials not configured');
    }

    const body = await req.json().catch(() => ({})) as {
      tier?: 'pro' | 'enterprise';
      currency?: 'INR' | 'USD';
      period?: 'monthly' | 'yearly';
    };

    if (!body.tier || (body.tier !== 'pro' && body.tier !== 'enterprise')) {
      return jsonResponse({ error: 'Invalid tier' }, 400);
    }
    if (!body.currency || (body.currency !== 'INR' && body.currency !== 'USD')) {
      return jsonResponse({ error: 'Invalid currency' }, 400);
    }
    if (!body.period || (body.period !== 'monthly' && body.period !== 'yearly')) {
      return jsonResponse({ error: 'Invalid period' }, 400);
    }

    const planId = getPlanId(body.tier, body.currency, body.period);
    console.log('[razorpay-create-subscription] Plan details:', {
      tier: body.tier,
      currency: body.currency,
      period: body.period,
      planId,
    });
    if (!planId) {
      return jsonResponse({
        error: `No Razorpay plan configured for ${body.tier}/${body.currency}/${body.period}. ` +
               'Set the RAZORPAY_PLAN_* secret in Supabase — see RAZORPAY_SETUP.md.',
      }, 500);
    }

    // Guard against double-billing. Creating a new Razorpay subscription does
    // NOT cancel any existing one, so a user who clicks "Upgrade" twice (or in
    // two tabs) would end up with two live subscriptions billed in parallel.
    //
    // IMPORTANT: We must NOT block on the LOCAL subscription_status alone. This
    // function writes subscription_status='pending' BEFORE the user has paid (see
    // the update further below). If the user opens Checkout and closes it without
    // paying, that 'pending' would otherwise persist forever and permanently lock
    // them out of ever upgrading — a silent conversion killer. So instead of
    // trusting our own placeholder, we ask Razorpay for the subscription's REAL
    // state and only block when it is genuinely live/billable.
    const { data: profile } = await serviceClient
      .from('user_profiles')
      .select('razorpay_subscription_id, subscription_status')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.razorpay_subscription_id) {
      // Razorpay subscription states that mean a real, billable subscription is
      // already in place. 'created' = mandate never authorized (abandoned
      // checkout); 'halted'/'cancelled'/'completed'/'expired'/'paused' = not
      // billing — in all of those we let the user start fresh.
      const LIVE = ['authenticated', 'active', 'pending'];
      try {
        const existingResp = await razorpayFetch(
          `/subscriptions/${profile.razorpay_subscription_id}`,
        );
        if (existingResp.ok) {
          const existing = await existingResp.json();
          if (LIVE.includes(existing.status)) {
            return jsonResponse({
              error: 'You already have an active subscription. Manage it in Settings.',
            }, 409);
          }
          // Stale 'created' subscription from an abandoned checkout — best-effort
          // cancel so we don't leave dangling subscriptions, then fall through to
          // create a fresh one below.
          if (existing.status === 'created') {
            await razorpayFetch(
              `/subscriptions/${profile.razorpay_subscription_id}/cancel`,
              { method: 'POST', body: JSON.stringify({ cancel_at_cycle_end: 0 }) },
            ).catch(() => { /* best-effort cleanup; never blocks the new upgrade */ });
          }
        }
        // If the fetch failed (sub not found / Razorpay error), fall through and
        // create a new subscription rather than locking the user out.
      } catch (_e) {
        // Network/Razorpay hiccup — don't block the upgrade on it.
      }
    }

    // Create the subscription. Razorpay will return a subscription in "created"
    // state — the user authorizes the mandate via Checkout, after which it
    // transitions to "authenticated" → "active".
    const rzpResp = await razorpayFetch('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        plan_id: planId,
        total_count: CYCLE_LIMITS[body.period],
        quantity: 1,
        customer_notify: 1,
        notes: {
          user_id: user.id,
          email: user.email ?? '',
          tier: body.tier,
          period: body.period,
          currency: body.currency,
        },
      }),
    });

    const rzpJson = await rzpResp.json();
    if (!rzpResp.ok) {
      console.error('[razorpay-create-subscription] Razorpay error', rzpJson);
      return jsonResponse({
        error: rzpJson?.error?.description || 'Could not create subscription',
      }, 502);
    }

    // Persist the pending subscription on the user profile so the webhook
    // can correlate later events even if the client never returns.
    const { error: updateErr } = await serviceClient
      .from('user_profiles')
      .update({
        razorpay_subscription_id: rzpJson.id,
        subscription_provider: 'razorpay',
        subscription_period: body.period,
        subscription_status: 'pending',
      })
      .eq('id', user.id);

    if (updateErr) {
      console.error('[razorpay-create-subscription] DB update error:', updateErr);
      return jsonResponse({ error: `Database update failed: ${updateErr.message}` }, 500);
    }

    return jsonResponse({
      subscriptionId: rzpJson.id,
      keyId: Deno.env.get('RAZORPAY_KEY_ID') ?? '',
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[razorpay-create-subscription] Unexpected', err);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
