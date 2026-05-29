# TrackSpendZ v2 — Claude Code Prompts
## Run these one at a time in a Claude Code CLI session

Each prompt is self-contained. Run them in order — earlier ones set up infrastructure that later ones depend on.

---

## PROMPT 1 — Persistence Infrastructure: Budgets + Goals (Supabase schema + hardening)

```
You are working on TrackSpendZ v2, a personal finance web app (React 18 + TypeScript + Vite + Supabase).

## Context

Two paid features — Budgets and Goals — must persist across page refreshes for signed-in Pro/Enterprise users. The code already routes through `src/services/userSettings.ts` which talks to a Supabase `user_settings` table when authenticated, and falls back to localStorage otherwise. However:

1. The `user_settings` table schema is only in a code comment — it has never been written to a migration file.
2. The BudgetsView (`src/components/dashboard/views/BudgetsView.tsx`) hydrates from `getUserSetting` on mount, which is correct — but if the Supabase table doesn't exist yet, the app silently falls back to localStorage with no error. We need a clear schema file and a dev-mode warning.
3. The GoalsView (`src/components/dashboard/views/GoalsView.tsx`) has the same pattern and the same risk.
4. The `SavingsGoal` type is defined locally inside `GoalsView.tsx` instead of in `src/types/index.ts`, which means it can't be reused.

## Tasks

### 1. Create `supabase/migrations/001_user_settings.sql`
Create this directory and file. The SQL must match exactly what `userSettings.ts` expects:

```sql
-- user_settings: generic per-user key/value store for Goals, Budgets, preferences, etc.
create table if not exists user_settings (
  user_id  uuid references auth.users(id) on delete cascade,
  key      text not null,
  value    jsonb,
  updated_at timestamptz default now(),
  primary key (user_id, key)
);

alter table user_settings enable row level security;

create policy "users manage own settings"
  on user_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

Also create `supabase/migrations/README.md` that explains: run these SQL files in the Supabase dashboard SQL editor in order when setting up a new project.

### 2. Move `SavingsGoal` type to `src/types/index.ts`
Add this interface to `src/types/index.ts` near the other interfaces:

```typescript
export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  icon: string;
  color: string;
  monthlyContribution: number;
  createdAt: string;
}
```

Then in `GoalsView.tsx`, remove the local `SavingsGoal` interface and import it from `@/types`.

### 3. Add a dev-mode diagnostic in `userSettings.ts`
In the `getUserSetting` function, after the Supabase query, if it returns a PostgREST error with code `42P01` (table does not exist), log a clear warning:

```
[userSettings] ⚠️  The "user_settings" table does not exist in Supabase. Run supabase/migrations/001_user_settings.sql in your project's SQL editor. Falling back to localStorage.
```

This warning should only appear in development (`import.meta.env.DEV`).

### 4. Add a `STORAGE_KEYS.SAVINGS_GOALS` guard in GoalsView
The GoalsView currently persists via `getUserSetting(STORAGE_KEYS.SAVINGS_GOALS, [])`. Verify `SAVINGS_GOALS` exists in `src/config/storage.ts` (it does: `'tsz_savings_goals'`). No change needed here — just confirm in your response.

### 5. Write a unit test for the userSettings service
Create `src/services/__tests__/userSettings.test.ts`. Test:
- `getUserSetting` returns `fallback` when both Supabase and localStorage have no data
- `setUserSetting` writes to localStorage even when Supabase is unavailable (mock `isCloudEnabled` to return false)
- `getUserSetting` returns localStorage value when Supabase is unavailable

Mock `./supabase` with `vi.mock`. Use Vitest.

## Deliverables
- `supabase/migrations/001_user_settings.sql`
- `supabase/migrations/README.md`
- Updated `src/types/index.ts` (add `SavingsGoal`)
- Updated `src/components/dashboard/views/GoalsView.tsx` (import from types)
- Updated `src/services/userSettings.ts` (dev diagnostic)
- New `src/services/__tests__/userSettings.test.ts`

Run `npx vitest run` at the end and confirm all tests pass.
```

---

## PROMPT 2 — Security: Move Gemini AI behind a Supabase Edge Function

```
You are working on TrackSpendZ v2, a personal finance web app (React 18 + TypeScript + Vite + Supabase).

## Problem

`src/services/gemini.ts` reads `const API_KEY = import.meta.env.VITE_GEMINI_API_KEY`. Because this is a VITE_ prefixed variable, it is embedded in the client JavaScript bundle at build time. Any user who opens DevTools → Sources can extract the key in 30 seconds. This means:
- Anyone can use the AI features for free against our API quota
- Malicious users can exhaust the quota, killing AI features for everyone

## Solution Architecture

Move all Gemini API calls to a Supabase Edge Function. The client calls the edge function; the edge function holds the secret key server-side. The client never sees the key.

When the app is not live yet (no SUPABASE_URL configured or running locally), fall back to calling Gemini directly so development still works.

