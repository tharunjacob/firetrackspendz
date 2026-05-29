import { getSupabase, isCloudEnabled } from './supabase';
import type { Transaction, TransactionType } from '@/types';
import { StorageError, AuthError } from '@/utils/errors';
import { TABLES } from '@/config/database';

// ============================================================
// Supabase Cloud Repository
// ============================================================

/** Raw database row shape — keeps DB ↔ app mapping explicit and type-safe */
interface TransactionRow {
  id: string;
  user_id: string;
  file_id: string | null;
  owner: string;
  type: string;
  date: string;
  time: string | null;
  category: string;
  sub_category: string | null;
  notes: string | null;
  description?: string | null;
  amount: number;
  project: string | null;
  merchant_name: string | null;
  original_description: string | null;
  is_recurring: boolean;
  is_excluded_from_fire: boolean;
}

/** Retry wrapper with exponential backoff for transient failures */
const withRetry = async <T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt === maxRetries - 1) throw e;
      const delay = Math.pow(2, attempt) * 500;
      console.warn(`[cloudStorage] Retry ${attempt + 1}/${maxRetries} after ${delay}ms`, e);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new StorageError('Max retries reached. Please check your connection.', 'RETRIES_EXHAUSTED');
};

const mapToDb = (t: Transaction, userId: string) => ({
  id: t.id,
  user_id: userId,
  file_id: t.file_id || null,
  owner: t.owner,
  type: t.type,
  date: t.date,
  time: t.time,
  category: t.category,
  sub_category: t.subCategory,
  notes: t.notes,
  amount: t.amount,
  project: t.project,
  merchant_name: t.merchant_name || null,
  original_description: t.original_description || t.notes,
  is_recurring: t.is_recurring || false,
  is_excluded_from_fire: t.is_excluded_from_fire || false,
});

const mapFromDb = (row: TransactionRow): Transaction => ({
  id: row.id,
  user_id: row.user_id,
  file_id: row.file_id ?? undefined,
  owner: row.owner,
  type: row.type as TransactionType,
  date: row.date,
  time: row.time,
  category: row.category,
  subCategory: row.sub_category || '',
  notes: row.notes || row.description || '',
  amount: row.amount,
  project: row.project,
  merchant_name: row.merchant_name ?? undefined,
  original_description: row.original_description ?? undefined,
  is_recurring: row.is_recurring,
  is_excluded_from_fire: row.is_excluded_from_fire,
});

const chunkArray = <T>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
};

/**
 * Upserts transactions into Supabase for the currently-authenticated user.
 * Chunks in batches of 500 to stay under Supabase payload limits and retries
 * transient failures with exponential backoff. Throws AuthError if unauthenticated.
 */
export const cloudSave = async (transactions: Transaction[]): Promise<void> => {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AuthError('Not authenticated');

  const payload = transactions.map(t => mapToDb(t, user.id));
  const batches = chunkArray(payload, 500);

  for (const batch of batches) {
    await withRetry(async () => {
      const { error } = await supabase.from(TABLES.TRANSACTIONS).upsert(batch, { onConflict: 'id' });
      if (error) throw error;
    });
  }
};

/**
 * Loads all transactions for the current user (or `targetUserId` if provided, used for Mimic Mode).
 * Paginates in 5000-row pages so users with large histories don't hit Supabase row limits.
 * Returns `[]` if cloud is disabled or the user is not authenticated.
 */
export const cloudLoad = async (targetUserId?: string): Promise<Transaction[]> => {
  if (!isCloudEnabled()) return [];
  const supabase = getSupabase();

  let userId = targetUserId;
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    userId = user.id;
  }

  // Paginate for large datasets
  const allData: TransactionRow[] = [];
  let from = 0;
  const pageSize = 5000;

  while (true) {
    const { data, error } = await withRetry(async () => {
      return supabase
        .from(TABLES.TRANSACTIONS)
        .select('*')
        .eq('user_id', userId!)
        .range(from, from + pageSize - 1)
        .order('date', { ascending: false });
    });

    if (error) throw error;
    if (!data || data.length === 0) break;

    allData.push(...(data as TransactionRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allData.map(mapFromDb);
};

/**
 * Deletes the given transaction ids from Supabase, chunked into batches of 1000.
 * Relies on RLS to scope deletes to the current user — does not pass user_id.
 */
export const cloudDelete = async (ids: string[]): Promise<void> => {
  const supabase = getSupabase();

  const batches = chunkArray(ids, 1000);
  for (const batch of batches) {
    await withRetry(async () => {
      const { error } = await supabase.from(TABLES.TRANSACTIONS).delete().in('id', batch);
      if (error) throw error;
    });
  }
};
