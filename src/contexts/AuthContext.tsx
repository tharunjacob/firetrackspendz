import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import type { UserProfile, SubscriptionPlan } from '@/types';
import { getCurrentUser, getProfile, onAuthStateChange, signOut as authSignOut } from '@/services/auth';
import { syncLocalToCloud } from '@/services/storage';
import { initializeRules } from '@/services/learningRules';
import { logEvent, EVENTS } from '@/services/logger';
import { claimReferral } from '@/services/referral';
import { getSupabase, isCloudEnabled } from '@/services/supabase';
import { RPC } from '@/config/database';
import { useUI } from './UIContext';

// ============================================================
// Auth Context — Handles user authentication state ONLY
// ============================================================
//
// WHAT THIS CONTEXT MANAGES:
//   - userId, userEmail, profile (who is logged in)
//   - plan (subscription tier)
//   - isAuthOpen (whether the login modal is showing)
//   - logout() action
//   - isMimicMode (admin viewing as another user)
//
// WHAT THIS CONTEXT DOES NOT MANAGE:
//   - Transactions → see DataContext
//   - UI state (toasts, tabs, currency) → see UIContext
//
// WHY SPLIT:
//   If we change how auth works (e.g., switch from Supabase to Clerk),
//   ONLY this file needs to change. Transaction logic and UI are unaffected.
//
// CONSUMED BY: Navbar, AdminPage, SettingsPage, any auth-gated feature
// ============================================================

interface AuthState {
  userId: string | null;
  userEmail: string | null;
  profile: UserProfile | null;
  plan: SubscriptionPlan;
  isAuthOpen: boolean;
  setIsAuthOpen: (open: boolean) => void;
  user: { id: string; email: string } | null;
  logout: () => Promise<void>;
  isMimicMode: boolean;
  isAuthReady: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
}

/**
 * Races a promise against a timeout, resolving to `fallback` if it doesn't settle in
 * time. Used so a hung Supabase call (cold start / token-refresh stall) can never
 * keep the app gated behind the global Loading… spinner.
 */