## Tasks

### 1. Create the Supabase Edge Function

Create `supabase/functions/ai-proxy/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Authenticate the caller — must be a valid Supabase session
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    );
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse the request from the client
    const { action, payload } = await req.json() as { action: string; payload: any };

    // Route to the correct Gemini endpoint
    const model = 'gemini-2.0-flash';
    const endpoint = `${GEMINI_BASE}/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    // Build the Gemini request body from the payload
    const geminiBody = {
      contents: payload.contents,
      ...(payload.jsonMode ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
    };

    const geminiRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      console.error('[ai-proxy] Gemini error:', data);
      return new Response(JSON.stringify({ error: data.error?.message ?? 'Gemini API error' }), {
        status: geminiRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[ai-proxy] Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

Create `supabase/functions/ai-proxy/README.md` explaining:
- Deploy with: `supabase functions deploy ai-proxy`
- Set the secret: `supabase secrets set GEMINI_API_KEY=your_key_here`
- The `VITE_GEMINI_API_KEY` env var is only used as a dev fallback and should be removed from production `.env`

### 2. Create a new `src/services/aiProxy.ts` client

This service decides whether to call the edge function (production) or Gemini directly (dev fallback):

```typescript
import { getSupabase, isCloudEnabled } from './supabase';

const SUPABASE_FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-proxy`
  : null;

// Dev fallback — only used when there is no Supabase URL configured (local dev without Supabase)
const DEV_GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

export type GeminiContents = { role: 'user'; parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> }[];

export interface ProxyRequest {
  contents: GeminiContents;
  jsonMode?: boolean;
}

/**
 * Calls the AI proxy (Supabase Edge Function in prod, direct Gemini API in dev).
 * Returns the raw Gemini API response JSON, or throws on error.
 */
export const callAIProxy = async (payload: ProxyRequest): Promise<string> => {
  // Production path: call the edge function
  if (SUPABASE_FUNCTIONS_URL && isCloudEnabled()) {
    try {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
      };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      const res = await fetch(SUPABASE_FUNCTIONS_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'generate', payload }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? `AI proxy error ${res.status}`);
      }

      const data = await res.json();
      // Extract text from Gemini response shape
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    } catch (e) {
      console.warn('[aiProxy] Edge function call failed, no dev fallback in production:', e);
      throw e;
    }
  }

  // Dev fallback: call Gemini directly (only when no Supabase URL or DEV mode)
  if (!DEV_GEMINI_API_KEY) {
    throw new Error('AI unavailable: no VITE_GEMINI_API_KEY set and no Supabase Edge Function configured.');
  }

  const model = 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${DEV_GEMINI_API_KEY}`;
  const body: any = { contents: payload.contents };
  if (payload.jsonMode) body.generationConfig = { responseMimeType: 'application/json' };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini API error ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
};

export const isAIProxyAvailable = (): boolean => {
  return !!(SUPABASE_FUNCTIONS_URL || DEV_GEMINI_API_KEY);
};
```

### 3. Refactor `src/services/gemini.ts` to use `aiProxy.ts`

Rewrite `gemini.ts` to replace the `@google/generative-ai` SDK calls with `callAIProxy`. Key rules:
- Remove `import('@google/generative-ai')` — no more SDK import
- Remove `const API_KEY = import.meta.env.VITE_GEMINI_API_KEY` from the top
- `isAIAvailable()` should now call `isAIProxyAvailable()` from `aiProxy.ts`
- All functions that previously called `model.generateContent(prompt)` should instead build a `ProxyRequest` with `contents: [{ role: 'user', parts: [{ text: prompt }] }]` and call `callAIProxy(request)`
- For `extractTransactionsFromPDF` with `isRawText = false` (base64 PDF), build a multipart content: `contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: 'application/pdf', data: base64data } }] }]`
- Functions that need JSON mode should pass `jsonMode: true` in the payload
- Keep all the same function signatures and return types — only internals change
- All catch blocks should still return safe fallback values (empty string, '[]', null, etc.)

### 4. Update `.env.example`

Add a comment to `.env.example` next to `VITE_GEMINI_API_KEY`:

```
# VITE_GEMINI_API_KEY — DEV ONLY. This key is exposed in the client bundle.
# In production, remove this and use the Supabase Edge Function instead.
# See supabase/functions/ai-proxy/README.md for deployment instructions.
VITE_GEMINI_API_KEY=
```

### 5. Update `supabase/migrations/README.md`
Add a section about deploying the Edge Function.

## Deliverables
- `supabase/functions/ai-proxy/index.ts`
- `supabase/functions/ai-proxy/README.md`
- `src/services/aiProxy.ts` (new file)
- `src/services/gemini.ts` (refactored, no SDK import, calls aiProxy)
- Updated `.env.example`
- Updated `supabase/migrations/README.md`

Verify the build still compiles: run `npx tsc --noEmit` and `npx vite build` — there should be no TypeScript errors.
```

---

## PROMPT 3 — Retention: Monthly Financial Report Card email + upload reminder

```
You are working on TrackSpendZ v2, a personal finance web app (React 18 + TypeScript + Vite + Supabase).

## Problem

Users upload their bank statements once, see value, and then forget to come back next month. There is no reminder. The fix is:
1. A Supabase Edge Function that generates a "Monthly Financial Report Card" email
2. A pg_cron job that calls it on the 1st of every month
3. An in-app "Report Card" preview so users see what they'll receive

The report card email should contain:
- Savings rate for last month (income minus expenses / income, as a percentage)
- Top 3 spending categories with amounts
- Budget adherence score (how many budgets stayed under limit)
- FIRE progress delta (% change in FIRE number if we can compute it)
- A call-to-action: "Upload your [current month] statements to see your updated score"
- A footer unsubscribe link

## Tasks

### 1. Create the Edge Function `supabase/functions/monthly-report/index.ts`

This function:
1. Accepts a POST from pg_cron with `{ user_id: string }` OR can be triggered manually with a bearer token for testing
2. Fetches the user's profile from `user_profiles` to get their email and name
3. Fetches last month's transactions from `transactions` (filter by date BETWEEN first and last day of last month)
4. Computes the metrics: total income, total expenses, savings rate, top 3 categories by spend
5. Fetches budgets from `user_settings` where key = 'tsz_budgets'
6. Builds an HTML email (inline styles, no external CSS, mobile-friendly)
7. Sends via Supabase's built-in email (use `supabase.auth.admin.getUserById` to get email, then call `fetch` to your preferred email API — scaffold it for Resend.com with `RESEND_API_KEY` env var)
8. Logs to `app_logs` with event type `monthly_report_sent`

Structure the file with:
```typescript
// supabase/functions/monthly-report/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
```

The email HTML template should look professional with:
- Subject line: "Your [Month] Financial Report Card 📊"
- Greeting: "Hey [first name],"
- A grade/score section: show savings rate as a letter grade (A: >30%, B: 20-30%, C: 10-20%, D: 0-10%, F: negative)
- Top 3 categories table
- Budget adherence: "X of Y budgets on track"
- CTA button: big, styled, links to https://trackspendz.com/dashboard
- Unsubscribe footer

### 2. Create `supabase/functions/monthly-report/email-template.ts`
Extract the HTML email builder into a separate helper file. It should export:
```typescript
export const buildReportEmail = (data: {
  firstName: string;
  month: string; // e.g. "May 2026"
  savingsRate: number; // percentage
  totalIncome: number;
  totalExpenses: number;
  topCategories: Array<{ name: string; amount: number }>;
  budgetsOnTrack: number;
  totalBudgets: number;
  currency: string;
  dashboardUrl: string;
  unsubscribeUrl: string;
}): { subject: string; html: string } => { ... }
```

### 3. Create `supabase/functions/monthly-report/README.md`
Document:
- How to deploy: `supabase functions deploy monthly-report`
- Required secrets: `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- How to set up pg_cron (run this SQL in the Supabase dashboard):
```sql
-- Runs on the 1st of every month at 8am UTC
select cron.schedule(
  'monthly-report-card',
  '0 8 1 * *',
  $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/monthly-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := (
      select jsonb_agg(jsonb_build_object('user_id', id))
      from auth.users
      where raw_user_meta_data->>'email_notifications' != 'false'
    )
  )
  $$
);
```
- How to trigger manually for testing: `curl -X POST ...`

### 4. Add an upload reminder check in the app

In `src/contexts/DataContext.tsx`, after transactions load (in the `useEffect` that loads data on auth), add a check:

```typescript
// Show "upload reminder" toast if user has no transactions in the last 28 days
const checkUploadReminder = (transactions: Transaction[]) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 28);
  const recent = transactions.filter(t => new Date(t.date) >= cutoff);
  if (transactions.length > 0 && recent.length === 0) {
    // User has historical data but nothing recent — they've stopped uploading
    return true;
  }
  return false;
};
```

When this returns true, call `showToast` (from UIContext) with:
- type: 'info'
- message: "It's been a while! Upload last month's statements to keep your FIRE progress up to date."
- duration: 8000

This check should only run once per session (use a `useRef` flag).

### 5. Add a "Report Card Preview" button in the dashboard

In `src/components/dashboard/DashboardSidebar.tsx` (or wherever the sidebar settings/links are), add a small info box at the bottom of the sidebar that says:
"📊 Monthly report cards are sent on the 1st of each month."

Only show this for signed-in Pro/Enterprise users.

## Deliverables
- `supabase/functions/monthly-report/index.ts`
- `supabase/functions/monthly-report/email-template.ts`
- `supabase/functions/monthly-report/README.md`
- Updated `src/contexts/DataContext.tsx` (upload reminder check)
- Updated `src/components/dashboard/DashboardSidebar.tsx` (report card notice)

The app should still compile: run `npx tsc --noEmit` to confirm no TypeScript errors.
```

