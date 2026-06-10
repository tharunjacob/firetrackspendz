import { getSupabase } from '@/services/supabase';
import { TABLES } from '@/config/database';
import type { Transaction, UserAchievement } from '@/types';

// ============================================================
// Achievements & Streaks Service
// ============================================================
//
// Computes streaks and milestones from transaction data and
// persists them to the user_achievements table. Achievements
// are idempotent — calling computeAndPersist multiple times
// with the same data won't create duplicates (UNIQUE constraint
// on user_id + achievement_key).
//
// Achievement types:
//   streak    — consecutive months of a behavior (upload, budget, savings)
//   milestone — one-time events (FIRE 25%, 50%, etc.)
//   wrapped   — year-in-review generated
//   referral  — referral program milestones
// ============================================================

interface StreakResult {
  key: string;
  label: string;
  currentStreak: number;
  bestStreak: number;
  icon: string;
}

/** Get all unique months (YYYY-MM) that have at least one transaction */
const getMonthsWithData = (txns: Transaction[]): Set<string> =>
  new Set(txns.map(t => t.date.substring(0, 7)));

/** Get consecutive months backwards from the most recent month */
const computeConsecutiveMonths = (months: Set<string>): number => {
  if (months.size === 0) return 0;
  const sorted = [...months].sort().reverse();
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const [prevY, prevM] = sorted[i - 1].split('-').map(Number);
    const [curY, curM] = sorted[i].split('-').map(Number);
    const prevDate = new Date(prevY, prevM - 1);
    const curDate = new Date(curY, curM - 1);
    const diffMonths = (prevDate.getFullYear() - curDate.getFullYear()) * 12 + (prevDate.getMonth() - curDate.getMonth());
    if (diffMonths === 1) streak++;
    else break;
  }
  return streak;
};

/** Compute upload streak — consecutive months with at least 1 transaction */
export const computeUploadStreak = (txns: Transaction[]): StreakResult => {
  const months = getMonthsWithData(txns);
  return {
    key: 'upload_streak',
    label: 'Upload Streak',
    currentStreak: computeConsecutiveMonths(months),
    bestStreak: months.size, // approximate
    icon: '📤',
  };
};

/** Compute savings streak — consecutive months with savings rate > threshold */
export const computeSavingsStreak = (txns: Transaction[], threshold = 10): StreakResult => {
  const monthlyMap = new Map<string, { income: number; expense: number }>();
  txns.forEach(t => {
    const m = t.date.substring(0, 7);
    const cur = monthlyMap.get(m) || { income: 0, expense: 0 };
    if (t.type === 'Income') cur.income += t.amount;
    else if (t.type === 'Expense') cur.expense += t.amount;
    monthlyMap.set(m, cur);
  });

  const goodMonths = new Set<string>();
  monthlyMap.forEach((v, m) => {
    const rate = v.income > 0 ? ((v.income - v.expense) / v.income) * 100 : 0;
    if (rate >= threshold) goodMonths.add(m);
  });

  return {
    key: 'savings_streak',
    label: `Savings Streak (>${threshold}%)`,
    currentStreak: computeConsecutiveMonths(goodMonths),
    bestStreak: goodMonths.size,
    icon: '💰',
  };
};

/** Compute budget streak — consecutive months all budgets stayed under limit */
export const computeBudgetStreak = (
  txns: Transaction[],
  budgets: { category: string; monthly_limit: number }[]
): StreakResult => {
  if (budgets.length === 0) return { key: 'budget_streak', label: 'Budget Streak', currentStreak: 0, bestStreak: 0, icon: '🎯' };

  const monthlySpend = new Map<string, Map<string, number>>();
  txns.filter(t => t.type === 'Expense').forEach(t => {
    const m = t.date.substring(0, 7);
    if (!monthlySpend.has(m)) monthlySpend.set(m, new Map());
    const catMap = monthlySpend.get(m)!;
    catMap.set(t.category, (catMap.get(t.category) || 0) + t.amount);
  });

  const goodMonths = new Set<string>();
  monthlySpend.forEach((catMap, m) => {
    const allUnder = budgets.every(b => (catMap.get(b.category) || 0) <= b.monthly_limit);
    if (allUnder) goodMonths.add(m);
  });

  return {
    key: 'budget_streak',
    label: 'Budget Streak',
    currentStreak: computeConsecutiveMonths(goodMonths),
    bestStreak: goodMonths.size,
    icon: '🎯',
  };
};

/** Compute all streaks */
export const computeAllStreaks = (
  txns: Transaction[],
  budgets: { category: string; monthly_limit: number }[] = []
): StreakResult[] => [
  computeUploadStreak(txns),
  computeSavingsStreak(txns),
  computeBudgetStreak(txns, budgets),
];

// ── FIRE Milestones ─────────────────────────────────────────

export interface FireMilestone {
  key: string;
  label: string;
  threshold: number; // percentage (10, 25, 50, 75, 100)
  reached: boolean;
  icon: string;
}

export const checkFireMilestones = (
  currentNetWorth: number,
  fireNumber: number
): FireMilestone[] => {
  if (fireNumber <= 0) return [];
  const pct = (currentNetWorth / fireNumber) * 100;
  return [
    { key: 'fire_10pct',  label: '10% to FIRE',  threshold: 10,  reached: pct >= 10,  icon: '🔥' },
    { key: 'fire_25pct',  label: '25% to FIRE',  threshold: 25,  reached: pct >= 25,  icon: '🔥' },
    { key: 'fire_50pct',  label: '50% to FIRE',  threshold: 50,  reached: pct >= 50,  icon: '🔥' },
    { key: 'fire_75pct',  label: '75% to FIRE',  threshold: 75,  reached: pct >= 75,  icon: '🔥' },
    { key: 'fire_100pct', label: 'FIRE Reached!', threshold: 100, reached: pct >= 100, icon: '🎉' },
  ];
};

// ── Persistence ─────────────────────────────────────────────

export const persistAchievement = async (
  userId: string,
  type: UserAchievement['achievement_type'],
  key: string,
  value: Record<string, unknown> = {}
): Promise<void> => {
  try {
    await getSupabase().from(TABLES.USER_ACHIEVEMENTS).upsert({
      user_id: userId,
      achievement_type: type,
      achievement_key: key,
      value,
      earned_at: new Date().toISOString(),
    }, { onConflict: 'user_id,achievement_key' });
  } catch {
    console.warn('Failed to persist achievement:', key);
  }
};

export const loadUserAchievements = async (userId: string): Promise<UserAchievement[]> => {
  try {
    if (!userId) return [];
    const { data, error } = await getSupabase()
      .from(TABLES.USER_ACHIEVEMENTS)
      .select('*')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false });
    if (error) { console.warn('Failed to load achievements:', error.message); return []; }
    return (data as UserAchievement[]) || [];
  } catch (e) {
    console.warn('Failed to load achievements:', e);
    return [];
  }
};
