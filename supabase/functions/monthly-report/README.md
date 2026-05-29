# monthly-report Edge Function

Generates and emails a **Monthly Financial Report Card** to opted-in TrackSpendZ users on the 1st of every month.

## What it sends

- Savings rate for the previous month (shown as a letter grade A–F)
- Income vs expenses summary
- Top 3 spending categories
- Budget adherence ("X of Y budgets on track")
- CTA button → upload this month's statements
- Unsubscribe footer link

---

## Deploy

```bash
supabase functions deploy monthly-report
```

## Required secrets

Set these in your Supabase project under **Settings → Edge Functions → Secrets**:

| Secret | Description |
|--------|-------------|
| `RESEND_API_KEY` | API key from [resend.com](https://resend.com) — used to send the report card email |
| `SUPABASE_SERVICE_ROLE_KEY` | Your project's service role key — already available as a built-in secret in Edge Functions |
| `SUPABASE_URL` | Your project URL — already available as a built-in secret |

> `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL` are injected automatically by the Supabase runtime; you only need to add `RESEND_API_KEY`.

---

## Set up pg_cron (Supabase dashboard → SQL Editor)

Run this once to schedule the job. It fires on the 1st of every month at 8am UTC and sends to all users who haven't opted out.

```sql
-- Enable the pg_cron and pg_net extensions if not already enabled
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Store your project URL and service role key as settings
-- (replace the placeholder values)
alter database postgres
  set app.supabase_url = 'https://<your-project-ref>.supabase.co';
alter database postgres
  set app.service_role_key = '<your-service-role-key>';

-- Schedule the monthly report on the 1st of every month at 8am UTC
select cron.schedule(
  'monthly-report-card',
  '0 8 1 * *',
  $$
  select net.http_post(
    url    := current_setting('app.supabase_url') || '/functions/v1/monthly-report',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body   := (
      select jsonb_agg(jsonb_build_object('user_id', id))
      from auth.users
      where raw_user_meta_data->>'email_notifications' != 'false'
    )
  )
  $$
);
```

To verify the job is scheduled:

```sql
select * from cron.job;
```

To unschedule:

```sql
select cron.unschedule('monthly-report-card');
```

---

## Trigger manually (for testing)

Replace `<PROJECT_REF>` and `<SERVICE_ROLE_KEY>` with your actual values, and `<USER_ID>` with a real user UUID from `auth.users`.

```bash
curl -X POST \
  https://<PROJECT_REF>.supabase.co/functions/v1/monthly-report \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "<USER_ID>"}'
```

Expected response:

```json
{
  "sent": 1,
  "total": 1,
  "results": [
    { "user_id": "...", "success": true, "email": "user@example.com" }
  ]
}
```

---

## How the function works

1. **Auth** — accepts the service role key as a Bearer token (safe server-to-server only).
2. **Payload** — accepts either `{ "user_id": "..." }` (single, for testing) or `[{ "user_id": "..." }, ...]` (array, from pg_cron).
3. **Per user:**
   - Fetches email from `auth.users` via admin API.
   - Fetches name + currency from `user_profiles`.
   - Fetches last month's transactions from `transactions`.
   - Computes savings rate, top 3 categories, budget adherence (from `user_settings` key `tsz_budgets`).
   - Builds HTML email via `email-template.ts`.
   - Sends via [Resend](https://resend.com).
   - Logs `monthly_report_sent` event to `app_logs`.
4. A failed send for one user does **not** abort the rest — errors are collected and returned in the response.