---

## PROMPT 4 — Indian Bank Statement Presets (HDFC, ICICI, SBI, Axis)

```
You are working on TrackSpendZ v2, a personal finance web app (React 18 + TypeScript + Vite + Supabase).

## Context

The biggest underserved market for this app is Indian users. Banks like HDFC, ICICI, SBI, and Axis export statements in consistent CSV/Excel formats. If we hard-code these mappings, those users get instant zero-configuration parsing — a significant competitive advantage.

The transformer pipeline is in `src/services/transformer.ts`. It already has a `getStoredMapping` function in `src/services/learningRules.ts` that checks localStorage for a cached column mapping by file header signature.

The goal is to hard-code these mappings as built-in presets that are tried BEFORE the AI column detection, so Indian bank users never need AI mapping at all.

## Indian Bank CSV/Excel Header Formats (Research-Based)

These are the exact column header patterns from real Indian bank exports:

**HDFC Bank Statement (CSV)**
- Date column: `"Date"` — format DD/MM/YY (DMY)
- Description: `"Narration"` 
- Amount: Split columns — Withdrawal: `"Withdrawal Amt."`, Deposit: `"Deposit Amt."`
- Balance: `"Closing Balance"`
- Signature headers: `["Date", "Narration", "Value Dt", "Debit Amount", "Credit Amount", "Chq/Ref No.", "Closing Balance"]`
  OR: `["Date", "Narration", "Value Dt", "Withdrawal Amt.", "Deposit Amt.", "Closing Balance"]`

**ICICI Bank Statement (CSV)**  
- Date column: `"Transaction Date"` — format DD/MM/YYYY (DMY)
- Description: `"Transaction Remarks"`
- Amount: Split — `"Withdrawal Amount (INR )"` and `"Deposit Amount (INR )"`
- Signature headers: `["S No.", "Transaction Date", "Value Date", "Transaction Remarks", "Withdrawal Amount (INR )", "Deposit Amount (INR )", "Balance (INR )"]`
  OR simpler: `["Date", "Mode", "Deposits", "Withdrawals", "Balance"]`

**SBI (State Bank of India) Statement (CSV/Excel)**
- Date column: `"Txn Date"` — format DD/MM/YYYY (DMY)
- Description: `"Description"`
- Amount: Split — `"Debit"` and `"Credit"`
- Signature: `["Txn Date", "Value Date", "Description", "Ref No./Cheque No.", "Debit", "Credit", "Balance"]`

**Axis Bank Statement (CSV)**
- Date column: `"Tran Date"` — format DD-MM-YYYY (DMY)
- Description: `"Particulars"`
- Amount: Split — `"Debit"` and `"Credit"`
- Signature: `["Tran Date", "CHQNO", "Particulars", "Debit", "Credit", "Balance"]`
  OR: `["Transaction Date", "Transaction Details", "Voucher No.", "Debit", "Credit", "Balance (INR)"]`

**Kotak Mahindra Bank (CSV)**
- Date column: `"Transaction Date"` — format DD-MM-YYYY (DMY)
- Description: `"Description"`
- Amount: Split — `"Debit Amount"` and `"Credit Amount"`
- Signature: `["Transaction Date", "Transaction ID", "Value Date", "Description", "Chq / Ref No.", "Debit Amount", "Credit Amount", "Balance"]`

## Tasks

### 1. Create `src/services/indianBankPresets.ts`

Create a new file with all the bank preset mappings. Export:

```typescript
import type { FileMapping } from '@/types';

