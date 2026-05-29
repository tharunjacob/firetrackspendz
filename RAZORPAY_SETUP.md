# Razorpay Setup Guide

End-to-end checklist for activating Razorpay payments on TrackSpendZ. The
code is already wired — once your Razorpay account is approved, follow this
guide top-to-bottom to go from zero to "user can pay" in ~30 minutes.

---

## 1. Razorpay account prerequisites

You need:
- A Razorpay merchant account in **activated** state (KYC complete).
- **Subscriptions** product enabled on your account
  (Dashboard → Subscriptions → "Get Started" if not visible).
- (Optional) **International Payments** enabled if you want to bill USD
  natively. Without this, USD-priced plans charge the INR equivalent.

---

## 2. Create the four (or eight) Plans in Razorpay

Razorpay Plans are reusable billing templates. We need one per
(tier, currency, period) combination. Minimum 4 plans (INR only).

**Dashboard → Subscriptions → Plans → Create Plan.**

| Plan name in dashboard       | Period  | Interval | Amount (paise) | Currency |
|------------------------------|---------|----------|----------------|----------|
| TrackSpendZ Pro – Monthly    | monthly | 1        | 19900          | INR      |
| TrackSpendZ Pro – Yearly     | yearly  | 1        | 149900         | INR      |
| TrackSpendZ Enterprise – Mo  | monthly | 1        | 49900          | INR      |
| TrackSpendZ Enterprise – Yr  | yearly  | 1        | 399900         | INR      |

> Razorpay amounts are in **paise** (₹1 = 100 paise). 19900 paise = ₹199.

**Optional USD plans** (only if International Payments is enabled):

| Plan name                          | Period  | Amount (cents) | Currency |
|------------------------------------|---------|----------------|----------|
| TrackSpendZ Pro – Monthly (USD)    | monthly | 499            | USD      |
| TrackSpendZ Pro – Yearly (USD)     | yearly  | 4900           | USD      |
| TrackSpendZ Enterprise – Mo (USD)  | monthly | 1499           | USD      |
| TrackSpendZ Enterprise – Yr (USD)  | yearly  | 14900          | USD      |

After creating each plan, copy its **Plan ID** (format: `plan_xxxxxxxxxxxxxx`).

---

## 3. Get your API keys

**Dashboard → Settings → API Keys → Generate Test Key** (or Live Key once
ready for production).

You'll get two values:
- **Key ID** (`rzp_test_...` or `rzp_live_...`) — public, ships to client.
- **Key Secret** — server-only, never expose.

---

## 4. Configure the webhook

**Dashboard → Settings → Webhooks → Add New Webhook.**

- **Webhook URL:** `https://<your-supabase-project>.supabase.co/functions/v1/razorpay-webhook`
- **Secret:** generate a long random string and copy it — you'll set this as
  `RAZORPAY_WEBHOOK_SECRET` in Supabase below.
- **Active Events** (tick these and only these):
  - `subscription.activated`
  - `subscription.charged`
  - `subscription.completed`
  - `subscription.cancelled`
  - `subscription.paused`
  - `subscription.resumed`
  - `subscription.halted`
  - `subscription.pending`
  - `subscription.authenticated`
  - `subscription.expired`

---

## 5. Set Supabase secrets

