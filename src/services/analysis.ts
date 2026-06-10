import type { Transaction, FireMetrics, RecurringTransaction, Anomaly, DeepInsight, Currency } from '@/types';

// ============================================================
// Analysis Engine - FIRE, Insights, Recurring, Anomalies
// ============================================================

// --- FIRE corpus multiple policy (single source of truth) ---
// The "X× annual expenses" target used to compute the FIRE number. This is the
// ONE place the policy lives: the dashboard FIRE views read it via
// `fire/shared.tsx` (which re-exports this), and the AI summary below reads it
// directly — so the FIRE number shown on the dashboard and the one fed to the AI
// always agree. (Previously the AI summary hardcoded its own `INR ? 33 : 25`,
// which could silently drift from the dashboard.)
//
// India uses 33× (≈3% safe-withdrawal rate — lower historical real returns /
// higher inflation); everything else uses the classic 25× (4% SWR).
export const DEFAULT_FIRE_MULTIPLIER = 25;
export const FIRE_MULTIPLIER: Record<Currency, number> = {
  INR: 33, USD: 25, EUR: 25, GBP: 25, AUD: 25, CAD: 25, SGD: 25, AED: 25,
};

// --- Personal Inflation Rate ---
// Algorithm:
//   1. Build a month-by-month spending map per year.
//   2. Determine the reference month set from the latest year (handles partial current year).
//   3. For each year, average spending over only those same reference months (apples-to-apples).
//   4. Compute CAGR across all qualified years rather than a single year-over-year jump.
//   5. Allow negative values — spending CAN go down. Fallback to 0.06 only when data is insufficient.
export const calculatePersonalInflation = (data: Transaction[]): number => {
  const expenses = data.filter(t => t.type === 'Expense');
  if (expenses.length === 0) return 0.06;

  const currentYear = new Date().getFullYear();

  // Build year → month → total-spending map
  const yearMonthTotals = new Map<number, Map<number, number>>();
  for (const t of expenses) {
    const d = new Date(t.date);
    const yr = d.getFullYear();
    const mo = d.getMonth();
    if (!yearMonthTotals.has(yr)) yearMonthTotals.set(yr, new Map());
    const moMap = yearMonthTotals.get(yr)!;
    moMap.set(mo, (moMap.get(mo) ?? 0) + t.amount);
  }

  // Qualify years: current year needs ≥3 months; historical years need ≥6 months
  const qualifiedYears = [...yearMonthTotals.keys()]
    .filter(yr => {
      const monthCount = yearMonthTotals.get(yr)!.size;
      return yr === currentYear ? monthCount >= 3 : monthCount >= 6;
    })
    .sort((a, b) => a - b);

  if (qualifiedYears.length < 2) return 0.06;

  // Use the latest year's months as the reference set for all comparisons
  // so a partial current year doesn't inflate/deflate the rate vs. prior full years
  const latestYear = qualifiedYears[qualifiedYears.length - 1];
  const refMonths = [...yearMonthTotals.get(latestYear)!.keys()].sort();

  const avgForRefMonths = (yr: number): number | null => {
    const moMap = yearMonthTotals.get(yr);
    if (!moMap) return null;
    const overlap = refMonths.filter(m => moMap.has(m));
    if (overlap.length < 3) return null; // need at least 3 matching months
    return overlap.reduce((s, m) => s + moMap.get(m)!, 0) / overlap.length;
  };

  const yearlyAvgs: Array<[number, number]> = [];
  for (const yr of qualifiedYears) {
    const avg = avgForRefMonths(yr);
    if (avg !== null && avg > 0) yearlyAvgs.push([yr, avg]);
  }

  if (yearlyAvgs.length < 2) return 0.06;

  // CAGR: (lastAvg / firstAvg)^(1/numYears) - 1
  const [firstYear, firstAvg] = yearlyAvgs[0];
  const [lastYear2, lastAvg] = yearlyAvgs[yearlyAvgs.length - 1];
  const numYears = lastYear2 - firstYear;
  if (numYears === 0 || firstAvg === 0) return 0.06;

  const cagr = Math.pow(lastAvg / firstAvg, 1 / numYears) - 1;
  return Math.max(Math.min(cagr, 0.5), -0.15); // clamp to -15% … +50%
};