interface BankPreset {
  bankName: string;
  country: 'IN';
  // One or more header signatures this preset matches
  signatures: string[][];
  mapping: FileMapping;
}

export const INDIAN_BANK_PRESETS: BankPreset[] = [
  // HDFC Bank (Withdrawal/Deposit format)
  { ... },
  // HDFC Bank (Debit/Credit format)  
  { ... },
  // ICICI Bank
  { ... },
  // SBI
  { ... },
  // Axis Bank (v1)
  { ... },
  // Axis Bank (v2)
  { ... },
  // Kotak
  { ... },
];

/**
 * Tries to match file headers against all Indian bank presets.
 * Matching is case-insensitive and tolerates minor whitespace differences.
 * Returns the matching preset's FileMapping, or null if no match.
 */
export const detectIndianBankPreset = (headers: string[]): FileMapping | null => {
  const normalised = headers.map(h => h.trim().toLowerCase());
  
  for (const preset of INDIAN_BANK_PRESETS) {
    for (const sig of preset.signatures) {
      const normSig = sig.map(s => s.trim().toLowerCase());
      // Require that all signature headers are present in the file headers
      const allMatch = normSig.every(s => normalised.some(h => h === s));
      if (allMatch) {
        console.info(`[indianBankPresets] Matched: ${preset.bankName}`);
        return preset.mapping;
      }
    }
  }
  return null;
};
```

Fill in all 7 presets using the format data above. Each `FileMapping` should use:
- `isCreditDebitSeparate: true` for split debit/credit columns
- `creditColumn` for the deposit/credit column header
- `debitColumn` for the withdrawal/debit column header
- `dateFormat: 'DMY'` for all Indian banks
- `dateColumn` set to the exact header string

### 2. Integrate into the transformer pipeline

In `src/services/transformer.ts`, find the section where `getStoredMapping(headers)` is called (around line 300-400). After checking the stored mapping, add a check for Indian bank presets BEFORE falling back to AI:

```typescript
// 1. Check stored mapping (user's previous uploads)
let mapping = getStoredMapping(headers);

