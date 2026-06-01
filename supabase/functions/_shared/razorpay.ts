// Shared Razorpay helpers used by all razorpay-* edge functions.
//
// IMPORTANT: This file is consumed by Deno (Supabase Edge Runtime), NOT by
// the Vite client bundle. Imports use full URLs / Deno globals.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── CORS ────────────────────────────────────────────────────────────────────
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

export const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

// ─── Auth ────────────────────────────────────────────────────────────────────
/**
 * Authenticate the caller from the Authorization header against Supabase.
 * Returns the user + a Supabase client scoped to that user's RLS.
 * Throws a Response on failure (callers re-throw to the runtime).
 */
export async function authenticateUser(req: Request): Promise<{
  user: { id: string; email?: string };
  userClient: SupabaseClient;
  serviceClient: SupabaseClient;
}> {
  const auth = req.headers.get('Authorization') ?? '';
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: auth } } },
  );
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) {
    throw jsonResponse({ error: 'Unauthorized' }, 401);
  }
  // Service-role client used to bypass RLS for writes the webhook needs.
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
  return { user: { id: user.id, email: user.email }, userClient, serviceClient };
}

// ─── Plan ID lookup ──────────────────────────────────────────────────────────
// Razorpay plan IDs are created in the Razorpay dashboard or via API. We store
// them as env vars so the same code works in test and live modes without a
// code change. Convention: RAZORPAY_PLAN_<TIER>_<CURRENCY>_<PERIOD>.
//
// The function falls back to the INR plan if a USD plan isn't configured —
// the user is still billed (in INR equivalent) rather than blocked.
type Tier = 'pro' | 'enterprise';
type Currency = 'INR' | 'USD';
type Period = 'monthly' | 'yearly';

export function getPlanId(tier: Tier, currency: Currency, period: Period): string | null {
  const key = `RAZORPAY_PLAN_${tier.toUpperCase()}_${currency.toUpperCase()}_${period.toUpperCase()}`;
  const direct = Deno.env.get(key);
  if (direct) return direct;
  // USD fallback → INR plan, charged in INR equivalent.
  if (currency === 'USD') {
    const fallbackKey = `RAZORPAY_PLAN_${tier.toUpperCase()}_INR_${period.toUpperCase()}`;
    return Deno.env.get(fallbackKey) ?? null;
  }
  return null;
}

// ─── Razorpay REST helpers ───────────────────────────────────────────────────
const RAZORPAY_API = 'https://api.razorpay.com/v1';

export function razorpayAuthHeader(): string {
  const id = Deno.env.get('RAZORPAY_KEY_ID') ?? '';
  const secret = Deno.env.get('RAZORPAY_KEY_SECRET') ?? '';
  // Razorpay uses HTTP Basic Auth: base64(key_id:key_secret).
  return 'Basic ' + btoa(`${id}:${secret}`);
}

export async function razorpayFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', razorpayAuthHeader());
  headers.set('Content-Type', 'application/json');
  return fetch(`${RAZORPAY_API}${path}`, { ...init, headers });
}

// ─── Signature verification ──────────────────────────────────────────────────
/**
 * Verify a Razorpay signature.
 *   - For checkout success: payload = `${payment_id}|${subscription_id}`, secret = key_secret
 *   - For webhooks:        payload = raw request body,                    secret = webhook_secret
 *
 * Razorpay uses HMAC-SHA256, hex digest, lower-case.
 */
export async function verifyRazorpaySignature(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const expected = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const signatureLower = signature.toLowerCase();
  // Length-aware comparison to avoid trivial timing leaks.
  if (expected.length !== signatureLower.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signatureLower.charCodeAt(i);
  }
  return diff === 0;
}
