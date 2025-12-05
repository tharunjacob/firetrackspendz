import { Transaction } from '../types';

export interface RecurringTransaction {
    name: string;
    avgAmount: number;
    frequency: number; // approx days between
    confidence: number;
    lastDate: string;
}

export interface Anomaly {
    transaction: Transaction;
    reason: string; // 'High Amount', 'Rare Category'
    deviation: number; // % above average
}

export interface FireMetrics {
    currentAnnualExpense: number;
    avgMonthlyExpense: number;
    personalInflation: number;
    yearsToFreedom: Record<number, number>; // Year -> Amount needed
    fireNumberCurrent: number; // Based on today's expense
    annualIncomeGrowth?: number;
    savingsRateTrend?: number; // positive = improving
}

export interface DeepInsight {
    title: string;
    value: string;
    description: string;
    trend: 'neutral' | 'good' | 'bad';
}

// --- HELPER: Personal Inflation ---
const calculatePersonalInflation = (data: Transaction[]): number => {
    const expenses = data.filter(t => t.type === 'Expense');
    const years = [...new Set(expenses.map(t => new Date(t.date).getFullYear()))].sort();
    
    if (years.length < 2) return 0.06; // Default to 6% if not enough history

    const lastYear = years[years.length - 2]; // Full previous year
    // We compare same period or full totals. Let's try full totals for simplicity of estimation
    const thisYear = years[years.length - 1]; 

    // To be accurate, we should compare monthly averages to account for partial years
    const getAvgMonthly = (year: number) => {
        const txns = expenses.filter(t => new Date(t.date).getFullYear() === year);
        const months = new Set(txns.map(t => new Date(t.date).getMonth())).size || 1;
        return txns.reduce((sum, t) => sum + t.amount, 0) / months;
    };

    const prevAvg = getAvgMonthly(lastYear);
    const currAvg = getAvgMonthly(thisYear);

    if (prevAvg === 0) return 0.06;

    const calculatedInflation = (currAvg - prevAvg) / prevAvg;
    
    // Safety Constraints:
    // 1. Cap at 100% (1.0) to prevent extreme outliers from breaking charts (previously stuck at 20%)
    // 2. Floor at 6% (0.06) as requested, ensuring conservative estimates
    const safeCalculated = Math.min(calculatedInflation, 1.0);
    return Math.max(safeCalculated, 0.06);
};

// --- HELPER: Income Growth ---
const calculateIncomeGrowth = (data: Transaction[]): number => {
    const income = data.filter(t => t.type === 'Income');
    const years = [...new Set(income.map(t => new Date(t.date).getFullYear()))].sort();
    
    if (years.length < 2) return 0;

    const lastYear = years[years.length - 2];
    const thisYear = years[years.length - 1];

    const getTotal = (year: number) => income.filter(t => new Date(t.date).getFullYear() === year).reduce((sum, t) => sum + t.amount, 0);
    
    const prevTotal = getTotal(lastYear);
    const currTotal = getTotal(thisYear); // Note: This might be partial year

    if (prevTotal === 0) return 0;
    
    // Simple CAGR-like growth check
    return (currTotal - prevTotal) / prevTotal;
};

// --- HELPER: Savings Rate Trend ---
const calculateSavingsTrend = (data: Transaction[]): number => {
    // Compare last 3 months savings rate vs previous 3 months
    // This is complex, returning 0 placeholder for now or simple implementation
    return 0;
};

// --- 1. FIRE CALCULATIONS ---
export const calculateFireMetrics = (data: Transaction[]): FireMetrics => {
    const expenses = data.filter(t => t.type === 'Expense');
    if (expenses.length === 0) return { currentAnnualExpense: 0, avgMonthlyExpense: 0, personalInflation: 0.06, yearsToFreedom: {}, fireNumberCurrent: 0 };

    // 1. Calculate Average Monthly Expense (Last 6 Months)
    const sorted = expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 6);
    
    const recentExpenses = sorted.filter(t => new Date(t.date) >= cutoffDate);
    const totalRecent = recentExpenses.reduce((sum, t) => sum + t.amount, 0);
    // Determine actual months present in data (could be less than 6)
    const distinctMonths = new Set(recentExpenses.map(t => t.date.substring(0, 7))).size || 1;
    
    const avgMonthly = totalRecent / distinctMonths;
    const currentAnnual = avgMonthly * 12;

    // 2. Inflation Logic
    const inflation = calculatePersonalInflation(data);

    // 3. FIRE Number (Current) -> "Monthly Expense X 12 X 25" (25x Rule / 4% Withdrawal)
    const fireNumberCurrent = currentAnnual * 25;

    // 4. Future Projections (1, 5, 7, 10, 15 years)
    const yearsToProject = [1, 5, 7, 10, 15];
    const projections: Record<number, number> = {};

    yearsToProject.forEach(year => {
        // Future Annual Expense = Current * (1 + inflation)^years
        const futureAnnual = currentAnnual * Math.pow(1 + inflation, year);
        // Required Corpus = Future Annual * 25
        projections[year] = futureAnnual * 25;
    });

    const annualIncomeGrowth = calculateIncomeGrowth(data);

    return {
        currentAnnualExpense: currentAnnual,
        avgMonthlyExpense: avgMonthly,
        personalInflation: inflation,
        yearsToFreedom: projections,
        fireNumberCurrent,
        annualIncomeGrowth,
        savingsRateTrend: 0
    };
};

