// Supabase Edge Function — send-welcome-email
// Triggered by a Supabase Database Webhook on public.user_profiles INSERT.
// Calls Resend's REST API to send the email; never blocks signup on failure.

import { buildEmailPayload, type EmailTemplate } from "./templates.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WebhookRecord {
  id: string;
  email: string | null;
  full_name: string | null;
  [key: string]: unknown;
}

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: WebhookRecord | null;
  old_record: WebhookRecord | null;
}

interface SendEmailOptions {
  to: string;
  template: EmailTemplate;
  data: Record<string, unknown>;
}

// ─── Resend caller ────────────────────────────────────────────────────────────

async function sendEmail(opts: SendEmailOptions): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) throw new Error("RESEND_API_KEY secret is not set");

  const payload = buildEmailPayload(opts.template, opts.to, opts.data);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: payload.from,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body}`);
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Optional shared-secret check — set WEBHOOK_SECRET in Edge Function secrets
  // and in the Supabase webhook "HTTP headers" as: Authorization: Bearer <secret>
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
  if (webhookSecret) {
    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${webhookSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json() as WebhookPayload;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  // Only act on INSERT events (webhook may also fire on UPDATE/DELETE if misconfigured)
  if (payload.type !== "INSERT" || !payload.record) {
    return json({ skipped: true });
  }

  const { email, full_name } = payload.record;
  if (!email) {
    console.warn("[send-welcome-email] No email on record — skipping");
    return json({ skipped: true, reason: "no_email" });
  }

  const firstName = full_name?.split(" ")[0]?.trim() || "there";

  try {
    await sendEmail({ to: email, template: "welcome", data: { name: firstName } });
    console.log(`[send-welcome-email] Sent to ${email}`);
    return json({ success: true });
  } catch (err) {
    // Log but return 200 — a failed email must never block signup
    console.error("[send-welcome-email] Failed:", err);
    return json({ success: false, error: String(err) });
  }
});

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