Run from the repo root (requires the [Supabase CLI](https://supabase.com/docs/guides/cli)):

```bash
supabase secrets set RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
supabase secrets set RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxx
supabase secrets set RAZORPAY_WEBHOOK_SECRET=<the random string from step 4>

# Plan IDs from step 2 — minimum: the 4 INR plans
supabase secrets set RAZORPAY_PLAN_PRO_INR_MONTHLY=plan_xxx
supabase secrets set RAZORPAY_PLAN_PRO_INR_YEARLY=plan_xxx
supabase secrets set RAZORPAY_PLAN_ENTERPRISE_INR_MONTHLY=plan_xxx
supabase secrets set RAZORPAY_PLAN_ENTERPRISE_INR_YEARLY=plan_xxx

# Optional USD plans
supabase secrets set RAZORPAY_PLAN_PRO_USD_MONTHLY=plan_xxx
supabase secrets set RAZORPAY_PLAN_PRO_USD_YEARLY=plan_xxx
supabase secrets set RAZORPAY_PLAN_ENTERPRISE_USD_MONTHLY=plan_xxx
supabase secrets set RAZORPAY_PLAN_ENTERPRISE_USD_YEARLY=plan_xxx
```

> Without the USD plan secrets, USD-priced users are silently charged the
> INR-equivalent plan instead. See `getPlanId()` in
> `supabase/functions/_shared/razorpay.ts`.

---

## 6. Set the publishable key locally

Add to your `.env`:

```
VITE_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
```

The PricingPage and SubscriptionManager check
`isPaymentAvailable()` — which reads this var. Without it, the upgrade
button shows "Payments are being set up".

---

## 7. Deploy the edge functions

From the repo root:

```bash
supabase functions deploy razorpay-create-subscription   --no-verify-jwt
supabase functions deploy razorpay-verify-subscription   --no-verify-jwt
supabase functions deploy razorpay-cancel-subscription   --no-verify-jwt
supabase functions deploy razorpay-get-subscription      --no-verify-jwt
supabase functions deploy razorpay-webhook               --no-verify-jwt
```

`--no-verify-jwt` is required: every function does its OWN auth — either
Razorpay HMAC (webhook) or Supabase user JWT (others). Letting Supabase
auto-verify would reject the webhook because Razorpay doesn't send a
Supabase JWT.

---

## 8. Run the DB migration

Apply `supabase/schema.sql` via Supabase Dashboard → SQL Editor.
The new ALTER blocks are idempotent — re-running is safe.

---

## 9. Test in test mode

1. Run `npm run dev`.
2. Sign in with a test account.
3. Go to `/pricing`, click "Get Pro" with Yearly selected.
4. Razorpay Checkout opens. Use a [test card](https://razorpay.com/docs/payments/payments/test-card-upi-details/):
   - Card: `4111 1111 1111 1111`
   - CVV: any 3 digits
   - Expiry: any future date
   - OTP: `123456`
5. After success: you should land on `/dashboard?payment=success&plan=pro`,
   and your `user_profiles.subscription_plan` should be `pro` with
   `subscription_status = 'active'`.
6. Verify the webhook by checking the Supabase Edge Function logs:
   `subscription.activated` and `subscription.charged` should both arrive.
7. Go to `/settings` — the Subscription Manager should show "Next charge"
   in ~1 year, with a Cancel button.

---

## 10. Going live

1. Generate live API keys in Razorpay Dashboard.
2. Re-run all `supabase secrets set ...` commands with the live values.
3. Update `VITE_RAZORPAY_KEY_ID` to the `rzp_live_...` value.
4. Re-run the production deploy of your frontend.
5. Update the webhook URL (the test/live keys share the same webhook
   endpoint, but you may want a separate webhook with a different secret).

---

## Troubleshooting

**"No Razorpay plan configured for …" error on upgrade**
The edge function couldn't find a `RAZORPAY_PLAN_<TIER>_<CURRENCY>_<PERIOD>`
secret. Re-run `supabase secrets list` to confirm.

**Checkout opens but says "Subscription not found"**
The `razorpay-create-subscription` function ran but the response didn't
reach the client. Check Supabase function logs.

**Webhook never fires**
- Confirm the webhook URL ends in `/razorpay-webhook` (not just `/webhook`).
- Confirm `RAZORPAY_WEBHOOK_SECRET` matches what you set in the Razorpay
  dashboard (case-sensitive).
- Check Edge Function logs for `[razorpay-webhook] Invalid signature` —
  that means the secret doesn't match.

**Subscription doesn't activate after successful payment**
- Open Supabase logs for `razorpay-verify-subscription`. The most common
  failure is a signature mismatch (wrong `RAZORPAY_KEY_SECRET`).
- The webhook is the source of truth — even if verify fails, the next
  `subscription.activated` webhook should flip the user to Pro.

---

## Adding Stripe back for international (future)

The codebase keeps `src/services/stripe.ts` as a deprecation stub. To bring
Stripe back for USD users:

1. Restore the edge-function templates that were inside `src/services/stripe.ts`
   prior to the Razorpay migration (check git history).
2. Re-implement `createCheckoutSession` and `createPortalSession` in the stub.
3. In `src/services/paymentProvider.ts`, change `getProvider(currency)`:
   ```ts
   return currency === 'USD' ? 'stripe' : 'razorpay';
   ```
4. In `upgrade()`, branch on the provider and call the right startUpgrade.

The DB schema already supports both providers via `subscription_provider`.
