# Supabase Migrations

Run these SQL files in the [Supabase dashboard SQL editor](https://app.supabase.com) in ascending numerical order when setting up a new project.

| File | Description |
|------|-------------|
| `001_user_settings.sql` | Creates the `user_settings` key/value table used by Goals, Budgets, and other per-user preferences. |

> The main schema (tables for transactions, profiles, rules, etc.) lives in `supabase/schema.sql`.
> The files here cover incremental additions that postdate the initial schema.

## Edge Functions

The `supabase/functions/` directory contains Deno-based edge functions deployed alongside the database. They are **not** SQL migrations — deploy them separately:

```bash
# Deploy the AI proxy (moves Gemini calls server-side so the API key is never in the bundle)
supabase functions deploy ai-proxy
supabase secrets set GEMINI_API_KEY=your_key_here

# Deploy the welcome-email function (triggered by a DB webhook on user_profiles INSERT)
supabase functions deploy send-welcome-email
supabase secrets set RESEND_API_KEY=re_your_key_here
```

See each function's `README.md` for full deployment notes.
