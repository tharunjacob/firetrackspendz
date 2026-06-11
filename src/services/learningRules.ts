import type { FileMapping, LearningRule } from '@/types';
import { supabase } from './supabase';
import { logEvent } from './logger';
import { TABLES } from '@/config/database';

// ============================================================
// Learning Rules Engine - Gets smarter over time
// ============================================================

const MAPPING_STORAGE_KEY = 'trackspendz_mappings_v2';
let ruleCache: LearningRule[] = [];
// The signed-in user's id, captured during initializeRules(). Used so applyRules
// can prefer a user's OWN rule over a shared system rule of equal specificity.
let currentUserId: string | null = null;

/**
 * Normalizes a raw bank description into a privacy-safe, generalizable keyword.
 *
 * WHY: rule keywords are shared across users once promoted to 'system' (see the
 * consensus mechanism in schema.sql). A raw description like
 * "UPI/9876543210@okhdfc/REF8462713" carries PII (account/UPI/ref numbers) AND
 * never matches a future transaction because the ref number changes every time.
 * Stripping long digit runs removes the PII and makes the keyword actually reusable.
 *
 * Conservative on purpose: lowercase, trim, drop runs of 4+ digits (card/account/
 * txn refs), and collapse whitespace. Separators and merchant words are preserved
 * so substring matching in applyRules still works.
 */
export const normalizeKeyword = (raw: string): string => {
  return (raw || '')
    .toLowerCase()
    .replace(/\d{4,}/g, ' ')   // strip account / card / txn-ref numbers (PII)
    .replace(/\s+/g, ' ')
    .trim();
};

// --- File Column Mappings ---

/** Returns a stable signature from file headers so column mappings can be cached and reused. */
export const getFileSignature = (headers: string[]): string => {
  if (!headers?.length) return '';
  return headers.map(h => String(h).trim().toLowerCase()).sort().join('|');
};

/** Returns the previously-saved column mapping for a file with these headers, or null. */
export const getStoredMapping = (headers: string[]): FileMapping | null => {
  try {
    const sig = getFileSignature(headers);
    if (!sig) return null;
    if (typeof window === 'undefined' || !window.localStorage || typeof window.localStorage.getItem !== 'function') {
      return null;
    }
    const stored = window.localStorage.getItem(MAPPING_STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored)[sig] || null;
  } catch { return null; }
};

/** Persists a column mapping keyed by file header signature. Future uploads skip AI detection. */
export const saveMapping = (headers: string[], mapping: FileMapping): void => {
  try {
    const sig = getFileSignature(headers);
    if (!sig) return;
    if (typeof window === 'undefined' || !window.localStorage || typeof window.localStorage.getItem !== 'function' || typeof window.localStorage.setItem !== 'function') {
      return;
    }
    const stored = window.localStorage.getItem(MAPPING_STORAGE_KEY);
    const mappings = stored ? JSON.parse(stored) : {};
    mappings[sig] = mapping;
    window.localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify(mappings));
  } catch (e) { console.warn('Failed to save mapping', e); }
};

/** Clears all saved column mappings. Called by clearAllData so re-uploads always re-detect format. */
export const clearStoredMappings = (): void => {
  try {
    if (typeof window === 'undefined' || !window.localStorage || typeof window.localStorage.removeItem !== 'function') {
      return;
    }
    window.localStorage.removeItem(MAPPING_STORAGE_KEY);
  } catch (e) { console.warn('Failed to clear mappings', e); }
};

const promiseWithTimeout = <T>(promise: PromiseLike<T>, ms = 15000): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Supabase request timed out'));
    }, ms);
    promise.then(
      res => {
        clearTimeout(timeout);
        resolve(res);
      },
      err => {
        clearTimeout(timeout);
        reject(err);
      }
    );
  });
};

// --- Learning Rules ---

/**
 * Hydrates the in-memory rule cache from Supabase. Called on app startup and after
 * sign-in. Safe to call offline — warns on failure but does not throw.
 */
export const initializeRules = async () => {
  ruleCache = [];
  currentUserId = null;
  if (!supabase) return;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    currentUserId = session.user.id;

    const { data, error } = await promiseWithTimeout(
      supabase.from(TABLES.CATEGORY_RULES).select('*'),
      30000
    );
    if (error) {
      console.warn('Rules init warning:', error.message);
      return;
    }
    if (data) {
      ruleCache = data as LearningRule[];
      console.log(`Brain: Loaded ${ruleCache.length} rules`);
    }
  } catch (err) {
    console.warn('Offline: Could not initialize learning rules', err);
  }
};

/**
 * Stores a keyword→value rule used by `applyRules`. Adds to local cache immediately
 * and writes to Supabase in the background if signed in. `status='pending'` rules
 * are not used for matching until an admin promotes them.
 */
