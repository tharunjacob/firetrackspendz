import type { Transaction } from '@/types';
import { localSave, localLoad, localDelete, localReset } from './localStorage';
import { cloudSave, cloudLoad, cloudDelete } from './cloudStorage';
import { isCloudEnabled, getSupabase } from './supabase';
import { logEvent } from './logger';

// ============================================================
// Storage Gateway - Routes to local or cloud storage
// ============================================================

/**
 * Resolve the CURRENT auth state directly from Supabase on every call.
 *
 * We deliberately do NOT cache this in a module-level boolean. A cached flag is
 * populated asynchronously at startup and can still read `false` for a returning
 * signed-in user during the brief window before the session resolves — which
 * would route their reads/writes to local IndexedDB instead of the cloud
 * (empty dashboard on refresh, or an edit saved to the wrong backend that only
 * self-heals on the next sign-in). getSession() reads the persisted session
 * locally (no network round-trip), so calling it per-operation is cheap and
 * always correct.
 */
const isUserLoggedIn = async (): Promise<boolean> => {
  if (!isCloudEnabled()) return false;
  try {
    const { data: { session } } = await getSupabase().auth.getSession();
    return !!session;
  } catch {
    return false;
  }
};

const isMimicMode = (): boolean => {
  const params = new URLSearchParams(window.location.search);
  return !!params.get('mimic_user_id');
};

/**
 * Persists transactions to the appropriate backend (cloud if signed in, local otherwise).
 * No-op under Mimic Mode to prevent admins from writing to another user's account.
 * Re-throws on failure so callers can surface a toast.
 */
export const saveToStorage = async (transactions: Transaction[]): Promise<void> => {
  if (isMimicMode()) {
    console.warn('Save blocked: Mimic Mode active');
    return;
  }

  try {
    if (await isUserLoggedIn()) {
      await cloudSave(transactions);
      logEvent('data_saved_cloud', { count: transactions.length });
    } else {
      await localSave(transactions);
      logEvent('data_saved_local', { count: transactions.length });
    }
  } catch (err) {
    console.error('Storage Gateway Error (Save)', err);
    throw err;
  }
};

/**
 * Loads all transactions for the current session.
 * Honors `?mimic_user_id=` query param so admins can view another account's data.
 * Returns `[]` (not throw) on failure so UI can render an empty state.
 */
export const loadFromStorage = async (): Promise<Transaction[]> => {
  try {
    const params = new URLSearchParams(window.location.search);
    const mimicId = params.get('mimic_user_id');

    if (mimicId) {
      console.log(`Gateway: MIMIC MODE for ${mimicId}`);
      return await cloudLoad(mimicId);
    }

    if (await isUserLoggedIn()) {
      return await cloudLoad();
    } else {
      return await localLoad();
    }
  } catch (err) {
    console.error('Storage Gateway Error (Load)', err);
    throw err;
  }
};

/**
 * Deletes the given transaction ids from the appropriate backend.
 * No-op under Mimic Mode. Re-throws on failure.
 */
export const deleteFromStorage = async (ids: string[]): Promise<void> => {
  if (isMimicMode()) return;

  try {
    if (await isUserLoggedIn()) {
      await cloudDelete(ids);
      logEvent('data_deleted_cloud', { count: ids.length });
    } else {
      await localDelete(ids);
      logEvent('data_deleted_local', { count: ids.length });
    }
  } catch (err) {
    console.error('Storage Gateway Error (Delete)', err);
    throw err;
  }
};

/**
 * Promotes data from IndexedDB (the local backend) to the current user's cloud
 * account, then wipes local. Pushes the FULL local set — there is no 500-cap
 * here (the cap is a UI-side preview limit, not a storage limit).
 *
 * Called on sign-in from AuthContext. No-op if the user is not signed in.
 *
 * NOTE — anon→signup data path: anonymous uploads currently live only in
 * DataContext's `allTransactionsRaw` state (memory). They are not written
 * to IndexedDB by `processFiles`, so this function will not see them on
 * sign-in. The DataContext-level promotion of `allTransactionsRaw` is
 * separate from this function.
 */
export const syncLocalToCloud = async (): Promise<void> => {
  if (!(await isUserLoggedIn())) return;

  const localData = await localLoad();
  if (localData.length > 0) {
    console.log(`Syncing ${localData.length} local items to cloud...`);
    await cloudSave(localData);
    await localReset();
    logEvent('sync_local_to_cloud', { count: localData.length });
  }
};

/**
 * Wipes both local and (if signed in) cloud transaction data for the current user.
 * Used by Settings "Reset all data". Best-effort on the cloud side — local reset
 * always runs first so the UI state can recover even if the cloud call fails.
 */
export const resetAllData = async (): Promise<void> => {
  await localReset();
  if (await isUserLoggedIn()) {
    try {
      const allCloud = await cloudLoad();
      if (allCloud.length > 0) {
        await cloudDelete(allCloud.map(t => t.id));
        logEvent('data_reset_cloud', { count: allCloud.length });
      }
    } catch (err) {
      console.error('Storage Gateway Error (Reset Cloud)', err);
    }
  }
};