// --- Income Growth ---
const calculateIncomeGrowth = (data: Transaction[]): number => {
  const income = data.filter(t => t.type === 'Income');
  const years = [...new Set(income.map(t => new Date(t.date).getFullYear()))].sort();
  if (years.length < 2) return 0;

  const getTotal = (year: number) => income.filter(t => new Date(t.date).getFullYear() === year).reduce((s, t) => s + t.amount, 0);
  const prev = getTotal(years[years.length - 2]);
  const curr = getTotal(years[years.length - 1]);
  return prev === 0 ? 0 : (curr - prev) / prev;
};

/**
 * Core FIRE math. Uses the last 6 months of expenses as the baseline (so ancient history
 * doesn't skew current spending) and projects the "25× annual expenses" FIRE number
 * forward by the user's personal inflation rate. Also computes savings rate and runway.
 * Returns zeros when there are no expenses yet.
 */
export const calculateFireMetrics = (data: Transaction[], multiplier = DEFAULT_FIRE_MULTIPLIER): FireMetrics => {
  const expenses = data.filter(t => t.type === 'Expense');
  const incomes = data.filter(t => t.type === 'Income');
  if (expenses.length === 0) {
    return { currentAnnualExpense: 0, avgMonthlyExpense: 0, personalInflation: 0.06, yearsToFreedom: {}, fireNumberCurrent: 0 };
  }

  const sorted = [...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 6);
  const recent = sorted.filter(t => new Date(t.date) >= cutoff);
  const totalRecent = recent.reduce((s, t) => s + t.amount, 0);
  const months = new Set(recent.map(t => t.date.substring(0, 7))).size || 1;
  const avgMonthly = totalRecent / months;
  const currentAnnual = avgMonthly * 12;
  const inflation = calculatePersonalInflation(data);
  const fireNumberCurrent = currentAnnual * multiplier;

  const yearsToProject = [1, 3, 5, 7, 10, 15, 20];
  const projections: Record<number, number> = {};
  yearsToProject.forEach(yr => {
    projections[yr] = currentAnnual * Math.pow(1 + inflation, yr) * multiplier;
  });

  // Savings rate
  const totalIncome = incomes.reduce((s, t) => s + t.amount, 0);
  const totalExpense = expenses.reduce((s, t) => s + t.amount, 0);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;

  // Months of runway
  const monthsOfRunway = avgMonthly > 0 ? Math.round((totalIncome - totalExpense) / avgMonthly) : 0;

  return {
    currentAnnualExpense: currentAnnual,
    avgMonthlyExpense: avgMonthly,
    personalInflation: inflation,
    yearsToFreedom: projections,
    fireNumberCurrent,
    annualIncomeGrowth: calculateIncomeGrowth(data),
    savingsRate: Math.max(0, savingsRate),
    monthsOfRunway: Math.max(0, monthsOfRunway),
  };
};

/**
 * Generates 3–4 rule-based insight cards (Weekend Warrior, Latte Factor, Lifestyle Ratio,
 * Top Expense). Requires ≥10 expenses; returns [] otherwise so sparse data isn't judged.
 */
