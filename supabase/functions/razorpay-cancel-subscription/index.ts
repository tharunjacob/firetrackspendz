// supabase/functions/razorpay-cancel-subscription/index.ts
//
// Cancels the authenticated user's Razorpay subscription. Defaults to
// cancel-at-cycle-end so the user keeps Pro access through the period
// they've already paid for. Pass { cancel_at_cycle_end: false } to cancel
// immediately (e.g. admin-initiated refund flow).
//
// Deploy:
//   supabase functions deploy razorpay-cancel-subscription --no-verify-jwt

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import {
  corsHeaders,
  jsonResponse,
  authenticateUser,
  razorpayFetch,
} from '../_shared/razorpay.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const { user, serviceClient } = await authenticateUser(req);
    const body = await req.json().catch(() => ({})) as { cancel_at_cycle_end?: boolean };
    const cancelAtCycleEnd = body.cancel_at_cycle_end !== false; // default true

    const { data: profile, error: profileErr } = await serviceClient
      .from('user_profiles')
      .select('razorpay_subscription_id, subscription_status')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile?.razorpay_subscription_id) {
      return jsonResponse({ error: 'No active subscription' }, 404);
    }

    const rzpResp = await razorpayFetch(
      `/subscriptions/${profile.razorpay_subscription_id}/cancel`,
      {
        method: 'POST',
        body: JSON.stringify({ cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0 }),
      },
    );
    const rzpJson = await rzpResp.json();

    if (!rzpResp.ok) {
      console.error('[razorpay-cancel-subscription] Razorpay error', rzpJson);
      return jsonResponse({
        error: rzpJson?.error?.description || 'Could not cancel subscription',
      }, 502);
    }

    // Persist the intent immediately so the UI doesn't depend on the webhook
    // round-trip (and so a missed end-of-cycle webhook still leaves a record
    // that a cancel was requested).
    //   - cancel-at-cycle-end: keep status 'active' (user still has Pro until
    //     next_billing_date) and set cancel_at_period_end=true. The end-of-cycle
    //     'subscription.cancelled' webhook flips plan->free and clears the flag.
    //   - immediate cancel: status -> 'canceled' now; flag stays false.
    await serviceClient
      .from('user_profiles')
      .update(
        cancelAtCycleEnd
          ? { subscription_status: 'active', cancel_at_period_end: true }
          : { subscription_status: 'canceled', cancel_at_period_end: false },
      )
      .eq('id', user.id);

    return jsonResponse({
      status: rzpJson.status,
      ends_at: rzpJson.current_end ? new Date(rzpJson.current_end * 1000).toISOString() : null,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[razorpay-cancel-subscription] Unexpected', err);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