// 2. Try Indian bank presets (fast, no AI needed)
if (!mapping) {
  const { detectIndianBankPreset } = await import('./indianBankPresets');
  mapping = detectIndianBankPreset(headers);
  if (mapping) {
    // Save it so future uploads of the same bank also get instant mapping
    saveMapping(headers, mapping);
  }
}

// 3. Fall back to AI (existing logic)
if (!mapping) {
  // ... existing AI detection code ...
}
```

### 3. Add Indian bank category patterns to the categorizer

In `src/services/categorizer.ts`, find the keyword mapping object (the one that maps merchant keywords to categories). Add Indian-specific patterns:

```typescript
// Indian-specific patterns
'zomato': 'Food',
'swiggy': 'Food',
'blinkit': 'Groceries',
'bigbasket': 'Groceries',
'zepto': 'Groceries',
'instamart': 'Groceries',
'nykaa': 'Shopping',
'myntra': 'Shopping',
'flipkart': 'Shopping',
'amazon in': 'Shopping',
'meesho': 'Shopping',
'ola ': 'Transport',
'uber ': 'Transport',
'rapido': 'Transport',
'irctc': 'Transport',
'makemytrip': 'Travel',
'goibibo': 'Travel',
'cleartrip': 'Travel',
'bookmyshow': 'Entertainment',
'pvr': 'Entertainment',
'inox': 'Entertainment',
'lenskart': 'Healthcare',
'pharmeasy': 'Healthcare',
'1mg': 'Healthcare',
'netmeds': 'Healthcare',
'byju': 'Education',
'unacademy': 'Education',
'paytm': 'Finance',
'phonepe': 'Finance',
'gpay': 'Finance',
'google pay': 'Finance',
'upi': 'Finance',
'neft': 'Finance',
'imps': 'Finance',
'rtgs': 'Finance',
'hdfc': 'Finance',
'icici': 'Finance',
'sbi': 'Finance',
'axis bank': 'Finance',
'kotak': 'Finance',
'jio': 'Utilities',
'airtel': 'Utilities',
'bsnl': 'Utilities',
'vi mobile': 'Utilities',
'tata power': 'Utilities',
'bescom': 'Utilities',
'adani electricity': 'Utilities',
```

### 4. Add a "Detected bank" banner in the upload UI

In `src/contexts/DataContext.tsx` (the `processFiles` function), when `detectIndianBankPreset` returns a non-null result, set a toast message:
"✅ HDFC Bank statement detected — no configuration needed!"

The bank name should come from the preset object.

### 5. Write tests for the Indian bank preset detection

Create `src/services/__tests__/indianBankPresets.test.ts`:
- Test that HDFC Bank headers return the correct mapping
- Test that ICICI Bank headers return the correct mapping
- Test that headers with different casing/whitespace still match
- Test that completely unknown headers return null

Run `npx vitest run` and confirm all tests pass.

## Deliverables
- `src/services/indianBankPresets.ts` (new file with all 7 presets)
- Updated `src/services/transformer.ts` (integrate preset detection)
- Updated `src/services/categorizer.ts` (Indian merchant keywords)
- Updated `src/contexts/DataContext.tsx` (bank detected toast)
- `src/services/__tests__/indianBankPresets.test.ts`

Run `npx tsc --noEmit` and `npx vitest run` to confirm no errors.
```

---

## PROMPT 5 — New Feature: Debt Payoff Planner (Snowball vs Avalanche)

```
You are working on TrackSpendZ v2, a personal finance web app (React 18 + TypeScript + Vite + Supabase).

## Feature Description

Add a "Debt Payoff" tab to the dashboard. This is an emotionally compelling feature: user enters their debts (credit card, personal loan, car loan, etc.), chooses a payoff method (Snowball or Avalanche), and the app calculates:
1. Total interest paid under each method
2. Months to debt-free date
3. A month-by-month payoff schedule
4. A personalised insight: "You spent $340 on restaurants last month. Redirect $200 of that to your credit card and you'll be debt-free 8 months sooner."

## Implementation Details

### Data Model

```typescript
// Add to src/types/index.ts
export interface Debt {
  id: string;
  name: string;           // e.g. "HDFC Credit Card"
  balance: number;        // current outstanding balance
  interestRate: number;   // annual interest rate (e.g. 18 for 18%)
  minimumPayment: number; // minimum monthly payment
  type: 'credit_card' | 'personal_loan' | 'car_loan' | 'home_loan' | 'student_loan' | 'other';
  createdAt: string;
}