export const getDeepInsights = (data: Transaction[]): DeepInsight[] => {
  const expenses = data.filter(t => t.type === 'Expense');
  if (expenses.length < 10) return [];
  const insights: DeepInsight[] = [];
  const total = expenses.reduce((s, t) => s + t.amount, 0);

  // Weekend Warrior
  let weekendSum = 0, weekdaySum = 0;
  expenses.forEach(t => {
    const day = new Date(t.date).getDay();
    (day === 0 || day === 6) ? (weekendSum += t.amount) : (weekdaySum += t.amount);
  });
  const weekendShare = total > 0 ? weekendSum / total : 0;
  insights.push(weekendShare > 0.40
    ? { title: 'Weekend Warrior', value: `${(weekendShare * 100).toFixed(0)}%`, description: 'of spending happens on weekends. You might be blowing the budget on days off.', trend: 'bad' }
    : { title: 'Balanced Spender', value: 'Stable', description: 'Spending is evenly distributed throughout the week.', trend: 'good' }
  );

  // Latte Factor
  const smallTxns = expenses.filter(t => t.amount < 500);
  const merchantCounts = new Map<string, number>();
  const merchantSums = new Map<string, number>();
  smallTxns.forEach(t => {
    const key = (t.notes || t.subCategory || t.category).toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15);
    merchantCounts.set(key, (merchantCounts.get(key) || 0) + 1);
    merchantSums.set(key, (merchantSums.get(key) || 0) + t.amount);
  });
  let topMerchant = '', maxCount = 0;
  merchantCounts.forEach((count, key) => { if (count > maxCount) { maxCount = count; topMerchant = key; } });
  if (maxCount > 5) {
    insights.push({
      title: 'The Latte Factor', value: `${maxCount}x`,
      description: `You visited '${topMerchant}' ${maxCount} times, spending ${Math.round(merchantSums.get(topMerchant) || 0)} total. Small drips sink ships!`,
      trend: 'neutral',
    });
  }

  // Lifestyle Ratio
  const wantsCategories = ['Entertainment', 'Shopping', 'Travel', 'Food'];
  const wantsSum = expenses.filter(t => wantsCategories.includes(t.category)).reduce((s, t) => s + t.amount, 0);
  const wantsRatio = total > 0 ? wantsSum / total : 0;
  insights.push({
    title: 'Lifestyle Ratio', value: `${(wantsRatio * 100).toFixed(0)}%`,
    description: `goes to 'Wants' (Shopping, Entertainment, Food). The 50/30/20 rule suggests keeping this under 30%.`,
    trend: wantsRatio > 0.35 ? 'bad' : 'good',
  });

  // Top Category
  const catTotals = new Map<string, number>();
  expenses.forEach(t => catTotals.set(t.category, (catTotals.get(t.category) || 0) + t.amount));
  const topCat = [...catTotals.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topCat) {
    const pct = total > 0 ? (topCat[1] / total * 100).toFixed(0) : '0';
    insights.push({
      title: 'Top Expense', value: topCat[0],
      description: `${topCat[0]} accounts for ${pct}% of your total spending.`,
      trend: parseInt(pct) > 40 ? 'bad' : 'neutral',
    });
  }

  return insights;
};

/**
 * Two-pass recurring commitment detection:
 *
 * Pass 1 — Category-level obligations (Rent, EMI, Insurance, Utilities, Education, Gym).
 *   Groups all monthly spend totals per commitment category and checks month-to-month
 *   consistency via coefficient of variation. Catches obligations regardless of how the
 *   bank describes each transaction (NEFT/IMPS/NACH all cluster under the same category).
 *
 * Pass 2 — Individual subscriptions & merchants.
 *   For "Subscriptions" category: groups by subCategory (Netflix, Spotify, …) so each
 *   service shows individually. For other non-habit categories: groups by cleaned
 *   description, checks consistent interval + low amount variance.
 */
