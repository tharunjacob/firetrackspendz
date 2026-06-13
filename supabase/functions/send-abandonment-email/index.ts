import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const authHeader = req.headers.get("Authorization");

  let isAuthorized = false;

  // 1. Check if service role key is used (e.g. pg_cron or CLI deployment)
  if (serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`) {
    isAuthorized = true;
  } else if (authHeader) {
    // 2. Check if the user is an admin using their own JWT token
    try {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      });
      const { data: isAdmin, error: rpcError } = await userClient.rpc("is_admin");
      if (!rpcError && isAdmin === true) {
        isAuthorized = true;
      }
    } catch (e) {
      console.error("[send-abandonment-email] Admin auth check failed:", e);
    }
  }

  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY secret is not set" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Parse target user ID if provided (to support manual trigger from Admin panel)
  let targetUserId: string | null = null;
  try {
    if (req.method === "POST") {
      const body = await req.json();
      if (body && body.user_id) {
        targetUserId = body.user_id;
      }
    }
  } catch {
    // No JSON body or empty body, run standard cron
  }

  try {
    let pendingUsers = [];

    if (targetUserId) {
      // 1a. Manual trigger: find specific user profile (bypass time checks to send immediately)
      const { data, error: queryError } = await supabase
        .from("user_profiles")
        .select("id, email, full_name, updated_at, subscription_status")
        .eq("id", targetUserId);

      if (queryError) {
        console.error(`[send-abandonment-email] DB Query Error for user ${targetUserId}:`, queryError);
        throw queryError;
      }
      pendingUsers = data || [];
    } else {
      // 1b. Cron trigger: find users with subscription_status = 'pending' who started checkout > 1 hour ago
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data, error: queryError } = await supabase
        .from("user_profiles")
        .select("id, email, full_name, updated_at")
        .eq("subscription_status", "pending")
        .lt("updated_at", oneHourAgo);

      if (queryError) {
        console.error("[send-abandonment-email] DB Query Error:", queryError);
        throw queryError;
      }
      pendingUsers = data || [];
    }

    console.log(`[send-abandonment-email] Found ${pendingUsers.length} checkouts to process.`);

    const results = [];

    if (pendingUsers.length > 0) {
      for (const user of pendingUsers) {
        if (!user.email) {
          console.warn(`[send-abandonment-email] User ${user.id} has no email. Updating status to abandoned...`);
          await supabase
            .from("user_profiles")
            .update({ subscription_status: "abandoned" })
            .eq("id", user.id);
          results.push({ id: user.id, status: "skipped_no_email" });
          continue;
        }

        const name = user.full_name?.split(" ")[0]?.trim() || "there";
        const emailHtml = buildCheckoutRecoveryEmail(name);

        try {
          // 2. Send email via Resend
          console.log(`[send-abandonment-email] Sending recovery email to ${user.email}...`);
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Tharun from TrackSpendZ <hello@trackspendz.com>",
              to: [user.email],
              subject: "Complete your TrackSpendZ Pro upgrade",
              html: emailHtml,
            }),
          });

          if (!res.ok) {
            const body = await res.text();
            throw new Error(`Resend API error: ${res.status} - ${body}`);
          }

          // 3. Update status to 'abandoned'
          const { error: updateError } = await supabase
            .from("user_profiles")
            .update({ subscription_status: "abandoned" })
            .eq("id", user.id);

          if (updateError) {
            console.error(`[send-abandonment-email] Failed to update user status to abandoned:`, updateError);
            results.push({ id: user.id, email: user.email, status: "email_sent_db_update_failed", error: updateError.message });
          } else {
            console.log(`[send-abandonment-email] Successfully recovered and updated status to abandoned for ${user.email}`);
            results.push({ id: user.id, email: user.email, status: "recovered" });
          }
        } catch (emailErr) {
          console.error(`[send-abandonment-email] Failed to process recovery for ${user.email}:`, emailErr);
          results.push({ id: user.id, email: user.email, status: "failed", error: String(emailErr) });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, processed: pendingUsers.length, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-abandonment-email] Critical function error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildCheckoutRecoveryEmail(name: string): string {
  const brandColor = "#4f46e5";
  const dashboardUrl = "https://trackspendz.com/dashboard";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.08);overflow:hidden;">

        <!-- header -->
        <tr>
          <td style="background:${brandColor};padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;letter-spacing:-.5px;">TrackSpendZ Pro</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,.8);font-size:14px;">Complete your upgrade</p>
          </td>
        </tr>

        <!-- body -->
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#374151;">Hi ${name},</p>
            <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#374151;">
              We noticed that you started upgrading to <strong>TrackSpendZ Pro</strong> but didn't quite finish the checkout process. 
            </p>
            <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#374151;">
              If you got interrupted or experienced issues with payment, no worries! You can resume and finish upgrading anytime by clicking the button below:
            </p>

            <!-- button -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td align="center">
                  <a href="${dashboardUrl}" style="display:inline-block;background:${brandColor};color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;">Resume Upgrade</a>
                </td>
              </tr>
            </table>

            <hr style="border:0;border-top:1px solid #e5e7eb;margin-bottom:24px;" />

            <h3 style="margin:0 0 12px;font-size:16px;font-weight:600;color:#111827;">What you get with TrackSpendZ Pro:</h3>
            <ul style="margin:0 0 24px;padding-left:20px;font-size:15px;line-height:1.6;color:#4b5563;">
              <li style="margin-bottom:8px;"><strong>Advanced Categorization Rules:</strong> Define customized rules with multiple targets and match criteria.</li>
              <li style="margin-bottom:8px;"><strong>File Upload Statistics:</strong> Track your imports across PDF, Excel, and CSV file types.</li>
              <li style="margin-bottom:8px;"><strong>Premium Financial Insights:</strong> Unlock deeper analysis and budget settings.</li>
            </ul>

            <p style="margin:0;font-size:15px;line-height:1.6;color:#6b7280;font-style:italic;">
              Have questions or need help? Just reply to this email directly—we are here to support you!
            </p>
          </td>
        </tr>

        <!-- footer -->
        <tr>
          <td style="padding:20px 40px 32px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;text-align:center;">
              TrackSpendZ · Personal finance, simplified<br>
              <a href="${dashboardUrl}/settings?tab=notifications" style="color:#9ca3af;">Unsubscribe</a> from these emails
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
