import type { Transaction, WrappedStats } from '@/types';

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function computeWrappedStats(transactions: Transaction[], year: number): WrappedStats {
  const yearTxns = transactions.filter(t => t.date.startsWith(String(year)));

  const income = yearTxns.filter(t => t.type === 'Income');
  const expenses = yearTxns.filter(t => t.type === 'Expense');

  const totalIncome = income.reduce((s, t) => s + t.amount, 0);
  const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0);
  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

  const categoryTotals: Record<string, number> = {};
  expenses.forEach(t => {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
  });
  const sortedCats = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const topCat = sortedCats[0];
  const topCategory = topCat
    ? { name: topCat[0], amount: topCat[1], pct: totalExpenses > 0 ? (topCat[1] / totalExpenses) * 100 : 0 }
    : { name: 'N/A', amount: 0, pct: 0 };

  const sortedExpenses = [...expenses].sort((a, b) => b.amount - a.amount);
  const biggest = sortedExpenses[0];
  const biggestExpense = biggest
    ? { notes: biggest.notes || biggest.original_description || 'Unknown', amount: biggest.amount, date: biggest.date }
    : { notes: 'N/A', amount: 0, date: '' };

  const monthlyData: { income: number; expense: number }[] = Array.from({ length: 12 }, () => ({ income: 0, expense: 0 }));
  yearTxns.forEach(t => {
    const m = parseInt(t.date.substring(5, 7), 10) - 1;
    if (m >= 0 && m < 12) {
      if (t.type === 'Income') monthlyData[m].income += t.amount;
      else if (t.type === 'Expense') monthlyData[m].expense += t.amount;
    }
  });

  const monthlySavingsRates = monthlyData.map((d, i) => ({
    month: MONTH_LABELS[i],
    rate: d.income > 0 ? ((d.income - d.expense) / d.income) * 100 : 0,
  }));

  const monthlySavings = monthlyData.map((d, i) => ({
    month: MONTH_LABELS[i],
    savings: d.income - d.expense,
  }));

  const activeMonths = monthlySavings.filter((_, i) => monthlyData[i].income > 0 || monthlyData[i].expense > 0);
  const best = activeMonths.length > 0
    ? activeMonths.reduce((a, b) => a.savings >= b.savings ? a : b)
    : { month: 'N/A', savings: 0 };
  const worst = activeMonths.length > 0
    ? activeMonths.reduce((a, b) => a.savings <= b.savings ? a : b)
    : { month: 'N/A', savings: 0 };

  const recurringTotal = yearTxns
    .filter(t => t.is_recurring && t.type === 'Expense')
    .reduce((s, t) => s + t.amount, 0);

  const merchants = new Set(yearTxns.map(t => t.merchant_name).filter(Boolean));

  return {
    year,
    totalIncome,
    totalExpenses,
    netSavings,
    savingsRate,
    topCategory,
    biggestExpense,
    bestMonth: best,
    worstMonth: worst,
    recurringTotal,
    fireProgress: { start: 0, end: 0, changePercent: 0 },
    totalTransactions: yearTxns.length,
    uniqueMerchants: merchants.size,
    monthlySavingsRates,
  };
}
