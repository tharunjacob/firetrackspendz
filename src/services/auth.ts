import type { Session } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
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
  const supabase = getSupabase();
  if (!supabase) throw new AuthError('Cloud not configured');

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
  const supabase = getSupabase();
  if (!supabase) throw new AuthError('Cloud not configured');

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
};

/** Kicks off the Google OAuth redirect flow. Returns control to /auth/callback. */
export const signInWithGoogle = async () => {
  const supabase = getSupabase();
  if (!supabase) throw new AuthError('Cloud not configured');

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
  const supabase = getSupabase();
  if (!supabase) throw new AuthError('Cloud not configured');

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
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.auth.signOut();
};

/** Returns the current Supabase session, or null if unauthenticated / cloud disabled. */
export const getSession = async () => {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session;
};

/** Returns the current user object, or null if unauthenticated / cloud disabled. */
export const getCurrentUser = async () => {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

/**
 * Fetches a user profile row. Returns null (not throw) when the row doesn't exist
 * yet (PGRST116) — callers create a fresh profile in that case.
 */
export const getProfile = async (userId: string): Promise<UserProfile | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from(TABLES.USER_PROFILES)
    .select('*')
    .eq('id', userId)
    .single();

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
};

/** Inserts or updates a user profile row. Throws on DB error. */
export const upsertProfile = async (profile: Partial<UserProfile> & { id: string }): Promise<void> => {
  const supabase = getSupabase();
  if (!supabase) return;

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
  const supabase = getSupabase();
  if (!supabase) return { data: { subscription: { unsubscribe: () => {} } } };
  return supabase.auth.onAuthStateChange(callback);
};
