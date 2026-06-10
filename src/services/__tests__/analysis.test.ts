import { describe, it, expect } from 'vitest';
import {
  calculateFireMetrics,
  getMonthlyBreakdown,
  getYearlyBreakdown,
  getCategoryBreakdown,
  detectRecurring,
  detectAnomalies,
  getMonthlySavingsRates,
} from '../analysis';
import type { Transaction } from '@/types';

// Helper — minimal Transaction factory.
const tx = (over: Partial<Transaction>): Transaction => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  owner: 'Me',
  type: 'Expense',
  date: '2026-01-01',
  time: null,
  amount: 100,
  category: 'Food',
  subCategory: '',
  project: null,
  notes: '',
  ...over,
});

// Build the first day of each of the last N months in YYYY-MM-DD
const lastMonths = (n: number) => {
  const arr: string[] = [];
  const base = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    arr.push(d.toISOString().slice(0, 10));
  }
  return arr;
};

describe('calculateFireMetrics', () => {
  it('returns zeros when there are no expenses', () => {
    const m = calculateFireMetrics([]);
    expect(m.currentAnnualExpense).toBe(0);
    expect(m.fireNumberCurrent).toBe(0);
  });

  it('computes a 25× FIRE number from last-6-months spending', () => {
    // $1000/mo over 6 consecutive months of the current window → $12k/yr → $300k FIRE
    const dates = lastMonths(6);
    const data: Transaction[] = dates.map((d, i) =>
      tx({ id: `e${i}`, date: d, amount: 1000, type: 'Expense', category: 'Food' }),
    );
    const m = calculateFireMetrics(data);
    expect(m.avgMonthlyExpense).toBe(1000);
    expect(m.currentAnnualExpense).toBe(12000);
    expect(m.fireNumberCurrent).toBe(300000);
  });

  it('computes savings rate from total income and expense', () => {
    // $20k income, $5k expense (in last 6 mo) → 75% savings rate
    const dates = lastMonths(6);
    const data: Transaction[] = [
      ...dates.map((d, i) =>
        tx({ id: `exp${i}`, date: d, amount: 833.33, type: 'Expense' }),
      ),
      tx({ id: 'inc1', date: dates[0], amount: 20000, type: 'Income' }),
    ];
    const m = calculateFireMetrics(data);
    expect(m.savingsRate).toBeGreaterThan(70);
    expect(m.savingsRate).toBeLessThan(80);
  });

  it('uses a default inflation of 6% when history is insufficient', () => {
    const dates = lastMonths(6);
    const data: Transaction[] = dates.map((d, i) =>
      tx({ id: `e${i}`, date: d, amount: 500, type: 'Expense' }),
    );
    // Single year of data → falls back to 6%
    expect(calculateFireMetrics(data).personalInflation).toBeCloseTo(0.06, 2);
  });
});

describe('getMonthlyBreakdown', () => {
  it('aggregates per YYYY-MM and excludes transfers', () => {
    const data: Transaction[] = [
      tx({ date: '2026-01-15', amount: 1000, type: 'Income' }),
      tx({ date: '2026-01-20', amount: 300, type: 'Expense' }),
      tx({ date: '2026-01-25', amount: 500, type: 'Transfer' }), // excluded
      tx({ date: '2026-02-10', amount: 1000, type: 'Income' }),
      tx({ date: '2026-02-12', amount: 400, type: 'Expense' }),
    ];
    const out = getMonthlyBreakdown(data);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ month: '2026-01', income: 1000, expense: 300, savings: 700 });
    expect(out[1]).toEqual({ month: '2026-02', income: 1000, expense: 400, savings: 600 });
  });

  it('returns rows sorted ascending by month', () => {
    const data: Transaction[] = [
      tx({ date: '2026-03-01', type: 'Expense', amount: 1 }),
      tx({ date: '2026-01-01', type: 'Expense', amount: 1 }),
      tx({ date: '2026-02-01', type: 'Expense', amount: 1 }),
    ];
    const out = getMonthlyBreakdown(data);
    expect(out.map(r => r.month)).toEqual(['2026-01', '2026-02', '2026-03']);
  });
});

describe('getYearlyBreakdown', () => {
  it('aggregates per year and rounds to whole currency units', () => {
    const data: Transaction[] = [
      tx({ date: '2025-01-01', type: 'Income', amount: 50000 }),
      tx({ date: '2025-06-01', type: 'Expense', amount: 30000 }),
      tx({ date: '2026-01-01', type: 'Income', amount: 60000 }),
      tx({ date: '2026-06-01', type: 'Expense', amount: 25000.49 }),
    ];
    const out = getYearlyBreakdown(data);
    expect(out).toEqual([
      { year: 2025, income: 50000, expense: 30000, savings: 20000 },
      { year: 2026, income: 60000, expense: 25000, savings: 35000 },
    ]);
  });
});

