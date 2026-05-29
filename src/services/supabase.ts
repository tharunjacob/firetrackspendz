import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read from environment variables only - never hardcode
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabaseInstance: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true, // Handles OAuth redirects
    },
  });
} else {
  console.warn('Supabase credentials not configured. Cloud features disabled.');
}

export const supabase = supabaseInstance;

/** Safe accessor — throws a clear error if Supabase is not configured */
export const getSupabase = (): SupabaseClient => {
  if (!supabaseInstance) {
    throw new Error(
      'Supabase is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.'
    );
  }
  return supabaseInstance;
};

export const isCloudEnabled = (): boolean => !!supabaseInstance;
