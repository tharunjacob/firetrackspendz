# ai-proxy Edge Function

Proxies all Gemini API calls server-side so the API key is never embedded in the client bundle.

## Deploy

```bash
supabase functions deploy ai-proxy
```

## Set the secret key

```bash
supabase secrets set GEMINI_API_KEY=your_key_here
```

The function reads `GEMINI_API_KEY`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` from Deno environment — all three are injected automatically by the Supabase runtime. Only `GEMINI_API_KEY` needs to be set manually.

## Client-side env var

`VITE_GEMINI_API_KEY` is a **dev-only fallback**. When `VITE_SUPABASE_URL` is set (i.e. in any non-local environment), `aiProxy.ts` routes through this edge function instead. Remove `VITE_GEMINI_API_KEY` from production `.env` once the edge function is deployed.

## Authentication

Every request must carry a valid Supabase session token (`Authorization: Bearer <access_token>`). Unauthenticated calls receive a `401 Unauthorized` response. This prevents the proxy from being used as an open relay.