export type DebtPayoffMethod = 'snowball' | 'avalanche';

export interface DebtPayoffResult {
  method: DebtPayoffMethod;
  totalMonths: number;
  totalInterestPaid: number;
  debtFreeDate: string; // ISO date
  schedule: DebtPayoffMonth[];
}

export interface DebtPayoffMonth {
  month: number;
  monthLabel: string; // e.g. "Jun 2026"
  remainingDebts: Array<{ id: string; name: string; balance: number; payment: number }>;
  totalPaid: number;
  interestPaid: number;
}
```

### Algorithm (create `src/services/debtPayoff.ts`)

Create a pure service with:

```typescript
export const calculateDebtPayoff = (
  debts: Debt[],
  extraMonthlyPayment: number,
  method: DebtPayoffMethod
): DebtPayoffResult => { ... }
```

Snowball: order debts by balance ascending (smallest first, gets extra payment first). Avalanche: order by interest rate descending (highest rate first, gets extra payment first). For each month, accrue interest, apply minimum payments, apply extra to the top-priority debt. When a debt is paid off, redirect its minimum payment to the next debt. Cap simulation at 360 months (30 years) to prevent infinite loops.

### Component (`src/components/dashboard/views/DebtPayoffView.tsx`)

UI structure:
1. **If no debts yet:** Empty state with "Add your first debt" button + a callout box connecting spending data: "Based on your last month, you spent [X] on [top category]. You could redirect [amount] here."
2. **Debt list panel:** Each debt card shows name, balance, rate, minimum payment, with edit/delete buttons. "Add Debt" button below.
3. **Controls:** Extra monthly payment input, method toggle (Snowball vs Avalanche), with a tooltip explaining each method.
4. **Results panel (shown once debts exist):**
   - Big stat: "Debt-free by [month/year]" with months count
   - Total interest you'll pay: "[amount]"
   - Comparison row: show BOTH methods side-by-side so users can see the difference
   - Progress timeline: a horizontal bar for each debt showing when it gets paid off (use Recharts BarChart with stacked bars, one per debt, X axis = months)
5. **Spending insight box:** Pull last month's top 3 spending categories from `transactions`. Show: "Redirect $X/month here (reduce [Category] spending) → save [N] months and [amount] interest."

### Add to Dashboard

1. Add `'Debt Payoff'` to `DASHBOARD_TABS` in `src/types/index.ts`
2. Create the component at `src/components/dashboard/views/DebtPayoffView.tsx`
3. Add the `case 'Debt Payoff'` in `src/components/dashboard/DashboardShell.tsx`'s `renderView()` function
4. Add to `src/pages/HelpPage.tsx` dashboard section

### Persistence

Use `getUserSetting` / `setUserSetting` with key `'tsz_debts'`. Add `DEBTS: 'tsz_debts'` to `STORAGE_KEYS` in `src/config/storage.ts`.

### Plan Gating

Debt Payoff should be available to Pro and Enterprise users only. Add `'debt_payoff'` to the pro and enterprise feature lists in `src/config/plans.ts`. Gate with `canAccessFeature(plan, 'debt_payoff')` and show `<UpgradePrompt>` for free users.

## Deliverables
- Updated `src/types/index.ts` (Debt, DebtPayoffResult, DebtPayoffMonth types; 'Debt Payoff' in DASHBOARD_TABS)
- `src/services/debtPayoff.ts` (pure calculation logic)
- `src/components/dashboard/views/DebtPayoffView.tsx` (full UI)
- Updated `src/components/dashboard/DashboardShell.tsx` (case + lazy import)
- Updated `src/config/storage.ts` (DEBTS key)
- Updated `src/config/plans.ts` (debt_payoff feature flag)
- Updated `src/pages/HelpPage.tsx` (debt payoff card)

Run `npx tsc --noEmit` to verify no TypeScript errors. The debt payoff tab should be visible in the dashboard sidebar.
```

---

## PROMPT 6 — Tax Export Feature

