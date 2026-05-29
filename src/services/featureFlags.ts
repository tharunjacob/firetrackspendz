import { getSupabase } from '@/services/supabase';
import { TABLES } from '@/config/database';
import type { FeatureFlag } from '@/types';

// ============================================================
// Feature Flags Service
// ============================================================

let flagCache: Map<string, boolean> = new Map();

export const loadFeatureFlags = async (): Promise<FeatureFlag[]> => {
  const { data } = await getSupabase().from(TABLES.FEATURE_FLAGS).select('*').order('created_at');
  const flags = (data as FeatureFlag[]) || [];
  flagCache = new Map(flags.map(f => [f.id, f.enabled]));
  return flags;
};

export const isFeatureEnabled = (flagId: string): boolean => {
  return flagCache.get(flagId) ?? false;
};

export const toggleFeatureFlag = async (
  flagId: string,
  enabled: boolean,
  updatedBy: string
): Promise<void> => {
  await getSupabase()
    .from(TABLES.FEATURE_FLAGS)
    .update({ enabled, updated_by: updatedBy, updated_at: new Date().toISOString() })
    .eq('id', flagId);
  flagCache.set(flagId, enabled);
};
