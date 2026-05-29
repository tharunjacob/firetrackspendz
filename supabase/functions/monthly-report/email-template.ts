// Email template builder for Monthly Financial Report Card

export interface ReportEmailData {
  firstName: string;
  month: string; // e.g. "May 2026"
  savingsRate: number; // percentage, can be negative
  totalIncome: number;
  totalExpenses: number;
  topCategories: Array<{ name: string; amount: number }>;
  budgetsOnTrack: number;
  totalBudgets: number;
  currency: string;
  dashboardUrl: string;
  unsubscribeUrl: string;
}

const BRAND = "#4f46e5";
const FROM = "Tharun from TrackSpendZ <hello@trackspendz.com>";

function grade(savingsRate: number): { letter: string; color: string; label: string } {
  if (savingsRate >= 30) return { letter: "A", color: "#16a34a", label: "Excellent saver" };
  if (savingsRate >= 20) return { letter: "B", color: "#2563eb", label: "Good progress" };
  if (savingsRate >= 10) return { letter: "C", color: "#d97706", label: "Room to improve" };
  if (savingsRate >= 0)  return { letter: "D", color: "#ea580c", label: "Barely breaking even" };
  return                        { letter: "F", color: "#dc2626", label: "Spending exceeded income" };
}

function fmt(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(0)}`;
  }
}

function categoryRows(cats: Array<{ name: string; amount: number }>, currency: string): string {
  if (cats.length === 0) {
    return `<tr><td colspan="2" style="padding:12px 0;color:#94a3b8;font-size:14px;">No expense data for this month.</td></tr>`;
  }
  return cats
    .map(
      (c, i) => `
    <tr style="border-bottom:1px solid #1e293b;">
      <td style="padding:10px 0;color:#e2e8f0;font-size:15px;">
        <span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;background:#1e293b;border-radius:50%;color:#94a3b8;font-size:12px;margin-right:8px;">${i + 1}</span>
        ${c.name}
      </td>
      <td style="padding:10px 0;text-align:right;color:#f1f5f9;font-weight:600;font-size:15px;">${fmt(c.amount, currency)}</td>
    </tr>`
    )
    .join("");
}

export function buildReportEmail(data: ReportEmailData): { subject: string; html: string } {
  const g = grade(data.savingsRate);
  const budgetLine =
    data.totalBudgets > 0
      ? `${data.budgetsOnTrack} of ${data.totalBudgets} budgets on track`
      : "No budgets configured yet";

  const subject = `Your ${data.month} Financial Report Card 📊`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0" role="presentation">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 100%);border-radius:16px 16px 0 0;padding:32px 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td>
                    <p style="margin:0 0 4px;font-size:12px;color:#a5b4fc;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">TrackSpendZ</p>
                    <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;line-height:1.2;">Your ${data.month}<br>Financial Report Card</h1>
                  </td>
                  <td align="right" valign="top">
                    <div style="width:64px;height:64px;background:${g.color};border-radius:50%;display:inline-flex;align-items:center;justify-content:center;text-align:center;line-height:64px;">
                      <span style="font-size:32px;font-weight:800;color:#ffffff;display:block;width:64px;height:64px;line-height:64px;">${g.letter}</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting + grade label -->
          <tr>
            <td style="background:#1e293b;padding:20px 32px 0;">
              <p style="margin:0;font-size:16px;color:#e2e8f0;">Hey ${data.firstName},</p>
              <p style="margin:8px 0 0;font-size:14px;color:#94a3b8;">Here's how your finances looked last month.</p>
              <div style="margin:16px 0 0;padding:12px 16px;background:#0f172a;border-left:4px solid ${g.color};border-radius:0 8px 8px 0;">
                <p style="margin:0;font-size:14px;font-weight:600;color:${g.color};">${g.label}</p>
                <p style="margin:4px 0 0;font-size:28px;font-weight:800;color:#ffffff;">${data.savingsRate.toFixed(1)}% savings rate</p>
              </div>
            </td>
          </tr>

          <!-- Income / Expenses row -->
          <tr>
            <td style="background:#1e293b;padding:20px 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td width="48%" style="background:#0f172a;border-radius:10px;padding:16px;text-align:center;">
                    <p style="margin:0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Income</p>
                    <p style="margin:6px 0 0;font-size:22px;font-weight:700;color:#4ade80;">${fmt(data.totalIncome, data.currency)}</p>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" style="background:#0f172a;border-radius:10px;padding:16px;text-align:center;">
                    <p style="margin:0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Expenses</p>
                    <p style="margin:6px 0 0;font-size:22px;font-weight:700;color:#f87171;">${fmt(data.totalExpenses, data.currency)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Top 3 categories -->
          <tr>
            <td style="background:#1e293b;padding:24px 32px 0;">
              <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Top Spending Categories</p>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                ${categoryRows(data.topCategories, data.currency)}
              </table>
            </td>
          </tr>

          <!-- Budget adherence -->
          <tr>
            <td style="background:#1e293b;padding:20px 32px 0;">
              <div style="background:#0f172a;border-radius:10px;padding:16px;display:flex;align-items:center;">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td>
                      <p style="margin:0;font-size:13px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Budget Adherence</p>
                      <p style="margin:6px 0 0;font-size:18px;font-weight:600;color:#e2e8f0;">${budgetLine}</p>
                    </td>
                    <td align="right">
                      <span style="font-size:28px;">${data.totalBudgets > 0 ? (data.budgetsOnTrack === data.totalBudgets ? "✅" : "⚠️") : "📋"}</span>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="background:#1e293b;padding:28px 32px;">
              <p style="margin:0 0 16px;font-size:15px;color:#cbd5e1;">Ready to keep the momentum going? Upload your latest statements to update your score.</p>
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="border-radius:10px;background:${BRAND};">
                    <a href="${data.dashboardUrl}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">Upload This Month's Statements →</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#0f172a;border-radius:0 0 16px 16px;padding:20px 32px;border-top:1px solid #1e293b;">
              <p style="margin:0;font-size:12px;color:#475569;line-height:1.6;">
                You're receiving this because you have a TrackSpendZ account with monthly report cards enabled.<br>
                <a href="${data.unsubscribeUrl}" style="color:#6366f1;text-decoration:underline;">Unsubscribe</a> · <a href="https://trackspendz.com/privacy" style="color:#6366f1;text-decoration:underline;">Privacy Policy</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

export { FROM as EMAIL_FROM };
