# PROMPT 4 (REVISED) — Global Format Library: Crowdsourced Bank Format Detection

```
You are working on TrackSpendZ v2, a personal finance web app (React 18 + TypeScript + Vite + Supabase).

## The Problem with the Current Approach

The transformer already generates a `getFileSignature(headers)` fingerprint and stores column mappings
per-user in localStorage. But this knowledge is siloed — every user re-discovers the same bank format
independently. The first HDFC Bank user invokes the AI to figure out the column mapping. So does the
second. And the hundredth.

The fix is a shared, community-maintained format library in Supabase:
- First user with an unknown format → AI detects it → mapping saved to shared table
- Every subsequent user with the same format → instant match, no AI call, no waiting
- Covers ALL banks globally — savings accounts, credit cards, investment accounts — whatever anyone uploads
- Gets more accurate over time as users confirm/correct mappings

This is the only scalable approach. We do NOT hard-code specific banks.

## Architecture Overview

### Detection cascade (updated order):
1. Check user's own localStorage cache (fastest, unchanged)
2. Check shared `format_presets` Supabase table (community knowledge, new)
3. Heuristic rule-based detection (existing, unchanged)
4. AI via Edge Function (existing, unchanged — now the last resort)
5. On AI success: save to shared table as `status='pending'` (new)
6. After user confirms import looks correct: promote to `status='verified'` (new)

### What "format" means here:
A format is just: header signature → FileMapping. It doesn't matter if it's HDFC, Chase,
Revolut, or someone's personal expense tracker. If the columns match, the mapping applies.
The system is bank-agnostic.

---

## Task 1 — Create `supabase/migrations/002_format_presets.sql`

```sql
-- format_presets: shared community library of file column mappings.
-- Keyed by header_signature (sorted, lowercase, pipe-delimited headers).
-- A signature uniquely identifies a file's column structure regardless of bank name.
create table if not exists format_presets (
  id             uuid default gen_random_uuid() primary key,
  header_sig     text not null unique,         -- getFileSignature() output
  sample_headers text[] not null,              -- actual headers (for human readability)
  mapping        jsonb not null,               -- FileMapping object
  status         text not null default 'pending'  -- 'pending' | 'verified' | 'rejected'
                   check (status in ('pending', 'verified', 'rejected')),
  successful_imports int not null default 0,   -- incremented on each confirmed success
  failed_imports     int not null default 0,   -- incremented on each confirmed failure
  created_by     uuid references auth.users(id) on delete set null,
  promoted_by    uuid references auth.users(id) on delete set null,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- Anyone can read verified presets (for import detection).
-- Authenticated users can insert new pending presets (contributing their format).
-- Only admins can update status (via service role in Edge Functions / admin panel).
alter table format_presets enable row level security;

create policy "public read verified presets"
  on format_presets for select
  using (status = 'verified');

create policy "authenticated users submit presets"
  on format_presets for insert
  to authenticated
  with check (status = 'pending');

-- Index for fast signature lookup
create index if not exists idx_format_presets_sig on format_presets(header_sig);
```

Also add `FORMAT_PRESETS: 'format_presets'` to the `TABLES` object in `src/config/database.ts`.

---

## Task 2 — Create `src/services/formatLibrary.ts`

This service wraps all interactions with the shared format library.

```typescript
import { getSupabase, isCloudEnabled } from './supabase';
import { TABLES } from '@/config/database';
import type { FileMapping } from '@/types';
import { getFileSignature } from './learningRules';

// In-session cache to avoid repeated network calls for the same signature
const sessionCache = new Map<string, FileMapping | null>();

/**
 * Looks up a header signature in the shared format library.
 * Returns the mapping if a verified preset exists, null otherwise.
 * Uses an in-session cache so the same bank file never hits the network twice.
 */
export const getSharedMapping = async (headers: string[]): Promise<FileMapping | null> => {
  if (!isCloudEnabled()) return null;

  const sig = getFileSignature(headers);
  if (!sig) return null;

  // In-session cache hit
  if (sessionCache.has(sig)) return sessionCache.get(sig) ?? null;

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from(TABLES.FORMAT_PRESETS)
      .select('mapping')
      .eq('header_sig', sig)
      .eq('status', 'verified')
      .maybeSingle();

    if (error) {
      console.warn('[formatLibrary] lookup failed:', error.message);
      sessionCache.set(sig, null);
      return null;
    }

    const mapping = data?.mapping as FileMapping ?? null;
    sessionCache.set(sig, mapping);
    if (mapping) console.info('[formatLibrary] ✅ Community preset matched for signature:', sig.substring(0, 60) + '...');
    return mapping;
  } catch (e) {
    console.warn('[formatLibrary] lookup error:', e);
    return null;
  }
};