export const detectRecurring = (data: Transaction[]): RecurringTransaction[] => {
  const expenses = data.filter(t => t.type === 'Expense');
  if (expenses.length === 0) return [];

  // Find the latest transaction date in the entire dataset to calculate relative recency
  const latestTxDateStr = data.reduce((max, t) => t.date > max ? t.date : max, '');
  const latestTxDate = latestTxDateStr ? new Date(latestTxDateStr) : new Date();

  // ── PASS 1: category-level commitment detection ───────────────────────────
  // Priority-ordered so the first keyword match wins (e.g. "Home Loan" → EMI, not Housing).
  const COMMITMENT_CATS: Array<{ keywords: string[]; label: string; cvLimit: number }> = [
    { keywords: ['emi', 'loan', 'mortgage'],              label: 'EMI / Loans',           cvLimit: 0.05 },
    { keywords: ['rent', 'housing'],                      label: 'Rent / Housing',        cvLimit: 0.08 },
    { keywords: ['insurance'],                            label: 'Insurance',             cvLimit: 0.20 },
    { keywords: ['electricity'],                          label: 'Electricity',           cvLimit: 0.45 },
    { keywords: ['water'],                                label: 'Water / Gas',           cvLimit: 0.45 },
    { keywords: ['internet', 'broadband', 'wifi'],        label: 'Internet',              cvLimit: 0.10 },
    { keywords: ['phone', 'mobile', 'telecom', 'recharge'], label: 'Phone Bill',          cvLimit: 0.20 },
    { keywords: ['utilities'],                            label: 'Utilities',             cvLimit: 0.45 },
    { keywords: ['education', 'school', 'college', 'tuition'], label: 'Education / Fees', cvLimit: 0.12 },
    { keywords: ['gym', 'fitness', 'yoga', 'pilates'],    label: 'Gym / Fitness',         cvLimit: 0.10 },
    { keywords: ['maintenance'],                          label: 'Maintenance',           cvLimit: 0.35 },
  ];

  // Returns the first matching commitment config for a category string, or null.
  const matchCommitment = (catLower: string) =>
    COMMITMENT_CATS.find(c => c.keywords.some(k => catLower.includes(k))) ?? null;

  // category label → { config, year-month → total, lastDate }
  const commitmentMap = new Map<string, {
    cvLimit: number;
    monthlyTotals: Map<string, number>;
    lastDate: string;
  }>();

  expenses.forEach(t => {
    const match = matchCommitment(t.category.toLowerCase());
    if (!match) return;

    if (!commitmentMap.has(match.label)) {
      commitmentMap.set(match.label, { cvLimit: match.cvLimit, monthlyTotals: new Map(), lastDate: '' });
    }
    const entry = commitmentMap.get(match.label)!;
    const ym = t.date.substring(0, 7); // "YYYY-MM"
    entry.monthlyTotals.set(ym, (entry.monthlyTotals.get(ym) ?? 0) + t.amount);
    if (t.date > entry.lastDate) entry.lastDate = t.date;
  });

  const results: RecurringTransaction[] = [];

  commitmentMap.forEach((entry, label) => {
    const months = [...entry.monthlyTotals.values()];
    if (months.length < 2) return;

    const avg = months.reduce((a, b) => a + b, 0) / months.length;
    const stdDev = Math.sqrt(months.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / months.length);
    const cv = stdDev / avg;

    if (cv > entry.cvLimit) return;

    // Recency filter: For category-level monthly commitments, the last charge date
    // must be within the last 45 days of the latest transaction in the dataset.
    const lastCharge = new Date(entry.lastDate);
    const diffDays = (latestTxDate.getTime() - lastCharge.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 45) return;

    results.push({
      name: label,
      avgAmount: Math.round(avg),
      frequency: 30,
      confidence: Math.max(30, Math.round(100 - cv * 250)),
      lastDate: entry.lastDate,
    });
  });

  // ── PASS 2: individual subscription & merchant detection ──────────────────
  // Skip categories already captured in Pass 1, and skip noisy habit categories.
  const SKIP_CATS = new Set(['food', 'dining', 'groceries', 'shopping', 'transport', 'fuel', 'general', 'transfers', 'unknown', 'uncategorized']);
  const SUB_KEYWORDS = ['subscription', 'membership', 'premium', 'plan', 'streaming', 'netflix', 'spotify', 'prime', 'youtube', 'apple', 'icloud', 'disney', 'hotstar', 'zee5', 'sonyliv', 'jiocinema', 'crunchyroll', 'audible'];

  // Tracks category labels already covered in Pass 1 so we don't double-count.
  const pass1Labels = new Set(results.map(r => r.name.toLowerCase()));

  const potentialRecurring = new Map<string, { date: Date; amount: number; displayName: string }[]>();

  expenses.forEach(t => {
    const catLower = t.category.toLowerCase();

    // Skip if category is a Pass 1 commitment type
    if (matchCommitment(catLower)) return;
    // Skip noisy variable-spend categories unless the description has subscription signals
    const descLower = (t.original_description || t.notes || t.subCategory || '').toLowerCase();
    const isSubscription = catLower.includes('subscription') || catLower.includes('streaming')
      || SUB_KEYWORDS.some(k => descLower.includes(k) || catLower.includes(k));
    if (!isSubscription && SKIP_CATS.has(catLower.split(/[\s&\/]/)[0])) return;

    // Group key: for subscriptions prefer subCategory so each service shows individually;
    // otherwise use the cleaned description/notes.
    let groupKey: string;
    let displayName: string;

    if (isSubscription && t.subCategory && t.subCategory.trim().length > 2) {
      groupKey = t.subCategory.toLowerCase().trim();
      displayName = t.subCategory.trim();
    } else if (isSubscription && t.merchant_name && t.merchant_name.trim().length > 2) {
      groupKey = t.merchant_name.toLowerCase().trim();
      displayName = t.merchant_name.trim();
    } else {
      const raw = (t.notes || t.original_description || t.subCategory || t.category);
      const cleaned = raw.toLowerCase().replace(/[0-9]/g, '').replace(/[^a-z\s]/g, ' ').trim().replace(/\s+/g, ' ');
      if (!cleaned || cleaned.length < 3) return;
      groupKey = cleaned;
      displayName = raw;
    }

    if (!potentialRecurring.has(groupKey)) potentialRecurring.set(groupKey, []);
    potentialRecurring.get(groupKey)!.push({ date: new Date(t.date), amount: t.amount, displayName });
  });

  potentialRecurring.forEach((entries) => {
    if (entries.length < 2) return;
    entries.sort((a, b) => a.date.getTime() - b.date.getTime());

    const intervals: number[] = [];
    for (let i = 1; i < entries.length; i++) {
      const diff = Math.ceil(Math.abs(entries[i].date.getTime() - entries[i - 1].date.getTime()) / (1000 * 60 * 60 * 24));
      if (diff > 0) intervals.push(diff);
    }
    if (!intervals.length) return;

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const stdDevDays = Math.sqrt(intervals.reduce((a, b) => a + Math.pow(b - avgInterval, 2), 0) / intervals.length);

    const isMonthly = Math.abs(avgInterval - 30.5) < 5;
    const isWeekly = Math.abs(avgInterval - 7) < 2;
    const isQuarterly = Math.abs(avgInterval - 91) < 8;
    const isYearly = Math.abs(avgInterval - 365) < 15;
    if (!isMonthly && !isWeekly && !isQuarterly && !isYearly) return;
    if (stdDevDays >= 8) return;

    // Filter out false positives (e.g. weekly hotel stays or random monthly purchases)
    // by requiring more occurrences for shorter cycles unless it is a subscription.
    const hasSubSignal = entries.some(e => {
      const name = e.displayName.toLowerCase();
      return name.includes('subscription') || name.includes('streaming') ||
        ['netflix', 'spotify', 'prime', 'youtube', 'apple', 'icloud', 'disney', 'hotstar', 'zee5', 'sonyliv', 'jiocinema', 'crunchyroll', 'audible', 'premium', 'membership', 'plan'].some(k => name.includes(k));
    });
    const minOccurrences = hasSubSignal ? 2 : (isWeekly ? 4 : (isMonthly ? 3 : 2));
    if (entries.length < minOccurrences) return;

    const amounts = entries.map(e => e.amount);
    const avgAmt = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const amtStdDev = Math.sqrt(amounts.reduce((a, b) => a + Math.pow(b - avgAmt, 2), 0) / amounts.length);
    const amtVariation = amtStdDev / avgAmt;
    if (amtVariation > 0.15) return;

    const rawName = entries[entries.length - 1].displayName;
    const prettified = rawName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    // Avoid duplicating something already captured at category level
    if (pass1Labels.has(prettified.toLowerCase())) return;

    const lastCharge = entries[entries.length - 1].date;
    const diffDays = (latestTxDate.getTime() - lastCharge.getTime()) / (1000 * 60 * 60 * 24);
    const frequency = Math.round(avgInterval);

    // Recency filter: last charge should be within 1.5 cycles of the latest date
    // in the dataset, with a minimum buffer of 30 days.
    const limit = Math.max(30, frequency * 1.5);
    if (diffDays > limit) return;

    results.push({
      name: prettified,
      avgAmount: Math.round(avgAmt),
      frequency,
      confidence: Math.max(0, 100 - stdDevDays * 4 - amtVariation * 150),
      lastDate: entries[entries.length - 1].date.toISOString().split('T')[0],
    });
  });

  return results.sort((a, b) => b.avgAmount - a.avgAmount);
};

