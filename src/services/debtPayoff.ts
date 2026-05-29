import type { Debt, DebtPayoffMethod, DebtPayoffResult, DebtPayoffMonth } from '@/types';

// ============================================================
// Debt Payoff Calculator — pure, stateless calculation logic
// ============================================================
//
// Two methods supported:
//   Snowball  — attack smallest balance first (psychological wins)
//   Avalanche — attack highest interest rate first (minimises total interest)
//
// In both cases the total monthly budget is constant:
//   sum(minimumPayments) + extraMonthlyPayment
// Freed minimums from paid-off debts roll into the next priority debt
// automatically because the budget stays fixed.
//
// Simulation caps at 360 months (30 years) to prevent infinite loops
// when minimums barely cover interest.
// ============================================================

const MAX_MONTHS = 360;
const EPSILON = 0.01; // treat balances below 1 cent as paid off

const sortByMethod = (debts: Debt[], method: DebtPayoffMethod): Debt[] =>
  [...debts].sort((a, b) =>
    method === 'snowball' ? a.balance - b.balance : b.interestRate - a.interestRate
  );

export const calculateDebtPayoff = (
  debts: Debt[],
  extraMonthlyPayment: number,
  method: DebtPayoffMethod
): DebtPayoffResult => {
  if (debts.length === 0) {
    return { method, totalMonths: 0, totalInterestPaid: 0, debtFreeDate: new Date().toISOString(), neverPaysOff: false, schedule: [] };
  }

  // Fixed total budget: all minimums + extra. Freed minimums stay in the pool.
  const totalBudget =
    debts.reduce((sum, d) => sum + d.minimumPayment, 0) + Math.max(0, extraMonthlyPayment);

  // Mutable working copy of balances
  const balances: Record<string, number> = {};
  for (const d of debts) balances[d.id] = d.balance;

  const schedule: DebtPayoffMonth[] = [];
  let totalInterest = 0;
  const now = new Date();

  for (let month = 1; month <= MAX_MONTHS; month++) {
    // Any active debts left?
    const activeIds = Object.keys(balances).filter(id => balances[id] > EPSILON);
    if (activeIds.length === 0) break;

    // Step 1 — accrue monthly interest on active debts
    let interestThisMonth = 0;
    for (const id of activeIds) {
      const debt = debts.find(d => d.id === id)!;
      const monthlyRate = debt.interestRate / 100 / 12;
      const interest = balances[id] * monthlyRate;
      balances[id] += interest;
      interestThisMonth += interest;
    }

    // Step 2 — apply minimum payment to every active debt
    let budgetSpent = 0;
    for (const id of activeIds) {
      const debt = debts.find(d => d.id === id)!;
      const pay = Math.min(debt.minimumPayment, balances[id]);
      balances[id] -= pay;
      budgetSpent += pay;
      if (balances[id] < EPSILON) balances[id] = 0;
    }

    // Step 3 — direct remaining budget to priority debt (waterfall)
    const activeAfterMins = activeIds.filter(id => balances[id] > EPSILON);
    const priorityDebts = sortByMethod(
      debts.filter(d => activeAfterMins.includes(d.id)),
      method
    );
    let remaining = totalBudget - budgetSpent;
    for (const debt of priorityDebts) {
      if (remaining < EPSILON) break;
      const pay = Math.min(remaining, balances[debt.id]);
      balances[debt.id] -= pay;
      remaining -= pay;
      budgetSpent += pay;
      if (balances[debt.id] < EPSILON) balances[debt.id] = 0;
    }

    totalInterest += interestThisMonth;

    const monthDate = new Date(now.getFullYear(), now.getMonth() + month, 1);
    const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    const monthEntry: DebtPayoffMonth = {
      month,
      monthLabel,
      remainingDebts: debts.map(d => ({
        id: d.id,
        name: d.name,
        balance: Math.max(0, balances[d.id]),
        payment: 0,
      })),
      totalPaid: budgetSpent,
      interestPaid: interestThisMonth,
    };
    schedule.push(monthEntry);

    if (Object.values(balances).every(b => b <= EPSILON)) break;
  }

  // If any balance is still outstanding after the loop, the simulation hit the
  // MAX_MONTHS cap without clearing the debt — the budget doesn't cover the
  // interest. Returning a concrete debtFreeDate here would tell the user they'll
  // be debt-free on a date that is simply false, so we flag it instead.
  const neverPaysOff = Object.values(balances).some(b => b > EPSILON);

  const debtFreeDate = neverPaysOff
    ? ''
    : schedule.length > 0
      ? new Date(now.getFullYear(), now.getMonth() + schedule.length, 1).toISOString()
      : new Date().toISOString();

  return {
    method,
    totalMonths: schedule.length,
    totalInterestPaid: totalInterest,
    debtFreeDate,
    neverPaysOff,
    schedule,
  };
};
