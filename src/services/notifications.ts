import type { Transaction, ProactiveInsight, Budget } from '@/types';
import { detectRecurring, detectAnomalies, getMonthlyBreakdown } from './analysis';

// ============================================================
// Smart Notification Engine
// Generates proactive alerts, bill reminders, budget warnings
// ============================================================

export const generateNotifications = (
  transactions: Transaction[],
  budgets: Budget[] = [],
): ProactiveInsight[] => {
  const insights: ProactiveInsight[] = [];
  const expenses = transactions.filter(t => t.type === 'Expense');
  if (expenses.length < 5) return insights;

  // --- 1. Bill Due Reminders ---
  const recurring = detectRecurring(transactions);
  const today = new Date();

  recurring.forEach(r => {
    const lastDate = new Date(r.lastDate);
    const nextDue = new Date(lastDate.getTime() + r.frequency * 86400000);
    const daysUntilDue = Math.ceil((nextDue.getTime() - today.getTime()) / 86400000);

    if (daysUntilDue >= 0 && daysUntilDue <= 5) {
      insights.push({
        id: `bill-due-${r.name}`,
        type: 'warning',
        title: `${r.name} due ${daysUntilDue === 0 ? 'today' : `in ${daysUntilDue} day${daysUntilDue > 1 ? 's' : ''}`}`,
        message: `Expected amount: ~${r.avgAmount.toLocaleString()}. Based on your payment pattern of every ~${r.frequency} days.`,
        severity: daysUntilDue <= 1 ? 'high' : 'medium',
        category: 'bills',
      });
    } else if (daysUntilDue < 0 && daysUntilDue >= -3) {
      insights.push({
        id: `bill-overdue-${r.name}`,
        type: 'warning',
        title: `${r.name} may be overdue`,
        message: `Expected ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) > 1 ? 's' : ''} ago. Avg amount: ~${r.avgAmount.toLocaleString()}.`,
        severity: 'high',
        category: 'bills',
      });
    }
  });

  // --- 2. Budget Warnings ---
  const currentMonth = today.toISOString().substring(0, 7);
  const currentMonthExpenses = expenses.filter(t => t.date.startsWith(currentMonth));

  budgets.filter(b => b.is_active).forEach(b => {
    const catTotal = currentMonthExpenses.filter(t => t.category === b.category).reduce((s, t) => s + t.amount, 0);
    const pct = b.monthly_limit > 0 ? (catTotal / b.monthly_limit) * 100 : 0;

    if (pct >= 100) {
      insights.push({
        id: `budget-exceeded-${b.category}`,
        type: 'warning',
        title: `${b.category} budget exceeded!`,
        message: `You've spent ${catTotal.toLocaleString()} of your ${b.monthly_limit.toLocaleString()} limit (${pct.toFixed(0)}%).`,
        severity: 'high',
        category: b.category,
      });
    } else if (pct >= 80) {
      insights.push({
        id: `budget-warning-${b.category}`,
        type: 'warning',
        title: `${b.category} budget at ${pct.toFixed(0)}%`,
        message: `${(b.monthly_limit - catTotal).toLocaleString()} remaining for the month.`,
        severity: 'medium',
        category: b.category,
      });
    }
  });

  // --- 3. Spending Spike Detection ---
  const monthly = getMonthlyBreakdown(transactions);
  if (monthly.length >= 3) {
    const last3Avg = monthly.slice(-3).reduce((s, m) => s + m.expense, 0) / 3;
    const currentMonthTotal = currentMonthExpenses.reduce((s, t) => s + t.amount, 0);
    const dayOfMonth = today.getDate();
    const projected = dayOfMonth > 0 ? (currentMonthTotal / dayOfMonth) * 30 : 0;

    if (projected > last3Avg * 1.3 && dayOfMonth >= 10) {
      insights.push({
        id: 'spending-spike',
        type: 'warning',
        title: 'Spending pace above average',
        message: `At current pace, you'll spend ~${Math.round(projected).toLocaleString()} this month — ${Math.round(((projected / last3Avg) - 1) * 100)}% above your 3-month average.`,
        severity: 'medium',
      });
    }
  }

  // --- 4. Anomaly Alerts ---
  const anomalies = detectAnomalies(transactions);
  const recentAnomalies = anomalies.filter(a => {
    const txDate = new Date(a.transaction.date);
    return (today.getTime() - txDate.getTime()) < 7 * 86400000;
  });

  recentAnomalies.slice(0, 3).forEach(a => {
    insights.push({
      id: `anomaly-${a.transaction.id}`,
      type: 'anomaly',
      title: `Unusual: ${a.transaction.notes || a.transaction.category}`,
      message: `${a.transaction.amount.toLocaleString()} on ${a.transaction.date} — ${a.deviation > 0 ? a.deviation + '% above category average' : a.reason}.`,
      severity: a.deviation > 200 ? 'high' : 'medium',
      category: a.transaction.category,
    });
  });

  // --- 5. Positive Achievements ---
  if (monthly.length >= 2) {
    const lastMonth = monthly[monthly.length - 1];
    const prevMonth = monthly[monthly.length - 2];

    if (lastMonth.savings > prevMonth.savings && lastMonth.savings > 0) {
      insights.push({
        id: 'savings-improved',
        type: 'achievement',
        title: 'Savings improved!',
        message: `You saved ${lastMonth.savings.toLocaleString()} last month — ${Math.round(((lastMonth.savings / Math.max(prevMonth.savings, 1)) - 1) * 100)}% more than the previous month.`,
        severity: 'low',
      });
    }

    if (lastMonth.expense < prevMonth.expense) {
      const pctDown = Math.round(((prevMonth.expense - lastMonth.expense) / prevMonth.expense) * 100);
      if (pctDown >= 10) {
        insights.push({
          id: 'spending-down',
          type: 'achievement',
          title: `Spending down ${pctDown}%`,
          message: `Great discipline! Your expenses dropped from ${prevMonth.expense.toLocaleString()} to ${lastMonth.expense.toLocaleString()}.`,
          severity: 'low',
        });
      }
    }
  }

  // --- 6. Subscription Cost Awareness ---
  const totalRecurring = recurring.reduce((s, r) => s + (r.avgAmount * (30 / r.frequency)), 0);
  if (totalRecurring > 0) {
    insights.push({
      id: 'subscription-total',
      type: 'tip',
      title: `~${Math.round(totalRecurring).toLocaleString()}/month in recurring costs`,
      message: `That's ${Math.round(totalRecurring * 12).toLocaleString()}/year across ${recurring.length} detected subscriptions and bills.`,
      severity: 'low',
    });
  }

  return insights.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
};