/**
 * Flags unusually large or rare-category transactions. High-amount = 3× category avg
 * AND 2× overall avg. Rare = category has ≤2 transactions but amount exceeds overall avg.
 * Requires ≥20 expenses to avoid noise on small datasets.
 */
export const detectAnomalies = (data: Transaction[]): Anomaly[] => {
  const expenses = data.filter(t => t.type === 'Expense');
  if (expenses.length < 20) return [];

  const catAvg = new Map<string, { total: number; count: number }>();
  expenses.forEach(t => {
    const entry = catAvg.get(t.category) || { total: 0, count: 0 };
    entry.total += t.amount;
    entry.count++;
    catAvg.set(t.category, entry);
  });

  const anomalies: Anomaly[] = [];
  const overallAvg = expenses.reduce((s, t) => s + t.amount, 0) / expenses.length;

  expenses.forEach(t => {
    const entry = catAvg.get(t.category);
    if (!entry) return;
    const avg = entry.total / entry.count;

    // High amount anomaly: 3x category average or 5x overall average
    if (t.amount > avg * 3 && t.amount > overallAvg * 2) {
      anomalies.push({
        transaction: t,
        reason: 'High Amount',
        deviation: Math.round(((t.amount - avg) / avg) * 100),
      });
    }

    // Rare category: < 3 transactions
    if (entry.count <= 2 && t.amount > overallAvg) {
      anomalies.push({ transaction: t, reason: 'Rare Category', deviation: 0 });
    }
  });

  return anomalies.sort((a, b) => b.deviation - a.deviation).slice(0, 20);
};