/**
 * Submits a new format mapping to the shared library as 'pending'.
 * Called after AI successfully detects a format for the first time.
 * Silent — never throws, never blocks the import flow.
 */
export const submitFormatPreset = async (
  headers: string[],
  mapping: FileMapping
): Promise<void> => {
  if (!isCloudEnabled()) return;

  const sig = getFileSignature(headers);
  if (!sig) return;

  try {
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();

    await supabase.from(TABLES.FORMAT_PRESETS).upsert({
      header_sig: sig,
      sample_headers: headers,
      mapping,
      status: 'pending',
      created_by: session?.user?.id ?? null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'header_sig',
      ignoreDuplicates: true, // Don't overwrite verified presets with a new pending one
    });

    // Update session cache optimistically
    sessionCache.set(sig, mapping);
    console.info('[formatLibrary] Submitted new format preset for community review');
  } catch (e) {
    console.warn('[formatLibrary] Failed to submit preset:', e);
  }
};

/**
 * Increments successful_imports for a preset (called on confirmed import success).
 * When a pending preset reaches 3+ successes, it auto-promotes to 'verified'.
 * This is the community quality signal — popularity = correctness.
 */
export const confirmFormatSuccess = async (headers: string[]): Promise<void> => {
  if (!isCloudEnabled()) return;

  const sig = getFileSignature(headers);
  if (!sig) return;

  try {
    const supabase = getSupabase();
    // Use an RPC for atomic increment + auto-promote logic
    await supabase.rpc('increment_format_success', { p_sig: sig });
  } catch (e) {
    // Silent — not critical
    console.warn('[formatLibrary] Failed to confirm format success:', e);
  }
};

/**
 * Marks a format as failed (called when user reports incorrect import).
 * The admin can review and either fix the mapping or reject it.
 */
export const reportFormatFailure = async (headers: string[], correctedMapping?: FileMapping): Promise<void> => {
  if (!isCloudEnabled()) return;

  const sig = getFileSignature(headers);
  if (!sig) return;

  try {
    const supabase = getSupabase();
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };
    if (correctedMapping) {
      // User provided a corrected mapping — save it and reset to pending for re-review
      updateData.mapping = correctedMapping;
      updateData.status = 'pending';
    }
    await supabase
      .from(TABLES.FORMAT_PRESETS)
      .update(updateData)
      .eq('header_sig', sig);

    // Also call the RPC to increment failed_imports
    await supabase.rpc('increment_format_failure', { p_sig: sig });

    // Invalidate session cache
    sessionCache.delete(sig);
  } catch (e) {
    console.warn('[formatLibrary] Failed to report format failure:', e);
  }
};
```

---

## Task 3 — Add SQL helper functions to the migration file

Add to `supabase/migrations/002_format_presets.sql`:

```sql
-- Auto-promote pending presets that reach 3 confirmed successes
create or replace function increment_format_success(p_sig text)
returns void language plpgsql security definer as $$
begin
  update format_presets
  set
    successful_imports = successful_imports + 1,
    updated_at = now(),
    status = case
      when status = 'pending' and (successful_imports + 1) >= 3 then 'verified'
      else status
    end
  where header_sig = p_sig;
end;
$$;

create or replace function increment_format_failure(p_sig text)
returns void language plpgsql security definer as $$
begin
  update format_presets
  set
    failed_imports = failed_imports + 1,
    updated_at = now()
  where header_sig = p_sig;
end;
$$;
```

---

## Task 4 — Integrate `formatLibrary` into the transformer cascade

In `src/services/transformer.ts`, find the section where `getStoredMapping` is called
and `getRuleBasedMapping` / AI are tried. Update the cascade as follows:

The current order is approximately:
1. `getStoredMapping` (localStorage)
2. `getRuleBasedMapping` (heuristics)
3. AI via `getFileMappingFromAI` / `detectFileStructure`

Update to:
1. `getStoredMapping` (localStorage — unchanged)
2. `getSharedMapping` from `formatLibrary` (community library — NEW, async)
3. `getRuleBasedMapping` (heuristics — unchanged)
4. AI (unchanged)
5. On AI success: call `submitFormatPreset(headers, mapping)` in the background — NEW

The `getSharedMapping` call is async, so the surrounding function that calls it must be async (it likely already is). Use `await` but wrap in try/catch so it never blocks the import.

When `getSharedMapping` returns a non-null mapping, skip steps 3 and 4 (no need for heuristics or AI).

Example structure:
```typescript
// 1. User's own cached mapping
let mapping = getStoredMapping(headers);

