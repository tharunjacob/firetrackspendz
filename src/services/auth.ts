import type { Session } from '@supabase/supabase-js';
import { getSupabase, isCloudEnabled } from './supabase';
import type { UserProfile, SubscriptionPlan } from '@/types';
import { AuthError } from '@/utils/errors';
import { TABLES } from '@/config/database';

// ============================================================
// Authentication Service - Proper OAuth redirect flow
// ============================================================

export interface AuthState {
  user: { id: string; email: string } | null;
  profile: UserProfile | null;
  loading: boolean;
}

/** Creates a new Supabase user. Supabase sends the confirmation email automatically. */
export const signUp = async (email: string, password: string, fullName?: string) => {
  if (!isCloudEnabled()) throw new AuthError('Cloud not configured');
  const supabase = getSupabase();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName || '' },
    },
  });

  if (error) throw error;
  return data;
};

/** Email/password sign-in. Throws on invalid credentials. */
export const signIn = async (email: string, password: string) => {
  if (!isCloudEnabled()) throw new AuthError('Cloud not configured');
  const supabase = getSupabase();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
};

/** Kicks off the Google OAuth redirect flow. Returns control to /auth/callback. */
export const signInWithGoogle = async () => {
  if (!isCloudEnabled()) throw new AuthError('Cloud not configured');
  const supabase = getSupabase();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'https://www.trackspendz.com/auth/callback',
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) throw error;
  return data;
};

/** Sends a magic-link email. The link lands on /auth/callback to finalize sign-in. */
export const signInWithMagicLink = async (email: string) => {
  if (!isCloudEnabled()) throw new AuthError('Cloud not configured');
  const supabase = getSupabase();

  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) throw error;
  return data;
};

/** Ends the current session. Fires the SIGNED_OUT auth event, which AuthContext handles. */
export const signOut = async () => {
  if (!isCloudEnabled()) return;
  const supabase = getSupabase();
  try {
    await promiseWithTimeout(supabase.auth.signOut(), 3000);
  } catch (e) {
    console.warn('[auth] signOut timed out or failed, clearing local storage manually', e);
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (err) {
      console.error('[auth] Failed to clear local storage manually:', err);
    }
  }
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

/** Returns the current Supabase session, or null if unauthenticated / cloud disabled. */
export const getSession = async () => {
  if (!isCloudEnabled()) return null;
  const supabase = getSupabase();
  try {
    const { data: { session } } = await promiseWithTimeout(supabase.auth.getSession(), 30000);
    return session;
  } catch (e) {
    console.warn('[auth] getSession timed out or failed, falling back to local', e);
    return null;
  }
};

/** Returns the current user object, or null if unauthenticated / cloud disabled. */
export const getCurrentUser = async () => {
  if (!isCloudEnabled()) return null;
  const supabase = getSupabase();
  try {
    const { data: { user } } = await promiseWithTimeout(supabase.auth.getUser(), 30000);
    return user;
  } catch (e) {
    console.warn('[auth] getCurrentUser timed out or failed, falling back to local', e);
    return null;
  }
};

/**
 * Fetches a user profile row. Returns null (not throw) when the row doesn't exist
 * yet (PGRST116) — callers create a fresh profile in that case.
 */
export const getProfile = async (userId: string): Promise<UserProfile | null> => {
  if (!isCloudEnabled()) return null;
  const supabase = getSupabase();

  try {
    const { data, error } = await promiseWithTimeout(
      supabase
        .from(TABLES.USER_PROFILES)
        .select('*')
        .eq('id', userId)
        .single(),
      30000
    );

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      console.warn('Profile fetch error:', error);
      return null;
    }

    return {
      ...data,
      subscription_plan: data.subscription_plan || 'free',
      manual_assets: data.manual_assets || [],
    } as UserProfile;
  } catch (e) {
    console.warn('[auth] getProfile timed out or failed', e);
    return null;
  }
};

/** Inserts or updates a user profile row. Throws on DB error. */
export const upsertProfile = async (profile: Partial<UserProfile> & { id: string }): Promise<void> => {
  if (!isCloudEnabled()) return;
  const supabase = getSupabase();

  const { error } = await supabase
    .from(TABLES.USER_PROFILES)
    .upsert(profile, { onConflict: 'id' });

  if (error) throw error;
};

/** Returns the user's subscription tier, defaulting to 'free' if the profile is missing. */
export const getUserPlan = async (userId: string): Promise<SubscriptionPlan> => {
  const profile = await getProfile(userId);
  return profile?.subscription_plan || 'free';
};

// NOTE: Feature gating lives in `@/config/plans` (canAccessFeature) — the single
// source of truth for plan→feature mappings. A duplicate implementation that
// once lived here used different, out-of-sync feature keys and has been removed.

/**
 * Subscribes to Supabase auth state changes (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED).
 * Returns a no-op subscription when cloud is disabled so callers can always unsubscribe.
 */
export const onAuthStateChange = (callback: (event: string, session: Session | null) => void) => {
  if (!isCloudEnabled()) return { data: { subscription: { unsubscribe: () => {} } } };
  const supabase = getSupabase();
  return supabase.auth.onAuthStateChange(callback);
};