```
You are working on TrackSpendZ v2, a personal finance web app (React 18 + TypeScript + Vite + Supabase).

## Feature Description

Add a "Tax Export" feature available to Enterprise plan users. This lets users:
1. Select a tax year (financial year)
2. Choose which transactions are "business expenses" (either by category or individual selection)
3. Download a formatted CSV/PDF suitable for handing to an accountant or importing into tax software
4. See a summary: total business expenses, total income, gross profit estimate

This is a real reason to pay once a year at tax time — which maps perfectly to the annual subscription model.

## Implementation Details

### Tax Summary Modal / Page

Create `src/components/dashboard/views/TaxExportView.tsx`.

UI sections:
1. **Year selector:** Dropdown for financial year — show last 3 years + current (e.g. "FY 2025-26", "FY 2024-25"). For Indian users FY is April-March; for US/UK it's Jan-Dec or Apr-Mar. Allow user to choose their financial year start month (default: January for US, April for India).

2. **Category classification panel:**
   - Show all unique categories from filtered transactions
   - Each category has a toggle: "Personal" / "Business" / "Mixed" (default: Personal)
   - "Business" = fully deductible, "Mixed" = user enters a percentage
   - Show running totals as user classifies

3. **Summary stats panel:**
   - Total income (from Income transactions)
   - Total expenses (all)
   - Business expenses (classified as Business or Mixed × percentage)
   - Estimated taxable income (income − business expenses)
   - Number of transactions

4. **Export buttons:**
   - "Download CSV for Accountant" — structured CSV with classification column
   - "Download Summary PDF" — one-page summary suitable for attaching to a tax return

### CSV Export Format

Extend `src/services/exportService.ts` with a new function:

```typescript
export const exportTaxCSV = (
  transactions: Transaction[],
  classifications: Record<string, { type: 'personal' | 'business' | 'mixed'; percentage: number }>,
  taxYear: string
): void => {
  const headers = [
    'Date', 'Description', 'Category', 'Amount', 'Type',
    'Tax Classification', 'Business %', 'Deductible Amount', 'Notes'
  ];
  
  const rows = transactions
    .filter(t => t.type === 'Expense' || t.type === 'Income')
    .map(t => {
      const classification = classifications[t.category] ?? { type: 'personal', percentage: 0 };
      const deductible = classification.type === 'business' 
        ? t.amount 
        : classification.type === 'mixed' 
          ? t.amount * (classification.percentage / 100) 
          : 0;
      return [
        t.date,
        t.notes || t.original_description || '',
        t.category,
        t.amount.toString(),
        t.type,
        classification.type.toUpperCase(),
        classification.type === 'mixed' ? `${classification.percentage}%` : '',
        deductible > 0 ? deductible.toFixed(2) : '',
        t.notes || '',
      ];
    });
  
  // ... download CSV
};
```

### Tax Summary PDF

Use the existing export infrastructure — write the summary as HTML and trigger `window.print()` in a print-optimised iframe, OR write it as a simple text/CSV summary. Keep it simple — no external PDF library needed.

Create `exportTaxSummaryText` in `exportService.ts`:

```typescript
export const exportTaxSummaryText = (summary: {
  taxYear: string;
  totalIncome: number;
  totalExpenses: number;
  businessExpenses: number;
  estimatedTaxableIncome: number;
  transactionCount: number;
  currency: string;
  topCategories: Array<{ name: string; amount: number; type: string }>;
}): void => {
  // Build a formatted plain-text summary and download as .txt
  // Include a disclaimer: "This is for reference only. Consult a qualified tax professional."
};
```

### Add to Dashboard

1. Add `'Tax Export'` to `DASHBOARD_TABS` in `src/types/index.ts`
2. Add it to the component in `DashboardShell.tsx`
3. Gate it with `canAccessFeature(plan, 'tax_reports')` — this feature is already in the enterprise plan list in `plans.ts`. Also add it to the Pro plan list (since feedback says it could be a reason for anyone to pay)
4. Add to `HelpPage.tsx`

### Persistence of classifications

Store the user's category classifications in `getUserSetting` / `setUserSetting` with key `'tsz_tax_classifications'`. Add `TAX_CLASSIFICATIONS: 'tsz_tax_classifications'` to `STORAGE_KEYS`.

## Deliverables
- `src/components/dashboard/views/TaxExportView.tsx`
- Updated `src/services/exportService.ts` (two new export functions)
- Updated `src/types/index.ts` (DASHBOARD_TABS)
- Updated `src/components/dashboard/DashboardShell.tsx`
- Updated `src/config/plans.ts` (tax_reports for Pro)
- Updated `src/config/storage.ts` (TAX_CLASSIFICATIONS key)
- Updated `src/pages/HelpPage.tsx`

Run `npx tsc --noEmit`. No TypeScript errors.
```

---

## PROMPT 7 — Strengthen Family Dashboard

```
You are working on TrackSpendZ v2, a personal finance web app (React 18 + TypeScript + Vite + Supabase).

## Context

The Enterprise plan charges $149/year and lists "Family Accounts (5 members)" as the headline feature. Currently `src/pages/FamilyDashboard.tsx` is minimal. This needs to be built out enough to justify the pricing.

Read the existing `src/pages/FamilyDashboard.tsx` before making changes.

## Feature Requirements

A family dashboard where an Enterprise user ("owner") can:
1. Invite up to 5 family members by email
2. Each member uploads their own statements (their transactions are tagged with their name/owner field)
3. The family dashboard shows consolidated + per-member views

### Current Limitations to Fix
- No real member management UI
- No family-wide spending view
- Transactions already have an `owner` field in the `Transaction` type — it just isn't being populated for family members

## Implementation Plan

### 1. Family Member Management Panel

Replace the existing minimal UI with a proper panel:

```
[Family Dashboard — Enterprise]

