import { getSupabase, isCloudEnabled } from './supabase';
import { TABLES } from '@/config/database';

// ============================================================
// User Settings Gateway — generic per-user key/value storage
// ============================================================
//
// Routes to Supabase `user_settings` table when authenticated, and to
// localStorage otherwise. Used for goals, budgets, and similar
// small per-user blobs that don't warrant their own table.
//
// Required Supabase schema (run once in the SQL editor):
//
//   create table user_settings (
//     user_id uuid references auth.users(id) on delete cascade,
//     key text not null,
//     value jsonb,
//     updated_at timestamptz default now(),
//     primary key (user_id, key)
//   );
//   alter table user_settings enable row level security;
//   create policy "own settings" on user_settings
//     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
//
// Callers must gate reads on AuthContext.isAuthReady so the session is
// settled before routing. Writes are safe to call anytime — they mirror
// to localStorage and best-effort write to cloud.
// ============================================================

const getCurrentUserId = async (): Promise<string | null> => {
  if (!isCloudEnabled()) return null;
  try {
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
};

/**
 * Reads a per-user setting. Prefers Supabase when signed in; falls back to
 * localStorage (also used as offline cache). Returns `fallback` on any error.
 * Callers should gate on AuthContext.isAuthReady to avoid a local→cloud flicker.
 */
export const getUserSetting = async <T>(key: string, fallback: T): Promise<T> => {
  try {
    const userId = await getCurrentUserId();
    if (userId) {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from(TABLES.USER_SETTINGS)
        .select('value')
        .eq('user_id', userId)
        .eq('key', key)
        .maybeSingle();
      if (error) {
        if (import.meta.env.DEV && (error as { code?: string }).code === '42P01') {
          console.warn(
            '[userSettings] ⚠️  The "user_settings" table does not exist in Supabase. ' +
            'Run supabase/migrations/001_user_settings.sql in your project\'s SQL editor. ' +
            'Falling back to localStorage.'
          );
        }
      } else if (data) {
        return data.value as T;
      }
    }
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch (e) {
    console.warn(`[userSettings] get(${key}) failed:`, e);
    return fallback;
  }
};

/**
 * Writes a per-user setting. Always mirrors to localStorage first (offline-safe),
 * then best-effort writes to Supabase. Silent on cloud failure — local copy is
 * authoritative for read. Safe to call even when unauthenticated.
 */
export const setUserSetting = async <T>(key: string, value: T): Promise<void> => {
  // Always mirror locally — serves as offline cache and anonymous storage.
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota / private mode */ }

  try {
    const userId = await getCurrentUserId();
    if (!userId) return;
    const supabase = getSupabase();
    const { error } = await supabase.from(TABLES.USER_SETTINGS).upsert({
      user_id: userId,
      key,
      value,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,key' });
    if (error) throw error;
  } catch (e) {
    console.warn(`[userSettings] set(${key}) cloud write failed:`, e);
  }
};