describe('getCategoryBreakdown', () => {
  it('sums by category and returns percentages', () => {
    const data: Transaction[] = [
      tx({ category: 'Food', amount: 200 }),
      tx({ category: 'Food', amount: 300 }),
      tx({ category: 'Transport', amount: 700 }),
    ];
    const out = getCategoryBreakdown(data, 'Expense');
    // 1200 total; Transport 58.3%, Food 41.6% (use toBeCloseTo for float tolerance)
    expect(out[0].name).toBe('Transport');
    expect(out[0].value).toBe(700);
    expect(out[0].percentage).toBeCloseTo(58.333, 2);
    expect(out[1].name).toBe('Food');
    expect(out[1].value).toBe(500);
    expect(out[1].percentage).toBeCloseTo(41.666, 2);
  });

  it('filters to the requested transaction type', () => {
    const data: Transaction[] = [
      tx({ category: 'Salary', amount: 5000, type: 'Income' }),
      tx({ category: 'Food', amount: 200, type: 'Expense' }),
    ];
    expect(getCategoryBreakdown(data, 'Income')).toEqual([
      { name: 'Salary', value: 5000, percentage: 100 },
    ]);
  });
});

describe('detectAnomalies', () => {
  it('returns [] when there are too few expenses', () => {
    const data: Transaction[] = Array.from({ length: 5 }, (_, i) =>
      tx({ id: `e${i}`, amount: 100, date: `2026-01-${String(i + 1).padStart(2, '0')}` }),
    );
    expect(detectAnomalies(data)).toEqual([]);
  });

  it('flags outliers that are far above the category average', () => {
    const data: Transaction[] = Array.from({ length: 25 }, (_, i) =>
      tx({
        id: `e${i}`,
        category: 'Food',
        amount: i === 0 ? 50000 : 100,
        date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
      }),
    );
    const out = detectAnomalies(data);
    expect(out.some(a => a.transaction.id === 'e0')).toBe(true);
    expect(out[0].reason).toBe('High Amount');
  });
});

describe('detectRecurring', () => {
  it('detects a monthly Netflix subscription', () => {
    const data: Transaction[] = [
      tx({ date: '2026-01-05', amount: 15, notes: 'NETFLIX COM SUBSCRIPTION', category: 'Entertainment' }),
      tx({ date: '2026-02-05', amount: 15, notes: 'NETFLIX COM SUBSCRIPTION', category: 'Entertainment' }),
      tx({ date: '2026-03-05', amount: 15, notes: 'NETFLIX COM SUBSCRIPTION', category: 'Entertainment' }),
    ];
    const out = detectRecurring(data);
    expect(out.length).toBeGreaterThan(0);
    const hit = out.find(r => r.name.toLowerCase().includes('netflix'));
    expect(hit).toBeDefined();
    expect(hit!.avgAmount).toBe(15);
    expect(Math.abs(hit!.frequency - 29)).toBeLessThanOrEqual(3);
  });

  it('does not flag one-off restaurant visits as recurring', () => {
    const data: Transaction[] = [
      tx({ date: '2026-01-10', amount: 42, notes: 'Dinner out', category: 'Food' }),
      tx({ date: '2026-01-22', amount: 67, notes: 'Brunch spot', category: 'Food' }),
    ];
    expect(detectRecurring(data)).toEqual([]);
  });
});

describe('getMonthlySavingsRates', () => {
  it('correctly calculates savings rates under normal conditions', () => {
    const monthly = [
      { month: '2026-01', income: 10000, expense: 6000, savings: 4000 },
      { month: '2026-02', income: 5000, expense: 5000, savings: 0 },
    ];
    const out = getMonthlySavingsRates(monthly);
    expect(out).toHaveLength(2);
    expect(out[0].rawRate).toBe(40);
    expect(out[0].rate).toBe(40);
    expect(out[1].rawRate).toBe(0);
    expect(out[1].rate).toBe(0);
  });

  it('clamps extreme negative savings rates to -50% visually', () => {
    const monthly = [
      { month: '2026-01', income: 1000, expense: 5000, savings: -4000 },
    ];
    const out = getMonthlySavingsRates(monthly);
    expect(out[0].rawRate).toBe(-400);
    expect(out[0].rate).toBe(-50);
  });

  it('handles zero income by returning 0% savings rate', () => {
    const monthly = [
      { month: '2026-01', income: 0, expense: 2000, savings: -2000 },
    ];
    const out = getMonthlySavingsRates(monthly);
    expect(out[0].rawRate).toBe(0);
    expect(out[0].rate).toBe(0);
  });
});
