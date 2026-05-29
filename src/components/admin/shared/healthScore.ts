import type { UserProfile, AppLog, UserHealthScore } from '@/types';

// ============================================================
// User Health Score — 0 to 100
//
//  loginFrequency  (0–40 pts): unique session-days in last 30d / 12
//  featureDepth    (0–30 pts): unique feature_* events / 6
//  dataFreshness   (0–30 pts): linear decay, 0 days = 30, 60+ days = 0
//
//  churnRisk:  score >= 60 → low   (green)
//              score 30–59 → medium (amber)
//              score <  30 → high  (red)
// ============================================================

export const computeHealthScore = (
  user: UserProfile,
  userLogs: AppLog[]
): UserHealthScore => {
  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * 86400000).toISOString();

  // ── Login frequency ───────────────────────────────────────
  const recentLogs = userLogs.filter(l => l.created_at >= thirtyDaysAgo);
  const sessionDays = new Set(
    recentLogs
      .filter(l => l.event === 'session_start' || l.event === 'page_view')
      .map(l => l.created_at.substring(0, 10))
  ).size;
  // 12 session-days = full score
  const loginFrequency = Math.min(40, Math.round((sessionDays / 12) * 40));

  // ── Feature depth ─────────────────────────────────────────
  const featureEvents = new Set(
    recentLogs
      .filter(l => l.event.startsWith('feature_'))
      .map(l => l.event)
  ).size;
  // 6 distinct features = full score
  const featureDepth = Math.min(30, Math.round((featureEvents / 6) * 30));

  // ── Data freshness ────────────────────────────────────────
  const lastUpload = userLogs.find(l => l.event === 'upload_analysis_completed');
  let dataFreshness = 0;
  if (lastUpload) {
    const daysSince = (now - new Date(lastUpload.created_at).getTime()) / 86400000;
    dataFreshness = Math.max(0, Math.round((1 - daysSince / 60) * 30));
  }

  const score = loginFrequency + featureDepth + dataFreshness;
  const churnRisk: 'low' | 'medium' | 'high' =
    score >= 60 ? 'low' : score >= 30 ? 'medium' : 'high';

  return { userId: user.id, score, loginFrequency, featureDepth, dataFreshness, churnRisk };
};

// ── Helpers ───────────────────────────────────────────────────

export const churnRiskColor = (risk: 'low' | 'medium' | 'high') =>
  risk === 'low' ? 'text-green-600 bg-green-50' :
  risk === 'medium' ? 'text-amber-600 bg-amber-50' :
  'text-red-600 bg-red-50';

export const scoreColor = (score: number) =>
  score >= 60 ? 'text-green-700' : score >= 30 ? 'text-amber-600' : 'text-red-600';
