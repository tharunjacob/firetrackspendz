import { getSupabase } from '@/services/supabase';
import { TABLES } from '@/config/database';
import type { ReferralStats } from '@/types';

// ============================================================
// Referral Service — invite tracking & reward logic
// ============================================================
//
// Flow:
//  1. User visits Settings → Referral section → gets unique code
//  2. Shares link: trackspendz.com/?ref=CODE
//  3. LandingPage stores CODE in localStorage on visit
//  4. On signup, AuthContext claims the referral (links referee)
//  5. After 3 completed referrals → eligible for Pro reward
//
// Reward is granted by admin or automatically via checkReferralReward.
// ============================================================

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 confusion

const generateCode = (): string =>
  Array.from({ length: 8 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');

/** Get or create a referral code for the user */
export const getOrCreateReferralCode = async (userId: string): Promise<string> => {
  const supabase = getSupabase();
  // Check if user already has a referral row
  const { data: existing } = await supabase
    .from(TABLES.REFERRALS)
    .select('referral_code')
    .eq('referrer_id', userId)
    .limit(1);

  if (existing && existing.length > 0) {
    return existing[0].referral_code;
  }

  // Create a new referral entry with a unique code
  let code = generateCode();
  let attempts = 0;
  while (attempts < 5) {
    const { error } = await supabase.from(TABLES.REFERRALS).insert({
      referrer_id: userId,
      referral_code: code,
      status: 'pending',
    });
    if (!error) return code;
    // Code collision — try again
    code = generateCode();
    attempts++;
  }
  // Fallback — return a timestamped code
  return `REF${Date.now().toString(36).toUpperCase()}`;
};

/** Get referral stats for a user */
export const getReferralStats = async (userId: string): Promise<ReferralStats> => {
  const supabase = getSupabase();
  const empty: ReferralStats = { code: '', totalInvites: 0, completed: 0, pending: 0, rewardsEarned: 0 };

  const { data } = await supabase
    .from(TABLES.REFERRALS)
    .select('*')
    .eq('referrer_id', userId);

  if (!data || data.length === 0) return empty;

  const code = data[0].referral_code;
  const completed = data.filter(r => r.status === 'completed').length;
  const pending = data.filter(r => r.status === 'pending' && r.referee_id).length;
  const rewardsEarned = Math.floor(completed / 3); // 1 reward per 3 completed

  return { code, totalInvites: data.length, completed, pending, rewardsEarned };
};

/**
 * Claim a referral — called when a new user signs up with a stored referral code.
 *
 * The referee is NOT the owner of the referral row, so under RLS they cannot
 * update/insert it directly (the policies only permit the referrer). Claiming
 * therefore goes through the `claim_referral` SECURITY DEFINER RPC, which runs
 * with elevated rights and validates the code, blocks self-referral, enforces
 * one referee per code, and is idempotent. See supabase/schema.sql.
 *
 * `_newUserId` is retained for call-site compatibility but intentionally unused:
 * the RPC derives the referee from auth.uid() server-side and never trusts a
 * client-supplied id.
 */
export const claimReferral = async (referralCode: string, _newUserId: string): Promise<boolean> => {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('claim_referral', {
    p_referral_code: referralCode,
  });

  if (error) {
    console.warn('[referral] claim failed:', error.message);
    return false;
  }
  return data === true;
};

/** Check if user has earned a reward (3+ completed referrals) */
export const checkReferralReward = async (userId: string): Promise<{ eligible: boolean; completedCount: number }> => {
  const supabase = getSupabase();
  const { data } = await supabase
    .from(TABLES.REFERRALS)
    .select('id')
    .eq('referrer_id', userId)
    .eq('status', 'completed');

  const completed = data?.length || 0;
  return { eligible: completed >= 3, completedCount: completed };
};