export const saveRule = async (
  keyword: string,
  value: string,
  field: 'category' | 'type' | 'project' | 'subCategory' = 'category',
  status: 'pending' | 'active' = 'pending'
): Promise<void> => {
  const cleanKey = keyword.trim().toLowerCase();
  if (!cleanKey) return;

  const newRule: LearningRule = {
    keyword: cleanKey,
    target_field: field,
    value,
    // User-authored rules are always source/scope 'user'. They become shared
    // ('system') only via the consensus trigger or an admin promotion (see
    // schema.sql + promoteRule) — never at creation time.
    source: 'user',
    scope: 'user',
    status,
    user_id: currentUserId ?? undefined,
  };
  ruleCache.push(newRule);

  if (supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.from(TABLES.CATEGORY_RULES).upsert(
          { user_id: session.user.id, keyword: cleanKey, target_field: field, value, source: 'user', scope: 'user', status },
          { onConflict: 'user_id,keyword,target_field' }
        );
        logEvent('rule_proposed', { keyword: cleanKey, field, value });
      }
    } catch (e) { console.warn('Failed to sync rule', e); }
  }
};

/**
 * Admin-only: promote a rule to a SHARED system rule so every user benefits.
 *
 * Sets `scope='system'` (the field the RLS SELECT policy actually checks — see
 * schema.sql) plus `source='system'` and `status='active'`. This is the single
 * source of truth for "promote"; the admin UI delegates here so the two code
 * paths can't drift apart again. Throws on error so callers can surface it.
 */
export const promoteRule = async (id: number): Promise<void> => {
  if (!supabase) return;
  const { error } = await supabase
    .from(TABLES.CATEGORY_RULES)
    .update({ scope: 'system', source: 'system', status: 'active' })
    .eq('id', id);
  if (error) throw error;
};

/** Admin-only: removes a rule entirely. Throws on error so callers can surface it. */
export const deleteRule = async (id: number): Promise<void> => {
  if (!supabase) return;
  const { error } = await supabase.from(TABLES.CATEGORY_RULES).delete().eq('id', id);
  if (error) throw error;
};

/**
 * Finds the best matching active rule for `text`. Case-insensitive substring match;
 * longest keyword wins on ties. Returns the rule's value, or null if nothing matches.
 */
export const applyRules = (text: string, field: 'category' | 'type' | 'project' | 'subCategory' = 'category'): string | null => {
  if (!text) return null;
  const textLower = text.toLowerCase();

  const isOwn = (r: LearningRule) => !!r.user_id && r.user_id === currentUserId;

  const candidates = ruleCache
    .filter(r => r.status === 'active' && r.target_field === field)
    .sort((a, b) => {
      // Most specific (longest keyword) wins first.
      if (b.keyword.length !== a.keyword.length) return b.keyword.length - a.keyword.length;
      // On a tie, the user's OWN rule beats a shared system rule — a personal
      // correction must never be overridden by the crowd-sourced default.
      return (isOwn(a) ? 0 : 1) - (isOwn(b) ? 0 : 1);
    });

  for (const rule of candidates) {
    if (textLower.includes(rule.keyword)) return rule.value;
  }
  return null;
};

/** Shortcut for `applyRules(description, 'category')`. */
export const getLearnedCategory = (description: string): string | null => {
  return applyRules(description, 'category');
};

/** Snapshot of the current rule cache (copy — safe to mutate). Used by Admin Rules tab. */
export const getAllRules = () => [...ruleCache];

// ── Smart Learning: auto-create rules from user edits ─────────

interface TransactionLike {
  original_description?: string;
  notes: string;
  merchant_name?: string;
  type?: string;
  subCategory?: string;
}

/**
 * Creates a learning rule when the user edits a transaction's category or subCategory.
 * Uses the original bank description as the keyword so future uploads with the same
 * description auto-categorize correctly.
 *
 * @returns true if a rule was created, false if skipped
 */
export const createRuleFromEdit = async (
  transaction: TransactionLike,
  field: 'category' | 'subCategory',
  newValue: string
): Promise<boolean> => {
  // Transfer / Refund / Inter-Account are STRUCTURAL classifications, not learnable
  // merchant categories. Training a rule from one (e.g. a bank "refund" line) would
  // wrongly re-categorize unrelated future transactions that share the description.
  // Skip them regardless of which field is being edited.
  if (
    transaction.type === 'Transfer' ||
    transaction.subCategory === 'Refund' ||
    transaction.subCategory === 'Inter-Account'
  ) {
    return false;
  }

  // Determine the best keyword: prefer raw bank text, fall back to notes, then
  // normalize away PII/ref numbers so the rule generalizes and is safe to share.
  const keyword = normalizeKeyword(transaction.original_description || transaction.notes || '');
  if (keyword.length < 3) return false;

  // Don't create rules for meaningless values
  const skip = ['unclassified', 'general', 'nan', ''];
  if (skip.includes(newValue.toLowerCase())) return false;

  await saveRule(keyword, newValue, field, 'active');
  return true;
};
