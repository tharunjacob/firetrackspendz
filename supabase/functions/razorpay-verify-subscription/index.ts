// supabase/functions/razorpay-verify-subscription/index.ts
//
// Verifies the signature returned by Razorpay Checkout on success and
// promotes the user's plan. The webhook is the source of truth for plan
// state (it will fire even if the client tab is closed) — this endpoint
// exists so we can show "Welcome to Pro!" immediately instead of waiting
// for the webhook to land.
//
// Verification formula (per Razorpay docs):
//   generated = HMAC-SHA256(`${payment_id}|${subscription_id}`, key_secret)
//   matches when generated == razorpay_signature (hex)
//
// Deploy:
//   supabase functions deploy razorpay-verify-subscription --no-verify-jwt

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import {
  corsHeaders,
  jsonResponse,
  authenticateUser,
  verifyRazorpaySignature,
} from '../_shared/razorpay.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const { user, serviceClient } = await authenticateUser(req);
    const body = await req.json().catch(() => ({})) as {
      razorpay_payment_id?: string;
      razorpay_subscription_id?: string;
      razorpay_signature?: string;
    };

    if (!body.razorpay_payment_id || !body.razorpay_subscription_id || !body.razorpay_signature) {
      return jsonResponse({ error: 'Missing payment fields' }, 400);
    }

    const secret = Deno.env.get('RAZORPAY_KEY_SECRET') ?? '';
    if (!secret) return jsonResponse({ error: 'Razorpay not configured' }, 500);

    const payload = `${body.razorpay_payment_id}|${body.razorpay_subscription_id}`;
    const valid = await verifyRazorpaySignature(payload, body.razorpay_signature, secret);
    if (!valid) {
      console.warn('[razorpay-verify-subscription] Signature mismatch for user', user.id);
      return jsonResponse({ error: 'Invalid signature' }, 400);
    }

    // Confirm the subscription_id actually belongs to this user (defense in
    // depth — someone with a stolen signature would still be blocked here).
    const { data: profile, error: profileErr } = await serviceClient
      .from('user_profiles')
      .select('id, razorpay_subscription_id, subscription_period')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile) {
      return jsonResponse({ error: 'Profile not found' }, 404);
    }
    if (profile.razorpay_subscription_id !== body.razorpay_subscription_id) {
      console.warn('[razorpay-verify-subscription] subscription_id mismatch', {
        user: user.id,
        expected: profile.razorpay_subscription_id,
        got: body.razorpay_subscription_id,
      });
      return jsonResponse({ error: 'Subscription mismatch' }, 400);
    }

    // Read the actual tier/period from Razorpay rather than trust the client.
    // The "notes" we set on subscription creation are echoed back.
    const { razorpayFetch } = await import('../_shared/razorpay.ts');
    const subResp = await razorpayFetch(`/subscriptions/${body.razorpay_subscription_id}`);

    // The razorpay-webhook is the AUTHORITATIVE source for the tier — it fires
    // server-to-server (even with the tab closed) and re-syncs subscription_plan
    // from the real subscription. This endpoint only exists for instant
    // "Welcome to Pro!" UX. So if the GET fails (5xx / rate-limit), `subResp`
    // is an error body with no `notes` — defaulting tier to 'pro' here would
    // silently DOWNGRADE an Enterprise buyer. Instead we flip status to active
    // (so the client UX proceeds) and leave subscription_plan / next_billing_date
    // untouched, deferring the correct tier to the webhook.
    const update: Record<string, unknown> = {
      subscription_status: 'active',
      subscription_provider: 'razorpay',
    };

    if (subResp.ok) {
      const sub = await subResp.json();
      const tier = (sub?.notes?.tier ?? 'pro') as 'pro' | 'enterprise';
      update.subscription_plan = tier;
      update.next_billing_date = sub?.charge_at ? new Date(sub.charge_at * 1000).toISOString() : null;
      if (sub?.notes?.period) {
        update.subscription_period = sub.notes.period;
      }
      if (sub?.notes?.currency) {
        update.preferred_currency = sub.notes.currency;
      }
    } else {
      console.warn(
        '[razorpay-verify-subscription] Subscription fetch failed; deferring tier to webhook',
        { user: user.id, status: subResp.status },
      );
    }

    await serviceClient
      .from('user_profiles')
      .update(update)
      .eq('id', user.id);

    return jsonResponse({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[razorpay-verify-subscription] Unexpected', err);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
