import type { Transaction } from '@/types';

// ============================================================
// demoData — generates a realistic, clearly-synthetic sample
// transaction set for the "See it with sample data" empty-state
// flow. Pure function, no side effects, no storage. The merchant
// names are deliberately obvious placeholders so the data can
// never be mistaken for the user's own.
// ============================================================

// Deterministic PRNG (LCG) so the sample set is stable between loads.
const makeRng = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
};

interface Spec {
  category: string;
  merchant: string;
  min: number;
  max: number;
  perMonth: number;
  type?: 'Income' | 'Expense';
  recurring?: boolean;
}

const SPECS: Spec[] = [
  { category: 'Salary',        merchant: 'Demo Salary Inc',     min: 7400, max: 7600, perMonth: 1, type: 'Income', recurring: true },
  { category: 'Housing',       merchant: 'Sample Rent Co',      min: 1800, max: 1800, perMonth: 1, recurring: true },
  { category: 'Utilities',     merchant: 'Acme Utilities',      min: 90,   max: 160,  perMonth: 1, recurring: true },
  { category: 'Subscription',  merchant: 'Sandbox Streaming',   min: 12,   max: 18,   perMonth: 1, recurring: true },
  { category: 'Groceries',     merchant: 'Demo Mart',           min: 60,   max: 150,  perMonth: 4 },
  { category: 'Food',          merchant: 'Sample Cafe',         min: 12,   max: 45,   perMonth: 7 },
  { category: 'Transport',     merchant: 'Example Transit',     min: 20,   max: 70,   perMonth: 4 },
  { category: 'Entertainment', merchant: 'Placeholder Cinema',  min: 15,   max: 60,   perMonth: 2 },
  { category: 'Shopping',      merchant: 'Mock Store',          min: 25,   max: 200,  perMonth: 2 },
  { category: 'Health',        merchant: 'Test Pharmacy',       min: 10,   max: 90,   perMonth: 1 },
];

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Builds ~14 months of synthetic transactions ending at the current month.
 * Stays well under the 500-row free cap so the full set is visible.
 */
export const generateDemoTransactions = (): Transaction[] => {
  const rng = makeRng(20260529);
  const now = new Date();
  const txns: Transaction[] = [];
  let idx = 0;
  const MONTHS = 14;

  for (let m = MONTHS - 1; m >= 0; m--) {
    const base = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const year = base.getFullYear();
    const month = base.getMonth(); // 0-indexed
    
    // Generate a full month's worth of transactions for all months, including the current month.
    // This ensures that the charts, budgets, and dashboards always look fully populated and impressive,
    // even if the user views the demo early in the calendar month.
    const maxDay = new Date(year, month + 1, 0).getDate();

    for (const spec of SPECS) {
      for (let i = 0; i < spec.perMonth; i++) {
        const day = spec.recurring && spec.perMonth === 1
          ? Math.min(2, maxDay)
          : 1 + Math.floor(rng() * maxDay);
        
        const amount = Math.round(spec.min + rng() * (spec.max - spec.min));
        txns.push({
          id: `demo-${idx++}`,
          owner: 'Sample Account',
          type: spec.type ?? 'Expense',
          date: `${year}-${pad(month + 1)}-${pad(day)}`,
          time: null,
          amount,
          category: spec.category,
          subCategory: '',
          project: null,
          notes: spec.merchant,
          original_description: spec.merchant,
          merchant_name: spec.merchant,
          is_recurring: !!spec.recurring,
        });
      }
    }

    // Occasional freelance income to vary the income side.
    if (m % 3 === 0) {
      const day = 12;
      txns.push({
        id: `demo-${idx++}`,
        owner: 'Sample Account',
        type: 'Income',
        date: `${year}-${pad(month + 1)}-${pad(day)}`,
        time: null,
        amount: Math.round(800 + rng() * 900),
        category: 'Other Income',
        subCategory: '',
        project: null,
        notes: 'Demo Freelance Project',
        original_description: 'Demo Freelance Project',
        merchant_name: 'Demo Freelance Project',
      });
    }
  }

  return txns;
};
