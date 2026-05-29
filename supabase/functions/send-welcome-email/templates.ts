export type EmailTemplate = "welcome" | "feedback_received" | "weekly_summary";

export interface EmailPayload {
  to: string;
  from: string;
  subject: string;
  html: string;
}

interface TemplateData {
  name?: string;
  [key: string]: unknown;
}

const BRAND = "#4f46e5";
const FROM = "Tharun from TrackSpendZ <hello@trackspendz.com>";
const DASHBOARD = "https://trackspendz.com/dashboard";

export function buildEmailPayload(
  template: EmailTemplate,
  to: string,
  data: TemplateData,
): EmailPayload {
  switch (template) {
    case "welcome":
      return welcome(to, data);
    case "feedback_received":
      return feedbackReceived(to, data);
    case "weekly_summary":
      return weeklySummary(to, data);
  }
}

// ─── Shared layout wrapper ────────────────────────────────────────────────────

function layout(headerTitle: string, bodyHtml: string): string {
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
          <td style="background:${BRAND};padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;letter-spacing:-.5px;">${headerTitle}</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,.8);font-size:14px;">Your personal finance co-pilot</p>
          </td>
        </tr>

        <!-- body -->
        ${bodyHtml}

        <!-- footer -->
        <tr>
          <td style="padding:20px 40px 32px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;text-align:center;">
              TrackSpendZ · Personal finance, simplified<br>
              <a href="${DASHBOARD}/settings?tab=notifications" style="color:#9ca3af;">Unsubscribe</a> from these emails
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function step(num: number, title: string, desc: string): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f7ff;border-radius:8px;padding:16px;margin-bottom:12px;">
      <tr>
        <td width="36" style="vertical-align:top;">
          <div style="width:28px;height:28px;background:${BRAND};border-radius:50%;text-align:center;line-height:28px;color:#fff;font-size:13px;font-weight:700;">${num}</div>
        </td>
        <td style="vertical-align:top;padding-left:12px;">
          <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">${title}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">${desc}</p>
        </td>
      </tr>
    </table>`;
}

function ctaButton(label: string, url: string): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:8px 0 32px;">
          <a href="${url}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;">${label}</a>
        </td>
      </tr>
    </table>`;
}

// ─── Templates ───────────────────────────────────────────────────────────────

function welcome(to: string, data: TemplateData): EmailPayload {
  const name = data.name || "there";
  const body = `
    <tr>
      <td style="padding:40px 40px 24px;">
        <p style="margin:0 0 20px;font-size:17px;color:#111827;line-height:1.6;">Hey ${name} 👋</p>
        <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.7;">
          Welcome aboard! You now have a personal finance dashboard that actually makes sense of your money.
          Here's how to get the most out of it in the next 5 minutes:
        </p>

        ${step(1, "Upload a bank statement", "Works with CSV, Excel, and PDF exports from any bank.")}
        ${step(2, "See your spending breakdown", "150+ merchant patterns auto-categorize your transactions instantly.")}
        ${step(3, "Set savings goals", "Track progress toward your FIRE number, emergency fund, or any target.")}

        ${ctaButton("Go to my dashboard →", DASHBOARD)}

        <p style="margin:0 0 8px;font-size:14px;color:#374151;line-height:1.7;">
          Have a question or hit a snag? Reply to this email anytime — I read every message.
        </p>
        <p style="margin:0;font-size:14px;color:#374151;">— Tharun</p>
      </td>
    </tr>`;

  return {
    to,
    from: FROM,
    subject: "Welcome to TrackSpendZ — here's how to get started",
    html: layout("TrackSpendZ", body),
  };
}

function feedbackReceived(to: string, data: TemplateData): EmailPayload {
  const name = data.name || "there";
  const body = `
    <tr>
      <td style="padding:40px;">
        <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">Hey ${name},</p>
        <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">
          Thanks for taking the time to share your feedback — I genuinely read every submission
          and use it to shape what gets built next.
        </p>
        <p style="margin:0;font-size:15px;color:#374151;">— Tharun</p>
      </td>
    </tr>`;

  return {
    to,
    from: FROM,
    subject: "Thanks for your feedback on TrackSpendZ",
    html: layout("TrackSpendZ", body),
  };
}

function weeklySummary(to: string, data: TemplateData): EmailPayload {
  const name = data.name || "there";
  const body = `
    <tr>
      <td style="padding:40px;">
        <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">Hey ${name},</p>
        <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.7;">
          Here's your weekly spending snapshot. Log in to see the full breakdown.
        </p>
        ${ctaButton("View full dashboard →", DASHBOARD)}
      </td>
    </tr>`;

  return {
    to,
    from: FROM,
    subject: "Your weekly spending summary — TrackSpendZ",
    html: layout("TrackSpendZ", body),
  };
}
