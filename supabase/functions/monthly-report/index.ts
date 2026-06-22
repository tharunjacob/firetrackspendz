// Supabase Edge Function — monthly-report
// Called by pg_cron on the 1st of every month at 8am UTC.
// Generates and emails a "Monthly Financial Report Card" for each opted-in user.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildReportEmail, EMAIL_FROM } from "./email-template.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RequestBody {
  user_id: string;
}

interface Transaction {
  id: string;
  user_id: string;
  date: string;
  amount: number;
  type: "Income" | "Expense" | "Transfer";
  category: string;
}

interface Budget {
  id: string;
  category: string;
  monthly_limit: number;
  is_active: boolean;
}

interface UserSetting {
  value: unknown;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function lastMonthRange(): { start: string; end: string; label: string } {
  const now = new Date();
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfPrevMonth = new Date(firstOfThisMonth.getTime() - 1);
  const firstOfPrevMonth = new Date(lastOfPrevMonth.getFullYear(), lastOfPrevMonth.getMonth(), 1);

  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const label = firstOfPrevMonth.toLocaleString("en-US", { month: "long", year: "numeric" });
  return { start: fmt(firstOfPrevMonth), end: fmt(lastOfPrevMonth), label };
}

// ─── Resend email sender ──────────────────────────────────────────────────────

async function sendViaResend(to: string, subject: string, html: string): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) throw new Error("RESEND_API_KEY secret is not set");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body}`);
  }
}

// ─── Core report processor ────────────────────────────────────────────────────

async function processUserReport(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ success: boolean; email?: string; error?: string }> {
  // 1. Fetch user email via admin API
  const { data: authData, error: authErr } = await supabase.auth.admin.getUserById(userId);
  if (authErr || !authData.user) {
    throw new Error(`Could not fetch auth user: ${authErr?.message}`);
  }
  const email = authData.user.email;
  if (!email) return { success: false, error: "no_email" };

  // 2. Fetch profile for name + currency preference
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name, preferred_currency")
    .eq("id", userId)
    .single();

  const firstName = profile?.full_name?.split(" ")[0]?.trim() || "there";
  const currency = (profile?.preferred_currency as string | undefined) || "USD";

  // 3. Fetch last month's transactions
  const { start, end, label: month } = lastMonthRange();
  const { data: txns, error: txnErr } = await supabase
    .from("transactions")
    .select("id, type, amount, category, date")
    .eq("user_id", userId)
    .gte("date", start)
    .lte("date", end);

  if (txnErr) throw new Error(`Transactions fetch failed: ${txnErr.message}`);

  const transactions: Transaction[] = (txns ?? []) as Transaction[];

  // 4. Compute metrics
  let totalIncome = 0;
  let totalExpenses = 0;
  const categoryTotals: Record<string, number> = {};

  for (const t of transactions) {
    if (t.type === "Income") {
      totalIncome += t.amount;
    } else if (t.type === "Expense") {
      totalExpenses += t.amount;
      categoryTotals[t.category] = (categoryTotals[t.category] ?? 0) + t.amount;
    }
  }

  const savingsRate = totalIncome > 0
    ? ((totalIncome - totalExpenses) / totalIncome) * 100
    : 0;

  const topCategories = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([name, amount]) => ({ name, amount }));

  // 5. Fetch budgets from user_settings
  const { data: settingRow } = await supabase
    .from("user_settings")
    .select("value")
    .eq("user_id", userId)
    .eq("key", "tsz_budgets")
    .single() as { data: UserSetting | null };

  let budgetsOnTrack = 0;
  let totalBudgets = 0;

  if (settingRow?.value) {
    const budgets = settingRow.value as Budget[];
    if (Array.isArray(budgets)) {
      const activeBudgets = budgets.filter((b) => b.is_active !== false);
      totalBudgets = activeBudgets.length;
      for (const budget of activeBudgets) {
        const spent = categoryTotals[budget.category] ?? 0;
        if (spent <= budget.monthly_limit) budgetsOnTrack++;
      }
    }
  }

  // 6. Build email
  const dashboardUrl = "https://trackspendz.com/dashboard";
  const unsubscribeUrl = `https://trackspendz.com/settings?unsubscribe=monthly_report&uid=${userId}`;

  const { subject, html } = buildReportEmail({
    firstName,
    month,
    savingsRate,
    totalIncome,
    totalExpenses,
    topCategories,
    budgetsOnTrack,
    totalBudgets,
    currency,
    dashboardUrl,
    unsubscribeUrl,
  });

  // 7. Send email
  await sendViaResend(email, subject, html);

  // 8. Log to app_logs
  await supabase.from("app_logs").insert({
    user_id: userId,
    event_type: "monthly_report_sent",
    metadata: { month, savingsRate, totalIncome, totalExpenses, budgetsOnTrack, totalBudgets },
    created_at: new Date().toISOString(),
  });

  console.log(`[monthly-report] Sent to ${email} for ${month}`);
  return { success: true, email };
}

// ─── Request handler ──────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Auth: accept the service role key as Bearer token.
  // Fail CLOSED: if the key is missing/unset, reject every request rather than
  // letting the `&&` short-circuit allow unauthenticated callers through.
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization");
  if (!serviceRoleKey || authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabase = createClient(supabaseUrl, serviceRoleKey ?? "", {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let body: RequestBody | RequestBody[];
  try {
    body = await req.json() as RequestBody | RequestBody[];
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  // Support both a single { user_id } and an array from pg_cron
  const userIds: string[] = Array.isArray(body)
    ? body.map((item) => item.user_id).filter(Boolean)
    : [body.user_id].filter(Boolean);

  if (userIds.length === 0) {
    return json({ error: "No user_ids provided" }, 400);
  }

  const results: Array<{ user_id: string; success: boolean; email?: string; error?: string }> = [];

  for (const userId of userIds) {
    try {
      const result = await processUserReport(supabase, userId);
      results.push({ user_id: userId, ...result });
    } catch (err) {
      console.error(`[monthly-report] Failed for ${userId}:`, err);
      results.push({ user_id: userId, success: false, error: String(err) });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  return json({ sent: successCount, total: userIds.length, results });
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
