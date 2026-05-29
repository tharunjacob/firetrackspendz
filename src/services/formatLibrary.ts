import { getSupabase, isCloudEnabled } from './supabase';
import { TABLES, RPC } from '@/config/database';
import type { FileMapping } from '@/types';
import { getFileSignature } from './learningRules';

// ============================================================
// Community Format Library — shared bank file column mappings
// ============================================================
//
// First user with an unknown format → AI detects → saved here as 'pending'
// Third user confirms it → auto-promoted to 'verified'
// Every subsequent user → instant match, no AI call needed
//
// Bank-agnostic: keyed by header signature, not bank name.
// ============================================================

// In-session cache to avoid repeated network calls for the same signature
const sessionCache = new Map<string, FileMapping | null>();

/**
 * Looks up a header signature in the shared format library.
 * Returns the mapping if a verified preset exists, null otherwise.
 * Uses an in-session cache so the same bank file never hits the network twice.
 */
export const getSharedMapping = async (headers: string[]): Promise<FileMapping | null> => {
  if (!isCloudEnabled()) return null;

  const sig = getFileSignature(headers);
  if (!sig) return null;

  // In-session cache hit
  if (sessionCache.has(sig)) return sessionCache.get(sig) ?? null;

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from(TABLES.FORMAT_PRESETS)
      .select('mapping')
      .eq('header_sig', sig)
      .eq('status', 'verified')
      .maybeSingle();

    if (error) {
      console.warn('[formatLibrary] lookup failed:', error.message);
      sessionCache.set(sig, null);
      return null;
    }

    const mapping = (data?.mapping as FileMapping) ?? null;
    sessionCache.set(sig, mapping);
    if (mapping) console.info('[formatLibrary] ✅ Community preset matched for signature:', sig.substring(0, 60) + '...');
    return mapping;
  } catch (e) {
    console.warn('[formatLibrary] lookup error:', e);
    return null;
  }
};

/**
 * Submits a new format mapping to the shared library as 'pending'.
 * Called after AI successfully detects a format for the first time.
 * Silent — never throws, never blocks the import flow.
 */
export const submitFormatPreset = async (
  headers: string[],
  mapping: FileMapping,
): Promise<void> => {
  if (!isCloudEnabled()) return;

  const sig = getFileSignature(headers);
  if (!sig) return;

  try {
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();

    await supabase.from(TABLES.FORMAT_PRESETS).upsert({
      header_sig: sig,
      sample_headers: headers,
      mapping,
      status: 'pending',
      created_by: session?.user?.id ?? null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'header_sig',
      ignoreDuplicates: true, // Don't overwrite verified presets with a new pending one
    });

    // Update session cache optimistically
    sessionCache.set(sig, mapping);
    console.info('[formatLibrary] Submitted new format preset for community review');
  } catch (e) {
    console.warn('[formatLibrary] Failed to submit preset:', e);
  }
};

/**
 * Increments successful_imports for a preset (called on confirmed import success).
 * When a pending preset reaches 3+ successes, it auto-promotes to 'verified'.
 * This is the community quality signal — popularity = correctness.
 */
export const confirmFormatSuccess = async (headers: string[]): Promise<void> => {
  if (!isCloudEnabled()) return;

  const sig = getFileSignature(headers);
  if (!sig) return;

  try {
    const supabase = getSupabase();
    await supabase.rpc(RPC.INCREMENT_FORMAT_SUCCESS, { p_sig: sig });
  } catch (e) {
    console.warn('[formatLibrary] Failed to confirm format success:', e);
  }
};

/**
 * Marks a format as failed (called when user reports incorrect import).
 * The admin can review and either fix the mapping or reject it.
 */
export const reportFormatFailure = async (headers: string[], correctedMapping?: FileMapping): Promise<void> => {
  if (!isCloudEnabled()) return;

  const sig = getFileSignature(headers);
  if (!sig) return;

  try {
    const supabase = getSupabase();
    if (correctedMapping) {
      // User provided a corrected mapping — save it and reset to pending for re-review
      await supabase
        .from(TABLES.FORMAT_PRESETS)
        .update({
          mapping: correctedMapping,
          status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('header_sig', sig);
    }

    await supabase.rpc(RPC.INCREMENT_FORMAT_FAILURE, { p_sig: sig });

    // Invalidate session cache so next import re-fetches
    sessionCache.delete(sig);
  } catch (e) {
    console.warn('[formatLibrary] Failed to report format failure:', e);
  }
};