Members (3/5)
┌─────────────────────────────────┐
│ 👤 You (Owner)     [active]     │
│ 👤 Priya Sharma    [active]     │  
│ 👤 Arjun Sharma    [pending]    │
│ + Add Member (email invite)     │
└─────────────────────────────────┘
```

Member states: `owner`, `active`, `pending`, `removed`.

Store members in `getUserSetting` with key `tsz_family_members`. Member shape:
```typescript
interface FamilyMember {
  id: string;
  name: string;
  email: string;
  status: 'owner' | 'active' | 'pending' | 'removed';
  addedAt: string;
  color: string; // for charts — assign from a palette
}
```

Add `FAMILY_MEMBERS: 'tsz_family_members'` to `STORAGE_KEYS` (already present — use it).

For v1 (pre-launch), member management is local-only (no actual email invites yet). Add a "Coming soon: email invites" notice. Members are added by name for now — this allows the owner to manually upload statements for each family member and tag them.

### 2. File Upload Per Member

When a family member exists, the file upload flow should let the user select WHICH member's statement they're uploading. Add a "Uploading for:" selector in the upload area (only shown for Enterprise users with >1 member).

In `src/contexts/DataContext.tsx`, the `processFiles` function already supports an `owner` field on transactions. Add an optional `ownerOverride?: string` param to `processFiles`. When provided, set `owner` on all parsed transactions.

Add to `src/components/dashboard/DashboardShell.tsx` (or wherever the upload dropzone is) a member selector that appears for Enterprise users:

```tsx
{plan === 'enterprise' && familyMembers.length > 1 && (
  <select 
    value={selectedMember}
    onChange={e => setSelectedMember(e.target.value)}
    className="input-field text-sm"
  >
    {familyMembers.filter(m => m.status !== 'removed').map(m => (
      <option key={m.id} value={m.name}>{m.name}</option>
    ))}
  </select>
)}
```

### 3. Consolidated Family View

In `FamilyDashboard.tsx`, add these sections:

**Section A — Household Summary (top stats cards)**
- Combined monthly income
- Combined monthly expenses  
- Combined savings rate
- Net household savings this month

Filter transactions by `owner` using the family members list.

**Section B — Per-Member Spending Breakdown**
A stacked bar chart (Recharts `BarChart` with stacked `Bar`s) showing monthly spending per family member. Each member gets their color from the `FamilyMember.color` field. X-axis = last 6 months. This gives an instant visual of "who's spending what."

**Section C — Category Comparison Table**
For each top-10 spending category, show a row with each member's spending side-by-side:
```
Category        | You      | Priya    | Arjun    | Total
Food & Dining   | ₹8,400   | ₹5,200   | ₹3,100   | ₹16,700
Transport       | ₹4,200   | ₹2,100   | ₹800     | ₹7,100
```

Use the existing `transactions` array from `DataContext` — filter by `t.owner === member.name`.

**Section D — Member Selector Tabs**
Below the family-wide view, add a tab row: "All Members | You | Priya | Arjun" — clicking a member's tab shows their individual Summary view (reuse SummaryView component, filtered to their transactions).

### 4. Clean Up and Polish

- Remove any placeholder/skeleton content that says "coming soon" unless it's the email invite feature (which is genuinely planned)
- Add proper empty states: if no members added yet, show "Add your first family member to start tracking household finances"
- Make sure all transactions in DataView can be filtered by owner via the existing DataView search (the `owner` field is already searchable)

## Deliverables
- Updated `src/pages/FamilyDashboard.tsx` (full rebuild)
- Updated `src/contexts/DataContext.tsx` (ownerOverride in processFiles)
- Updated upload area component (member selector for Enterprise)
- Updated `src/types/index.ts` (FamilyMember type if not already there)

Run `npx tsc --noEmit` to verify no TypeScript errors.
```

---

## ORDER OF EXECUTION

Run prompts in this order:

| # | Prompt | Why This Order |
|---|--------|---------------|
| 1 | Persistence Infrastructure | Foundation — sets up `user_settings` schema and fixes type exports |
| 2 | Gemini Edge Function | Security fix — prevents quota abuse before launch |
| 3 | Monthly Report Card Email | Retention — needs Supabase functions infra from prompt 2 |
| 4 | Indian Bank Presets | Growth — self-contained, no dependencies |
| 5 | Debt Payoff Planner | New feature — depends on types/index.ts being stable (from prompt 1) |
| 6 | Tax Export | New feature — depends on exportService.ts patterns |
| 7 | Family Dashboard | Biggest rebuild — do last |

Run `npx vitest run` and `npx tsc --noEmit` after each prompt to catch any regressions before moving to the next.