const withTimeout = <T,>(p: PromiseLike<T>, ms: number, fallback: T): Promise<T> =>
  Promise.race([
    Promise.resolve(p),
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);

const AuthContext = createContext<AuthState | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

interface AuthProviderProps {
  children: ReactNode;
  onSignIn?: (userId: string, email: string) => void;
  onSignOut?: () => void;
}

export const AuthProvider = ({ children, onSignIn, onSignOut }: AuthProviderProps) => {
  const { currency, setCurrency } = useUI();
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMimicMode] = useState(() => !!new URLSearchParams(window.location.search).get('mimic_user_id'));

  const devPlan = import.meta.env.DEV
    ? (new URLSearchParams(window.location.search).get('dev_plan') as SubscriptionPlan | null)
    : null;
  const user = devPlan
    ? { id: 'dev-user-001', email: 'dev@trackspendz.local' }
    : (userId && userEmail ? { id: userId, email: userEmail } : null);
  const plan: SubscriptionPlan = devPlan || profile?.subscription_plan || 'free';
  const effectiveUserId = devPlan ? 'dev-user-001' : userId;
  const effectiveEmail = devPlan ? 'dev@trackspendz.local' : userEmail;

  // Initialize auth state on mount
  useEffect(() => {
    let isCancelled = false; // guard against setState after unmount
    let authVersion = 0;     // tracks latest auth event to prevent stale handlers

    // FAILSAFE — the entire app is gated behind isAuthReady (App.tsx). Never let a
    // hung Supabase call (cold start, expired refresh token, auth-lock stall) leave
    // the user stuck on the Loading… spinner forever: reveal the UI within 4s no
    // matter what. Profile/admin/rules keep loading in the background and re-render
    // via state when they arrive.
    const watchdog = setTimeout(() => {
      if (!isCancelled) setIsAuthReady(true);
    }, 4000);

    const ADMIN_EMAILS = ['tharun@krexo.in', 'tharunjacob@gmail.com', 'silkaminni777@gmail.com'];

    // Admin check with a hard timeout + email-allowlist fallback. The RPC previously
    // had NO timeout, so a slow/hung call blocked the whole init() chain.
    const resolveAdmin = async (email: string | null | undefined): Promise<boolean> => {
      if (!isCloudEnabled()) return false;
      try {
        const { data } = await withTimeout(
          getSupabase().rpc(RPC.IS_ADMIN),
          8000,
          { data: false, error: null } as any,
        );
        if (data === true) return true;
      } catch (e) {
        console.warn('is_admin RPC exception:', e);
      }
      return !!email && ADMIN_EMAILS.includes(email);
    };

    const init = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (isCancelled) return;

        if (currentUser) {
          setUserId(currentUser.id);
          setUserEmail(currentUser.email || null);
        }
        // Identity resolved (or confirmed absent) — unblock the UI NOW. Everything
        // below is non-blocking enrichment that must not gate the spinner.
        if (!isCancelled) setIsAuthReady(true);

        if (currentUser) {
          await initializeRules();
          if (isCancelled) return;

          const prof = await getProfile(currentUser.id);
          if (isCancelled) return;
          if (prof) {
            setProfile(prof);
            if (prof.preferred_currency) setCurrency(prof.preferred_currency);
          }

          const adminVal = await resolveAdmin(currentUser.email);
          if (!isCancelled) setIsAdmin(adminVal);

          if (!isMimicMode) {
            try {
              await syncLocalToCloud();
            } catch (e) {
              console.warn('Sync failed:', e);
            }
          }
        }
      } catch (e) {
        console.error('Auth init error:', e);
      } finally {
        if (!isCancelled) setIsAuthReady(true);
      }
    };

    init();

    const { data: { subscription } } = onAuthStateChange((event, session) => {
      const myVersion = ++authVersion; // capture version at start of this handler

      if (event === 'SIGNED_IN' && session?.user) {
        // Synchronous, lock-safe state only. Do NOT call supabase.auth.* or run
        // queries directly here: Supabase holds an internal auth lock while
        // dispatching this event, and re-entering it (getSession / token refresh)
        // deadlocks — the classic "stuck after refresh" hang. Defer all async work
        // to a macrotask so the lock is released first.
        setUserId(session.user.id);
        setUserEmail(session.user.email || null);
        setIsAuthOpen(false);

        const sessionUser = session.user;
        setTimeout(async () => {
          await initializeRules();
          if (isCancelled || authVersion !== myVersion) return; // stale — a newer event arrived

          const prof = await getProfile(sessionUser.id);
          if (isCancelled || authVersion !== myVersion) return;
          if (prof) {
            setProfile(prof);
            if (prof.preferred_currency) setCurrency(prof.preferred_currency);
          }

          const adminVal = await resolveAdmin(sessionUser.email);
          if (!isCancelled && authVersion === myVersion) setIsAdmin(adminVal);

          // Claim referral if the user arrived via a referral link
          const pendingReferralCode = localStorage.getItem('tsz_referral_code');
          if (pendingReferralCode) {
            claimReferral(pendingReferralCode, sessionUser.id)
              .then(claimed => { if (claimed) localStorage.removeItem('tsz_referral_code'); })
              .catch(() => {/* fail silently — referral claim must not block sign-in */});
          }

          // Notify DataContext to handle data promotion / loading
          if (!isCancelled && authVersion === myVersion) {
            onSignIn?.(sessionUser.id, sessionUser.email || '');
          }
        }, 0);
      } else if (event === 'SIGNED_OUT') {
        setUserId(null);
        setUserEmail(null);
        setProfile(null);
        setIsAdmin(false);
        onSignOut?.();
      }
    });

    return () => {
      isCancelled = true;
      clearTimeout(watchdog);
      subscription.unsubscribe();
    };
  }, [isMimicMode, onSignIn, onSignOut, setCurrency]);

  const logout = useCallback(async () => {
    try {
      logEvent(EVENTS.AUTH_LOGOUT, { email: userEmail });
      await authSignOut();
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      window.location.href = '/';
    }
  }, [userEmail]);

  // Sync UI currency changes back to DB
  useEffect(() => {
    if (!userId || !profile) return;
    if (profile.preferred_currency === currency) return;

    const updateDbCurrency = async () => {
      try {
        const supabase = getSupabase();
        if (supabase) {
          await supabase
            .from('user_profiles')
            .update({ preferred_currency: currency })
            .eq('id', userId);
          // Also update local profile state to prevent loop
          setProfile(prev => prev ? { ...prev, preferred_currency: currency } : null);
        }
      } catch (e) {
        console.warn('Failed to update preferred currency in DB:', e);
      }
    };

    updateDbCurrency();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, userId]);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    try {
      const prof = await getProfile(userId);
      if (prof) {
        setProfile(prof);
        if (prof.preferred_currency) {
          setCurrency(prof.preferred_currency);
        }
      }
    } catch (e) {
      console.warn('Failed to refresh profile:', e);
    }
  }, [userId, setCurrency]);

  const value = useMemo(
    () => ({
      userId: effectiveUserId, userEmail: effectiveEmail, profile, plan, isAuthOpen, setIsAuthOpen,
      user, logout, isMimicMode, isAuthReady, isAdmin, refreshProfile,
    }),
    [effectiveUserId, effectiveEmail, profile, plan, isAuthOpen, user, logout, isMimicMode, isAuthReady, isAdmin, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
