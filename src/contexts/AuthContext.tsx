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
// Auth Context â€” Handles user authentication state ONLY
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
//   - Transactions â†’ see DataContext
//   - UI state (toasts, tabs, currency) â†’ see UIContext
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
}

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
    const init = async () => {
      try {
        await initializeRules();
        const currentUser = await getCurrentUser();
        if (currentUser) {
          setUserId(currentUser.id);
          setUserEmail(currentUser.email || null);
          const prof = await getProfile(currentUser.id);
          if (prof) setProfile(prof);

          // Check if admin
          if (isCloudEnabled()) {
            try {
              const { data } = await getSupabase().rpc(RPC.IS_ADMIN);
              setIsAdmin(data === true);
            } catch { setIsAdmin(false); }
          }

          if (!isMimicMode) {
            syncLocalToCloud().catch(e => console.warn('Sync failed:', e));
          }
        }
      } catch (e) {
        console.error('Auth init error:', e);
      } finally {
        setIsAuthReady(true);
      }
    };

    init();

    const { data: { subscription } } = onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUserId(session.user.id);
        setUserEmail(session.user.email || null);
        setIsAuthOpen(false);
        await initializeRules();

        const prof = await getProfile(session.user.id);
        if (prof) setProfile(prof);

        // Check if admin
        if (isCloudEnabled()) {
          try {
            const { data } = await getSupabase().rpc(RPC.IS_ADMIN);
            setIsAdmin(data === true);
          } catch { setIsAdmin(false); }
        }

        // Claim referral if the user arrived via a referral link
        const pendingReferralCode = localStorage.getItem('tsz_referral_code');
        if (pendingReferralCode) {
          claimReferral(pendingReferralCode, session.user.id)
            .then(claimed => { if (claimed) localStorage.removeItem('tsz_referral_code'); })
            .catch(() => {/* fail silently — referral claim must not block sign-in */});
        }

        // Notify DataContext to handle data promotion / loading
        onSignIn?.(session.user.id, session.user.email || '');
      } else if (event === 'SIGNED_OUT') {
        setUserId(null);
        setUserEmail(null);
        setProfile(null);
        setIsAdmin(false);
        onSignOut?.();
      }
    });

    return () => subscription.unsubscribe();
  }, [isMimicMode, onSignIn, onSignOut]);

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

  const { currency, setCurrency } = useUI();

  // Sync DB currency to UI on sign-in
  useEffect(() => {
    if (profile?.preferred_currency && profile.preferred_currency !== currency) {
      setCurrency(profile.preferred_currency);
    }
  }, [profile?.preferred_currency, currency, setCurrency]);

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
  }, [currency, userId, profile, setProfile]);

  const value = useMemo(
    () => ({
      userId: effectiveUserId, userEmail: effectiveEmail, profile, plan, isAuthOpen, setIsAuthOpen,
      user, logout, isMimicMode, isAuthReady, isAdmin,
    }),
    [effectiveUserId, effectiveEmail, profile, plan, isAuthOpen, user, logout, isMimicMode, isAuthReady, isAdmin],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