// 2. Community format library (async, try/catch so it never blocks)
if (!mapping) {
  try {
    const { getSharedMapping } = await import('./formatLibrary');
    mapping = await getSharedMapping(headers);
    if (mapping) {
      // Cache locally so future same-format uploads skip the network call
      saveMapping(headers, mapping);
    }
  } catch { /* silent */ }
}

// 3. Rule-based heuristics
if (!mapping) {
  mapping = validateAndCorrectMapping(getRuleBasedMapping(headers, sampleRows), headers, sampleRows);
}

// 4. AI fallback
if (!mapping) {
  const aiMapping = await getFileMappingFromAI(headers, sampleRows);
  if (aiMapping) {
    mapping = validateAndCorrectMapping(aiMapping, headers, sampleRows);
    if (mapping) {
      saveMapping(headers, mapping); // Cache locally
      // Submit to community library in the background (don't await)
      import('./formatLibrary').then(({ submitFormatPreset }) => {
        submitFormatPreset(headers, mapping!);
      }).catch(() => {});
    }
  }
}
```

---

## Task 5 — Post-import confirmation UI

After a file is successfully imported and transactions are displayed, show a small
confirmation prompt. This is the feedback loop that drives the quality of the library.

In `src/contexts/DataContext.tsx`, after `processFiles` successfully adds transactions,
expose a new piece of state: `lastImportHeaders: string[] | null`.

Set it when a file is imported. Clear it after the user responds to the confirmation prompt.

In `src/components/dashboard/DashboardShell.tsx` (or the upload area component),
when `lastImportHeaders` is non-null and at least 5 transactions were added, show a
dismissible toast/banner:

```
✅ Import looks good? 
[👍 Yes, all transactions look correct]  [⚠️ No, something looks off]
```

When the user clicks "Yes":
- Call `confirmFormatSuccess(lastImportHeaders)` from `formatLibrary`
- Clear `lastImportHeaders`
- Show: "Thanks! You've helped other users with the same bank format."

When the user clicks "No, something looks off":
- Call `reportFormatFailure(lastImportHeaders)` from `formatLibrary`
- Clear `lastImportHeaders`
- Show the existing column mapping correction UI (if one exists) OR show a simple:
  "We've flagged this for review. You can re-upload after correcting the column mapping."

This confirmation prompt should only show ONCE per import session (use a ref),
and should NOT show for PDF imports (PDFs don't use the column-mapping system).

---

## Task 6 — Admin panel: Format Presets tab

In `src/pages/AdminPage.tsx`, add a new tab: "Format Presets".

This tab shows the `format_presets` table with columns:
- Sample headers (first 4, truncated)
- Status badge (pending/verified/rejected)
- Successful imports count
- Failed imports count
- Created at
- Actions: "Verify" (set status='verified') | "Reject" (set status='rejected')

Use the Supabase service role (admin context already exists in AdminPage) to query
without the RLS restriction that limits regular users to only verified presets.

This gives you a human quality-control layer: AI-detected formats that get submitted
as 'pending' can be reviewed before being served to all users.

---

## Task 7 — Update `src/config/database.ts`

Add to the `TABLES` object:
```typescript
FORMAT_PRESETS: 'format_presets',
```

Add to the `RPC` object:
```typescript
INCREMENT_FORMAT_SUCCESS: 'increment_format_success',
INCREMENT_FORMAT_FAILURE: 'increment_format_failure',
```

---

## What this DOESN'T need

- Hard-coded bank names or formats
- Any logic that identifies "this is an HDFC file"
- Any country-specific code
- Any maintenance by the dev team

The system learns all formats automatically from user uploads. A saving account CSV,
a credit card CSV, an investment statement, a budgeting app export — all handled
identically. The header signature is the identity; the mapping is the knowledge.

---

## Deliverables
- `supabase/migrations/002_format_presets.sql` (table + RPC functions)
- `src/services/formatLibrary.ts` (new service)
- Updated `src/services/transformer.ts` (new step 2 in cascade + submit on AI success)
- Updated `src/contexts/DataContext.tsx` (lastImportHeaders state)
- Updated `src/components/dashboard/DashboardShell.tsx` (confirmation prompt)
- Updated `src/pages/AdminPage.tsx` (Format Presets tab)
- Updated `src/config/database.ts` (TABLES.FORMAT_PRESETS, RPC entries)

Run `npx tsc --noEmit` to confirm no TypeScript errors.
The import flow should work identically for end users — the new steps are silent additions
to the existing cascade, not replacements.
```