// --- 2. DEEP INSIGHTS (The "Crazy" Boxes) ---
export const getDeepInsights = (data: Transaction[]): DeepInsight[] => {
    const expenses = data.filter(t => t.type === 'Expense');
    if (expenses.length < 10) return [];

    const insights: DeepInsight[] = [];

    // Insight 1: The "Weekend Warrior" (Spending on Sat/Sun vs Mon-Fri)
    let weekendSum = 0;
    let weekdaySum = 0;
    expenses.forEach(t => {
        const day = new Date(t.date).getDay();
        if (day === 0 || day === 6) weekendSum += t.amount;
        else weekdaySum += t.amount;
    });
    // Normalizing: Weekends are 2 days (2/7 = 28% of week), Weekdays are 5 days (72%)
    // If > 40% of spending happens on weekends, that's high.
    const total = weekendSum + weekdaySum;
    const weekendShare = total > 0 ? weekendSum / total : 0;
    
    if (weekendShare > 0.40) {
        insights.push({
            title: "Weekend Warrior",
            value: `${(weekendShare * 100).toFixed(0)}%`,
            description: "of your spending happens on weekends (Sat/Sun). You might be blowing the budget on days off.",
            trend: 'bad'
        });
    } else {
        insights.push({
            title: "Balanced Spender",
            value: "Stable",
            description: "Your spending is evenly distributed throughout the week, avoiding weekend binges.",
            trend: 'good'
        });
    }

    // Insight 2: The "Drip" (Most frequent small merchant < 200 units)
    // Counts frequency of small transactions
    const smallTxns = expenses.filter(t => t.amount < 500); // Assuming 500 is "small" in context of salaries, customizable
    const merchantCounts = new Map<string, number>();
    const merchantSums = new Map<string, number>();

    smallTxns.forEach(t => {
        // Simple normalization
        const name = t.notes || t.subCategory || t.category;
        const key = name.toLowerCase().replace(/[^a-z0-9]/g, '').trim().substring(0, 15);
        merchantCounts.set(key, (merchantCounts.get(key) || 0) + 1);
        merchantSums.set(key, (merchantSums.get(key) || 0) + t.amount);
    });

    let topMerchant = '';
    let maxCount = 0;
    merchantCounts.forEach((count, key) => {
        if (count > maxCount) {
            maxCount = count;
            topMerchant = key;
        }
    });

    if (maxCount > 5) {
        const totalLeak = merchantSums.get(topMerchant) || 0;
        // Prettify key
        const displayMerchant = topMerchant.charAt(0).toUpperCase() + topMerchant.slice(1);
        insights.push({
            title: "The Latte Factor",
            value: `${maxCount}x`,
            description: `You visited '${displayMerchant}' ${maxCount} times recently, spending a total of ${Math.round(totalLeak)}. Small drips sink ships!`,
            trend: 'neutral'
        });
    } else {
        insights.push({
            title: "Impulse Control",
            value: "High",
            description: "You rarely make repetitive small purchases at the same place.",
            trend: 'good'
        });
    }

    // Insight 3: Discretionary Ratio
    // Needs/Wants approximation. 
    // Wants: Entertainment, Shopping, Dining (Food is tricky, let's use Dining logic if category map exists, else Entertainment/Shopping)
    const wantsCategories = ['Entertainment', 'Shopping', 'Travel', 'Dining', 'Food']; // Food is often mixed, but let's assume dining out
    const wantsSum = expenses.filter(t => wantsCategories.includes(t.category)).reduce((sum, t) => sum + t.amount, 0);
    const wantsRatio = total > 0 ? wantsSum / total : 0;

    insights.push({
        title: "Lifestyle Ratio",
        value: `${(wantsRatio * 100).toFixed(0)}%`,
        description: `of your outflow goes to 'Wants' (Shopping, Entertainment, Food). The 50/30/20 rule suggests keeping this under 30%.`,
        trend: wantsRatio > 0.35 ? 'bad' : 'good'
    });

    return insights;
};

