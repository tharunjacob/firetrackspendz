import { getSupabase, isCloudEnabled } from '@/services/supabase';
import { TABLES } from '@/config/database';
import type { FeatureFlag } from '@/types';

// ============================================================
// Feature Flags Service
// ============================================================

let flagCache: Map<string, boolean> = new Map();

export const loadFeatureFlags = async (): Promise<FeatureFlag[]> => {
  if (!isCloudEnabled()) return [];
  try {
    const { data, error } = await getSupabase().from(TABLES.FEATURE_FLAGS).select('*').order('created_at');
    if (error) { console.warn('Failed to load feature flags:', error.message); return []; }
    const flags = (data as FeatureFlag[]) || [];
    flagCache = new Map(flags.map(f => [f.id, f.enabled]));
    return flags;
  } catch (e) {
    console.warn('Failed to load feature flags:', e);
    return [];
  }
};

export const isFeatureEnabled = (flagId: string): boolean => {
  return flagCache.get(flagId) ?? false;
};

export const toggleFeatureFlag = async (
  flagId: string,
  enabled: boolean,
  updatedBy: string
): Promise<void> => {
  try {
    const { error } = await getSupabase()
      .from(TABLES.FEATURE_FLAGS)
      .update({ enabled, updated_by: updatedBy, updated_at: new Date().toISOString() })
      .eq('id', flagId);
    if (error) throw error;
    // Update cache ONLY after DB success
    flagCache.set(flagId, enabled);
  } catch (e) {
    console.error('Failed to toggle feature flag:', e);
    throw e;
  }
};
