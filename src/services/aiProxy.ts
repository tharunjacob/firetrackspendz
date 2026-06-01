import { getSupabase, isCloudEnabled } from './supabase';

const cleanSupabaseUrl = import.meta.env.VITE_SUPABASE_URL
  ? import.meta.env.VITE_SUPABASE_URL.replace(/\/+$/, '')
  : null;

const SUPABASE_FUNCTIONS_URL = cleanSupabaseUrl
  ? `${cleanSupabaseUrl}/functions/v1/ai-proxy`
  : null;

// Dev fallback — only used when there is no Supabase URL configured (local dev without Supabase)
// No global VITE_GEMINI_API_KEY assignment to avoid compiling it in the production bundle.

export type GeminiContents = {
  role: 'user';
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;
}[];

export interface ProxyRequest {
  contents: GeminiContents;
  jsonMode?: boolean;
}

/**
 * Calls the AI proxy (Supabase Edge Function in prod, direct Gemini API in dev).
 * Returns the text from the first candidate, or throws on error.
 */
export const callAIProxy = async (payload: ProxyRequest): Promise<string> => {
  // Production path: call the edge function
  if (SUPABASE_FUNCTIONS_URL && isCloudEnabled()) {
    try {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('AI features require a free account. Sign in or create an account to continue.');
      }
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
      };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 s max — matches Supabase Edge Function wall-time limit

      let res: Response;
      try {
        res = await fetch(SUPABASE_FUNCTIONS_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify({ action: 'generate', payload }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? `AI proxy error ${res.status}`);
      }

      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    } catch (e: any) {
      // Convert AbortError (timeout) into a user-friendly message
      if (e?.name === 'AbortError') {
        throw new Error('PDF parsing timed out — please try again. If it keeps failing, convert your PDF to CSV first.');
      }
      console.warn('[aiProxy] Edge function call failed, no dev fallback in production:', e);
      throw e;
    }
  }

  // Dev fallback: call Gemini directly (only compiled in DEV mode)
  if (import.meta.env.DEV) {
    const devKey = import.meta.env.VITE_GEMINI_API_KEY || '';
    if (!devKey) {
      throw new Error('AI unavailable: no VITE_GEMINI_API_KEY set and no Supabase Edge Function configured.');
    }

    const model = 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${devKey}`;
    const body: Record<string, unknown> = { contents: payload.contents };
    if (payload.jsonMode) body.generationConfig = { responseMimeType: 'application/json' };

    const devController = new AbortController();
    const devTimeoutId = setTimeout(() => devController.abort(), 120000); // 120 s max
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: devController.signal,
      });
    } finally {
      clearTimeout(devTimeoutId);
    }
    if (!res.ok) throw new Error(`Gemini API error ${res.status}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  throw new Error('AI features are currently unavailable in production. Please try again later.');
};

export const isAIProxyAvailable = (): boolean => {
  if (import.meta.env.DEV) {
    return !!(SUPABASE_FUNCTIONS_URL || import.meta.env.VITE_GEMINI_API_KEY);
  }
  return !!SUPABASE_FUNCTIONS_URL;
};