// --- 3. RECURRING BILL DETECTION (Improved for accuracy) ---
export const detectRecurring = (data: Transaction[]): RecurringTransaction[] => {
    // 1. FILTERING: Only Expenses.
    const expenses = data.filter(t => t.type === 'Expense');
    
    // 2. CONFIG: Categories that are usually "Habits" (Variable) vs "Subscriptions" (Fixed)
    // We will IGNORE these categories unless the description contains a "subscription keyword".
    const HABIT_CATEGORIES = new Set(['food', 'dining', 'groceries', 'shopping', 'transport', 'fuel', 'clothing', 'general']);
    
    // Keywords that force a check even if it's in a Habit Category (e.g. "Amazon Prime" in Shopping)
    const SUB_KEYWORDS = ['subscription', 'membership', 'premium', 'plan', 'bill', 'insurance', 'policy', 'fiber', 'internet', 'broadband', 'mobile', 'postpaid', 'electricity', 'water', 'gas', 'rent', 'maintenance', 'emi', 'loan', 'netflix', 'spotify', 'prime', 'hotstar', 'youtube', 'apple', 'icloud', 'drive'];

    const potentialRecurring = new Map<string, { date: Date, amount: number, originalName: string }[]>();
    
    expenses.forEach(t => {
        const descLower = (t.notes || t.subCategory || t.category).toLowerCase();
        const catLower = t.category.toLowerCase();
        
        // Skip habit categories unless they look like subscriptions
        if (HABIT_CATEGORIES.has(catLower)) {
            const hasKeyword = SUB_KEYWORDS.some(k => descLower.includes(k));
            if (!hasKeyword) return;
        }

        // Clean Name: "Netflix 123" -> "netflix"
        // We keep the original name to display nicely later
        const cleanKey = descLower
            .replace(/[0-9]/g, '') 
            .replace(/[^a-z\s]/g, ' ')
            .trim()
            .replace(/\s+/g, ' ');
            
        if (!cleanKey || cleanKey.length < 3) return;
        
        if (!potentialRecurring.has(cleanKey)) potentialRecurring.set(cleanKey, []);
        potentialRecurring.get(cleanKey)!.push({ 
            date: new Date(t.date), 
            amount: t.amount,
            originalName: t.notes || t.category
        });
    });

    const results: RecurringTransaction[] = [];

    potentialRecurring.forEach((entries, key) => {
        // REQUIREMENT: Must have at least 3 occurrences to be a "Commitment", OR 2 if they are identical amounts.
        if (entries.length < 2) return;

        // Sort by date ascending
        entries.sort((a, b) => a.date.getTime() - b.date.getTime());
        
        // Calc intervals
        const intervals = [];
        for (let i = 1; i < entries.length; i++) {
            const diffTime = Math.abs(entries[i].date.getTime() - entries[i - 1].date.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            if (diffDays > 0) intervals.push(diffDays); 
        }

        if (intervals.length === 0) return;

        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        
        // Variance (Time)
        const mean = avgInterval;
        const variance = intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length;
        const stdDevDays = Math.sqrt(variance);

        // FREQUENCY BUCKETS (Strict)
        // Weekly: ~7 days | Bi-Weekly: ~14 days | Monthly: ~28-31 days | Quarterly: ~90 days | Yearly: ~365 days
        const isWeekly = Math.abs(avgInterval - 7) < 2;
        const isBiWeekly = Math.abs(avgInterval - 14) < 3;
        const isMonthly = Math.abs(avgInterval - 30.5) < 4; 
        const isQuarterly = Math.abs(avgInterval - 91) < 5;
        const isYearly = Math.abs(avgInterval - 365) < 10;

        if (!isWeekly && !isBiWeekly && !isMonthly && !isQuarterly && !isYearly) return;

        // AMOUNT CONSISTENCY CHECK
        // Subscriptions usually have identical amounts. Utilities vary slightly.
        const amounts = entries.map(e => e.amount);
        const avgAmt = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const amtVariance = amounts.reduce((a, b) => a + Math.pow(b - avgAmt, 2), 0) / amounts.length;
        const amtStdDev = Math.sqrt(amtVariance);
        const amtVariationPercent = (amtStdDev / avgAmt);

        // Rules:
        // 1. If it's a "Subscription" (Netflix), amount variation should be near zero (< 5%).
        // 2. If it's a "Utility" (Electric), amount variation can be higher (< 50%).
        // 3. Time consistency must always be high (stdDevDays < 5 for monthly/weekly).

        const isUtilityKeywords = ['bill', 'electricity', 'water', 'gas', 'mobile', 'postpaid'].some(k => key.includes(k));
        
        const strictAmountLimit = isUtilityKeywords ? 0.5 : 0.05; // 50% var for utilities, 5% for others

        // STRICT FILTER:
        if (stdDevDays < 5 && amtVariationPercent <= strictAmountLimit) {
            
            // Final Sanity Check: If count is only 2, ensure strictly identical amounts or strictly monthly
            if (entries.length === 2) {
                if (amtVariationPercent > 0.01 && !isUtilityKeywords) return; // Must be identical amount if only 2 data points
            }

            // Capitalize Name
            const words = key.split(' ');
            const name = words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

            results.push({
                name: name,
                avgAmount: Math.round(avgAmt),
                frequency: Math.round(avgInterval),
                confidence: 100 - (stdDevDays * 5) - (amtVariationPercent * 100),
                lastDate: entries[entries.length - 1].date.toISOString().split('T')[0]
            });
        }
    });

    return results.sort((a, b) => b.avgAmount - a.avgAmount);
};