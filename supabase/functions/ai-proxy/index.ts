import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Authenticate the caller — must be a valid Supabase session
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    );
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse the request from the client
    const { action, payload } = await req.json() as { action: string; payload: any };
    console.log(`[ai-proxy] action=${action} user=${user.email} jsonMode=${!!payload.jsonMode}`);

    // Route to the correct Gemini endpoint
    // gemini-2.5-flash has thinking enabled by default which causes 75-94s response
    // times and exceeds the client-side 120s abort timeout.
    // thinkingBudget:0 disables thinking entirely, dropping latency to ~5-10s.
    const model = 'gemini-2.5-flash';
    const endpoint = `${GEMINI_BASE}/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    // Always merge thinkingConfig with any other generationConfig options
    const generationConfig: Record<string, unknown> = {
      thinkingConfig: { thinkingBudget: 0 }, // disable thinking → fast responses
    };
    if (payload.jsonMode) {
      generationConfig.responseMimeType = 'application/json';
    }

    const geminiBody = {
      contents: payload.contents,
      generationConfig,
    };

    const startMs = Date.now();
    const geminiRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });
    const elapsed = Date.now() - startMs;

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      console.error(`[ai-proxy] Gemini error (${elapsed}ms):`, JSON.stringify(data).slice(0, 500));
      return new Response(JSON.stringify({ error: data.error?.message ?? 'Gemini API error' }), {
        status: geminiRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const outputLen = data.candidates?.[0]?.content?.parts?.[0]?.text?.length ?? 0;
    console.log(`[ai-proxy] OK (${elapsed}ms) outputChars=${outputLen}`);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[ai-proxy] Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
