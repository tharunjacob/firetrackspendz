import type { FileMapping, LearningRule } from '@/types';
import { supabase } from './supabase';
import { logEvent } from './logger';
import { TABLES } from '@/config/database';

// ============================================================
// Learning Rules Engine - Gets smarter over time
// ============================================================

const MAPPING_STORAGE_KEY = 'trackspendz_mappings_v2';
let ruleCache: LearningRule[] = [];

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

const promiseWithTimeout = <T>(promise: PromiseLike<T>, ms = 6000): Promise<T> => {
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
  if (!supabase) return;

  try {
    const { data, error } = await promiseWithTimeout(
      supabase.from(TABLES.CATEGORY_RULES).select('*'),
      6000
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
    source: status === 'active' ? 'user' : 'user',
    status,
  };
  ruleCache.push(newRule);

  if (supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.from(TABLES.CATEGORY_RULES).upsert(
          { user_id: session.user.id, keyword: cleanKey, target_field: field, value, source: newRule.source, status },
          { onConflict: 'user_id,keyword,target_field' }
        );
        logEvent('rule_proposed', { keyword: cleanKey, field, value });
      }
    } catch (e) { console.warn('Failed to sync rule', e); }
  }
};

/** Admin-only: flips a pending rule to `active` and re-hydrates the cache. */
export const promoteRule = async (id: number): Promise<void> => {
  if (!supabase) return;
  await supabase.from(TABLES.CATEGORY_RULES).update({ status: 'active', source: 'admin' }).eq('id', id);
  await initializeRules();
};

/** Admin-only: removes a rule entirely and re-hydrates the cache. */
export const deleteRule = async (id: number): Promise<void> => {
  if (!supabase) return;
  await supabase.from(TABLES.CATEGORY_RULES).delete().eq('id', id);
  await initializeRules();
};

/**
 * Finds the best matching active rule for `text`. Case-insensitive substring match;
 * longest keyword wins on ties. Returns the rule's value, or null if nothing matches.
 */
export const applyRules = (text: string, field: 'category' | 'type' | 'project' | 'subCategory' = 'category'): string | null => {
  if (!text) return null;
  const textLower = text.toLowerCase();

  const candidates = ruleCache
    .filter(r => r.status === 'active' && r.target_field === field)
    .sort((a, b) => b.keyword.length - a.keyword.length);

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
  // Determine the best keyword: prefer raw bank text, fall back to notes
  const keyword = (transaction.original_description || transaction.notes || '').trim();
  if (keyword.length < 3) return false;

  // Don't create rules for meaningless values
  const skip = ['unclassified', 'general', 'nan', ''];
  if (skip.includes(newValue.toLowerCase())) return false;

  await saveRule(keyword, newValue, field, 'active');
  return true;
};
