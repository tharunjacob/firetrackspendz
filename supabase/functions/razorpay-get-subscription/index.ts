// supabase/functions/razorpay-get-subscription/index.ts
//
// Returns the current Razorpay subscription for the authenticated user.
// Used by the Settings → Subscription Manager UI to show the next billing
// date, billing period, and cancel button.
//
// Deploy:
//   supabase functions deploy razorpay-get-subscription --no-verify-jwt

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import {
  corsHeaders,
  jsonResponse,
  authenticateUser,
  razorpayFetch,
} from '../_shared/razorpay.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const { user, serviceClient } = await authenticateUser(req);

    const { data: profile, error: profileErr } = await serviceClient
      .from('user_profiles')
      .select('razorpay_subscription_id')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile?.razorpay_subscription_id) {
      return jsonResponse({ error: 'No subscription found' }, 404);
    }

    const rzpResp = await razorpayFetch(`/subscriptions/${profile.razorpay_subscription_id}`);
    const rzpJson = await rzpResp.json();

    if (!rzpResp.ok) {
      console.error('[razorpay-get-subscription] Razorpay error', rzpJson);
      return jsonResponse({
        error: rzpJson?.error?.description || 'Could not fetch subscription',
      }, 502);
    }

    return jsonResponse({
      id: rzpJson.id,
      status: rzpJson.status,
      plan_id: rzpJson.plan_id,
      current_start: rzpJson.current_start ?? null,
      current_end: rzpJson.current_end ?? null,
      charge_at: rzpJson.charge_at ?? null,
      total_count: rzpJson.total_count ?? 0,
      paid_count: rzpJson.paid_count ?? 0,
      short_url: rzpJson.short_url ?? null,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[razorpay-get-subscription] Unexpected', err);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
