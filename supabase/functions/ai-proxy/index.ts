import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') ?? '';

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      console.error('[ai-proxy] Error: SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY is missing in Deno environment.');
      return new Response(JSON.stringify({ error: 'Supabase URL/Key config is missing in Edge Function environment.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!geminiApiKey) {
      console.error('[ai-proxy] Error: GEMINI_API_KEY secret is not set in this Supabase project.');
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY secret is not set in the Supabase project. Please set it using Supabase dashboard or CLI.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Authenticate the caller — must be a valid Supabase session
    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.warn('[ai-proxy] Auth verification failed:', authError?.message ?? 'No user returned');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize service client to query profile and write usage logs bypassing RLS
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    // Fetch user profile (subscription tier and admin status)
    const { data: profile, error: profileError } = await serviceClient
      .from('user_profiles')
      .select('subscription_plan, is_admin')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('[ai-proxy] Error fetching user profile:', profileError?.message);
      return new Response(JSON.stringify({ error: 'Failed to verify user profile.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { subscription_plan, is_admin } = profile;

    // Enforcement: check daily/lifetime usage limits (Admins bypass all limits)
    if (!is_admin) {
      // 1. Fetch lifetime usage count
      const { count: lifetimeCount, error: lifetimeError } = await serviceClient
        .from('ai_usage_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (lifetimeError) {
        console.error('[ai-proxy] Error checking lifetime logs:', lifetimeError.message);
        return new Response(JSON.stringify({ error: 'Database error checking usage logs.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (subscription_plan === 'free') {
        if (lifetimeCount && lifetimeCount >= 5) {
          return new Response(JSON.stringify({ error: 'You have reached your limit of 5 lifetime trial prompts. Upgrade to Pro for unlimited access.' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else {
        // 2. Pro/Enterprise: check daily limit (Pro = 50, Enterprise = 150)
        const dailyLimit = subscription_plan === 'enterprise' ? 150 : 50;
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const { count: dailyCount, error: dailyError } = await serviceClient
          .from('ai_usage_logs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('timestamp', oneDayAgo);

        if (dailyError) {
          console.error('[ai-proxy] Error checking daily logs:', dailyError.message);
          return new Response(JSON.stringify({ error: 'Database error checking daily usage logs.' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (dailyCount && dailyCount >= dailyLimit) {
          return new Response(JSON.stringify({ error: `You have reached your daily limit of ${dailyLimit} prompts. Please try again tomorrow.` }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // Log the request to the usage log
    const { error: logError } = await serviceClient
      .from('ai_usage_logs')
      .insert({ user_id: user.id });

    if (logError) {
      console.warn('[ai-proxy] Failed to log AI request (proceeding anyway):', logError.message);
    }

    // Parse the request from the client
    const { action, payload } = await req.json() as { action: string; payload: any };
    console.log(`[ai-proxy] action=${action} user=${user.email} plan=${subscription_plan} admin=${is_admin} jsonMode=${!!payload.jsonMode}`);

    // Route to the correct Gemini endpoint
    // gemini-2.5-flash has thinking enabled by default which causes 75-94s response
    // times and exceeds the client-side 120s abort timeout.
    // thinkingBudget:0 disables thinking entirely, dropping latency to ~5-10s.
    const model = 'gemini-2.5-flash';
    const endpoint = `${GEMINI_BASE}/models/${model}:generateContent?key=${geminiApiKey}`;

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