export interface CategoryMonthlyEstimate {
  category: string;
  avgMonthly: number;
  recentAvg: number;
  trend: 'up' | 'down' | 'stable';
  monthsOfData: number;
  totalSpent: number;
}

/**
 * For each expense category, compute average monthly spend across distinct months of data,
 * plus the last-3-months average and a trend vs. the overall average (±10% threshold).
 * Categories with fewer than 2 months of data are excluded (not enough signal).
 */
export const estimateMonthlyByCategory = (transactions: Transaction[]): CategoryMonthlyEstimate[] => {
  const expenses = transactions.filter(t => t.type === 'Expense');
  const byCat = new Map<string, Map<string, number>>();

  expenses.forEach(t => {
    const month = t.date.substring(0, 7);
    if (!month) return;
    const cat = t.category || 'Uncategorized';
    let monthMap = byCat.get(cat);
    if (!monthMap) {
      monthMap = new Map();
      byCat.set(cat, monthMap);
    }
    monthMap.set(month, (monthMap.get(month) || 0) + t.amount);
  });

  const result: CategoryMonthlyEstimate[] = [];
  byCat.forEach((monthMap, category) => {
    const months = [...monthMap.keys()].sort();
    if (months.length < 2) return;

    let total = 0;
    months.forEach(m => { total += monthMap.get(m) || 0; });
    const avgMonthly = total / months.length;

    const recentMonths = months.slice(-3);
    const recentTotal = recentMonths.reduce((s, m) => s + (monthMap.get(m) || 0), 0);
    const recentAvg = recentTotal / recentMonths.length;

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (avgMonthly > 0) {
      const diff = (recentAvg - avgMonthly) / avgMonthly;
      if (diff > 0.1) trend = 'up';
      else if (diff < -0.1) trend = 'down';
    }

    result.push({
      category,
      avgMonthly: Math.round(avgMonthly),
      recentAvg: Math.round(recentAvg),
      trend,
      monthsOfData: months.length,
      totalSpent: Math.round(total),
    });
  });

  return result.sort((a, b) => b.avgMonthly - a.avgMonthly);
};

/** Aggregates transactions into per-month income/expense/savings rows, sorted asc. Transfers excluded. */
export const getMonthlyBreakdown = (data: Transaction[]): { month: string; income: number; expense: number; savings: number }[] => {
  const monthMap = new Map<string, { income: number; expense: number }>();

  data.forEach(t => {
    if (t.type === 'Transfer') return;
    const month = t.date.substring(0, 7); // YYYY-MM
    const entry = monthMap.get(month) || { income: 0, expense: 0 };
    if (t.type === 'Income') entry.income += t.amount;
    else entry.expense += t.amount;
    monthMap.set(month, entry);
  });

  return [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      income: Math.round(data.income),
      expense: Math.round(data.expense),
      savings: Math.round(data.income - data.expense),
    }));
};

export interface MonthlySavingsRate {
  month: string;
  income: number;
  expense: number;
  savings: number;
  rate: number;
  rawRate: number;
}

