import { getSupabase, isCloudEnabled } from './supabase';

const SUPABASE_FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-proxy`
  : null;

// Dev fallback — only used when there is no Supabase URL configured (local dev without Supabase)
const DEV_GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

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
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
      };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      const res = await fetch(SUPABASE_FUNCTIONS_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'generate', payload }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? `AI proxy error ${res.status}`);
      }

      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    } catch (e) {
      console.warn('[aiProxy] Edge function call failed, no dev fallback in production:', e);
      throw e;
    }
  }

  // Dev fallback: call Gemini directly (only when no Supabase URL or in DEV mode)
  if (!DEV_GEMINI_API_KEY) {
    throw new Error('AI unavailable: no VITE_GEMINI_API_KEY set and no Supabase Edge Function configured.');
  }

  const model = 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${DEV_GEMINI_API_KEY}`;
  const body: Record<string, unknown> = { contents: payload.contents };
  if (payload.jsonMode) body.generationConfig = { responseMimeType: 'application/json' };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini API error ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
};

export const isAIProxyAvailable = (): boolean => {
  return !!(SUPABASE_FUNCTIONS_URL || DEV_GEMINI_API_KEY);
};