/** Computes savings rates per month, clamping visually between -50% and 100% for charts. */
export const getMonthlySavingsRates = (monthlyBreakdown: { month: string; income: number; expense: number; savings: number }[]): MonthlySavingsRate[] => {
  return monthlyBreakdown.map(m => {
    const rawRate = m.income > 0 ? ((m.income - m.expense) / m.income) * 100 : 0;
    return {
      ...m,
      rate: Math.max(-50, Math.min(100, rawRate)),
      rawRate,
    };
  });
};

/** Sums amounts per category for a given transaction type, sorted by value desc. */
export const getCategoryBreakdown = (data: Transaction[], type: 'Expense' | 'Income' = 'Expense'): { name: string; value: number; percentage: number }[] => {
  const filtered = data.filter(t => t.type === type);
  const total = filtered.reduce((s, t) => s + t.amount, 0);
  const catMap = new Map<string, number>();

  filtered.forEach(t => catMap.set(t.category, (catMap.get(t.category) || 0) + t.amount));

  return [...catMap.entries()]
    .map(([name, value]) => ({ name, value: Math.round(value), percentage: total > 0 ? (value / total) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);
};

/** Per-year income/expense/savings rows, sorted asc. Transfers excluded. */
export const getYearlyBreakdown = (data: Transaction[]): { year: number; income: number; expense: number; savings: number }[] => {
  const yearMap = new Map<number, { income: number; expense: number }>();

  data.forEach(t => {
    if (t.type === 'Transfer') return;
    const year = new Date(t.date).getFullYear();
    const entry = yearMap.get(year) || { income: 0, expense: 0 };
    if (t.type === 'Income') entry.income += t.amount;
    else entry.expense += t.amount;
    yearMap.set(year, entry);
  });

  return [...yearMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, data]) => ({
      year,
      income: Math.round(data.income),
      expense: Math.round(data.expense),
      savings: Math.round(data.income - data.expense),
    }));
};

/**
 * Builds a compact plain-text summary of the user's finances, suitable for feeding
 * to an LLM as context. Includes totals, top categories, FIRE metrics, recurring
 * bills, and top anomalies — small enough to fit comfortably in a prompt.
 */
export const generateSummaryText = (data: Transaction[], currency: string): string => {
  const expenses = data.filter(t => t.type === 'Expense');
  const incomes = data.filter(t => t.type === 'Income');
  const totalExpense = expenses.reduce((s, t) => s + t.amount, 0);
  const totalIncome = incomes.reduce((s, t) => s + t.amount, 0);

  const catBreakdown = getCategoryBreakdown(data);
  const topCats = catBreakdown.slice(0, 5).map(c => `${c.name}: ${currency}${c.value} (${c.percentage.toFixed(1)}%)`).join(', ');

  // Same multiplier policy the dashboard uses, so the AI's FIRE number matches.
  const multiplier = FIRE_MULTIPLIER[currency as Currency] ?? DEFAULT_FIRE_MULTIPLIER;
  const fire = calculateFireMetrics(data, multiplier);
  const recurring = detectRecurring(data);
  const anomalies = detectAnomalies(data);

  return `
Currency: ${currency}
Total Income: ${totalIncome.toFixed(0)} | Total Expenses: ${totalExpense.toFixed(0)} | Net Savings: ${(totalIncome - totalExpense).toFixed(0)}
Savings Rate: ${fire.savingsRate?.toFixed(1)}%
Monthly Average Expense: ${fire.avgMonthlyExpense.toFixed(0)}
Personal Inflation Rate: ${(fire.personalInflation * 100).toFixed(1)}%
FIRE Number (Current): ${fire.fireNumberCurrent.toFixed(0)}
Top Categories: ${topCats}
Recurring Bills: ${recurring.slice(0, 5).map(r => `${r.name} (${r.avgAmount}/~${r.frequency}d)`).join(', ')}
Anomalies: ${anomalies.slice(0, 3).map(a => `${a.transaction.notes || a.transaction.category}: ${a.transaction.amount} (${a.reason})`).join(', ')}
Transactions: ${data.length} total over ${new Set(data.map(t => t.date.substring(0, 7))).size} months
  `.trim();
};
