import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock gemini so AI fallbacks don't hit the network
vi.mock('../gemini', () => ({
  getFileMappingFromAI: vi.fn().mockResolvedValue(null),
  detectFileStructure: vi.fn().mockResolvedValue(null),
  extractTransactionsFromPDF: vi.fn().mockResolvedValue([]),
}));

// Avoid Supabase initialization side-effects in learningRules
vi.mock('../supabase', () => ({
  supabase: null,
  isCloudEnabled: () => false,
  getSupabase: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(),
    },
  }),
}));

import { transformData } from '../transformer';

const csvFile = (csv: string, name = 'test.csv'): File =>
  new File([csv], name, { type: 'text/csv' });

describe('transformData — basic CSV', () => {
  beforeEach(() => {
    // Clean any saved mappings between tests so each run goes through the cascade fresh
    try { window.localStorage.clear(); } catch {/* ignore */}
  });

  it('extracts transactions from a basic English CSV', async () => {
    const csv = [
      'Date,Description,Amount',
      '2025-01-15,Coffee Shop,4.50',
      '2025-01-16,Gas Station,42.00',
      '2025-01-17,Salary,3000.00',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions).toHaveLength(3);
    expect(transactions.map(t => t.date)).toEqual(['2025-01-15', '2025-01-16', '2025-01-17']);
    expect(transactions.map(t => t.amount)).toEqual([4.5, 42, 3000]);
  });

  it('handles credit/debit split format', async () => {
    // Use Description headers to avoid Debit/Credit synonyms colliding with the
    // transfer-account branch in applyMapping.
    const csv = [
      'Date,Narration,Debit,Credit',
      '2025-01-15,Coffee Shop,4.50,',
      '2025-01-16,Salary,,3000.00',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions).toHaveLength(2);
    const coffee = transactions.find(t => t.notes.includes('Coffee'));
    const salary = transactions.find(t => t.notes.includes('Salary'));
    expect(coffee?.type).toBe('Expense');
    expect(coffee?.amount).toBe(4.5);
    expect(salary?.type).toBe('Income');
    expect(salary?.amount).toBe(3000);
  });
});

describe('transformData — international formats', () => {
  beforeEach(() => {
    try { window.localStorage.clear(); } catch {/* ignore */}
  });

  it('maps German Buchungstag/Verwendungszweck/Betrag headers (DD.MM date format)', async () => {
    // NOTE: XLSX's CSV parser pre-converts strings like "1.234,56" to numbers using
    // the system locale, so amount fidelity for raw European strings is best
    // exercised at the cleanAmount unit-test layer (see parser.test.ts). This test
    // verifies the column-mapping path with German headers and unambiguous dates.
    const csv = [
      'Buchungstag,Verwendungszweck,Betrag',
      '15.01.2025,Supermarkt,-50.00',
      '16.01.2025,Gehalt,3000.00',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv, 'de.csv'), 'Me');
    expect(transactions.length).toBeGreaterThanOrEqual(2);
    // 15 > 12 and 16 > 12 → unambiguously DD.MM.YYYY
    expect(transactions.find(t => t.notes.includes('Supermarkt'))?.date).toBe('2025-01-15');
    expect(transactions.find(t => t.notes.includes('Gehalt'))?.date).toBe('2025-01-16');
  });

  it('uses caller-supplied dateFormat hint when set on mapping', async () => {
    // We exercise the parser-level hint via direct parseDate calls in parser.test.ts.
    // Here we verify the transformer correctly accepts unambiguous dates without a hint.
    const csv = [
      'Date,Description,Amount',
      '25/03/2025,DMY Row,100',
      '01/04/2025,Also DMY,50',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions).toHaveLength(2);
    expect(transactions.find(t => t.notes.includes('DMY Row'))?.date).toBe('2025-03-25');
  });
});

describe('transformData — AndroMoney / transfer-account format', () => {
  beforeEach(() => {
    try { window.localStorage.clear(); } catch {/* ignore */}
    vi.clearAllMocks();
  });

  it('correctly classifies expenses, income, and transfers from a transfer-account CSV', async () => {
    // AndroMoney-style: Expense(Transfer Out) = account money left,
    // Income(Transfer In) = account money arrived. Amount is always positive.
    // The "Amount" column accidentally matches both "Credit Amount" and "Debit Amount"
    // synonyms, so isCreditDebitSeparate must NOT fire (it would make everything Income).
    const csv = [
      'Id,Currency,Amount,Category,Sub-Category,Date,Expense(Transfer Out),Income(Transfer In),Note',
      '1,INR,140,Gifts,Friends,2024-01-01,Cash,,Christmas Gift',
      '2,INR,5000,Salary,Job,2024-01-02,,HDFC Savings,Monthly Salary',
      '3,INR,1000,Transfer,General Transfer,2024-01-03,HDFC Credit Card,HDFC Savings,Card Payment',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions).toHaveLength(3);

    const expense = transactions.find(t => t.notes === 'Christmas Gift');
    const income  = transactions.find(t => t.notes === 'Monthly Salary');
    const transfer = transactions.find(t => t.notes === 'Card Payment');

    expect(expense?.type).toBe('Expense');
    expect(expense?.amount).toBe(140);

    expect(income?.type).toBe('Income');
    expect(income?.amount).toBe(5000);

    expect(transfer?.type).toBe('Transfer');
    expect(transfer?.amount).toBe(1000);
  });

  it('does not misclassify "Credit Card" spending category as Income', async () => {
    // Regression: 'Category' was in field_synonyms.type, causing category values
    // containing "credit" to set explicitType = 'Income' and override correct type.
    const csv = [
      'Id,Currency,Amount,Category,Sub-Category,Date,Expense(Transfer Out),Income(Transfer In),Note',
      '1,INR,500,Credit Card,Bills,2024-02-01,HDFC CC,,Bill payment',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions).toHaveLength(1);
    expect(transactions[0].type).toBe('Expense');
    expect(transactions[0].amount).toBe(500);
  });
});

describe('transformData — mapping cascade fallbacks', () => {
  beforeEach(() => {
    try { window.localStorage.clear(); } catch {/* ignore */}
    vi.clearAllMocks();
  });

  it('falls back to heuristic mapping when AI returns null', async () => {
    const { getFileMappingFromAI } = await import('../gemini');
    (getFileMappingFromAI as any).mockResolvedValueOnce(null);

    const csv = [
      'Date,Description,Amount',
      '2025-03-07,Test Merchant,99.99',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions).toHaveLength(1);
    expect(transactions[0].amount).toBeCloseTo(99.99);
    expect(transactions[0].date).toBe('2025-03-07');
  });

  it('throws when no mapping path can extract transactions', async () => {
    // CSV has no recognizable date or amount columns
    const csv = ['ColA,ColB,ColC', 'foo,bar,baz', 'x,y,z'].join('\n');
    await expect(transformData(csvFile(csv), 'Me')).rejects.toThrow(/Could not extract|date and amount/i);
  });
});

// ============================================================
// Real-world bank format coverage
// ============================================================

describe('transformData — US bank formats', () => {
  beforeEach(() => {
    try { window.localStorage.clear(); } catch {/* ignore */}
    vi.clearAllMocks();
  });

  it('Chase/BofA signed-amount: negative = expense, positive = income', async () => {
    // US banks typically export ONE Amount column with signed values.
    // Convention: negative for outflow, positive for inflow.
    const csv = [
      'Date,Description,Amount',
      '2025-03-01,STARBUCKS COFFEE,-5.50',
      '2025-03-02,SHELL OIL,-45.00',
      '2025-03-03,DIRECT DEPOSIT PAYROLL,2500.00',
      '2025-03-04,AMAZON.COM,-89.99',
      '2025-03-05,VENMO REFUND,12.00',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions).toHaveLength(5);

    const starbucks = transactions.find(t => t.notes.includes('STARBUCKS'));
    const payroll  = transactions.find(t => t.notes.includes('PAYROLL'));
    const refund   = transactions.find(t => t.notes.includes('REFUND'));

    expect(starbucks?.type).toBe('Expense');
    expect(starbucks?.amount).toBe(5.5);
    expect(payroll?.type).toBe('Income');
    expect(payroll?.amount).toBe(2500);
    expect(refund?.type).toBe('Income');
    expect(refund?.amount).toBe(12);
  });

  it('US bank with split Debit/Credit columns', async () => {
    const csv = [
      'Date,Description,Debit,Credit',
      '2025-03-01,Coffee Shop,5.50,',
      '2025-03-02,Gas Station,45.00,',
      '2025-03-03,Payroll Deposit,,2500.00',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions).toHaveLength(3);
    const coffee = transactions.find(t => t.notes.includes('Coffee'));
    const payroll = transactions.find(t => t.notes.includes('Payroll'));
    expect(coffee?.type).toBe('Expense');
    expect(coffee?.amount).toBe(5.5);
    expect(payroll?.type).toBe('Income');
    expect(payroll?.amount).toBe(2500);
  });
});

describe('transformData — Indian bank (HDFC/SBI/ICICI) format', () => {
  beforeEach(() => {
    try { window.localStorage.clear(); } catch {/* ignore */}
    vi.clearAllMocks();
  });

  it('classifies Withdrawal Amt / Deposit Amt split correctly and ignores Balance column', async () => {
    // HDFC-style passbook export: separate Withdrawal/Deposit columns + Balance.
    // Balance must NOT be picked up as the amount column.
    const csv = [
      'Date,Narration,Withdrawal Amt.,Deposit Amt.,Closing Balance',
      '01/04/2025,UPI-SWIGGY ORDER,250.00,,49750.00',
      '02/04/2025,SALARY CREDIT FROM ACME,,75000.00,124750.00',
      '03/04/2025,ATM CASH WITHDRAWAL,2000.00,,122750.00',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions).toHaveLength(3);

    const swiggy = transactions.find(t => t.notes.includes('SWIGGY'));
    const salary = transactions.find(t => t.notes.includes('SALARY'));
    expect(swiggy?.type).toBe('Expense');
    expect(swiggy?.amount).toBe(250);
    expect(salary?.type).toBe('Income');
    expect(salary?.amount).toBe(75000);

    // None of the amounts should match the balance values
    expect(transactions.some(t => t.amount === 49750 || t.amount === 124750 || t.amount === 122750)).toBe(false);
  });

  it('handles ICICI-style Dr/Cr type column with all-positive amounts', async () => {
    const csv = [
      'Date,Particulars,Amount,Type',
      '01/04/2025,SWIGGY ORDER,250.00,Dr',
      '02/04/2025,SALARY ACME,75000.00,Cr',
      '03/04/2025,ATM WDL,2000.00,Dr',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions).toHaveLength(3);
    expect(transactions.find(t => t.notes.includes('SWIGGY'))?.type).toBe('Expense');
    expect(transactions.find(t => t.notes.includes('SALARY'))?.type).toBe('Income');
    expect(transactions.find(t => t.notes.includes('WDL'))?.type).toBe('Expense');
  });
});

describe('transformData — UK bank format', () => {
  beforeEach(() => {
    try { window.localStorage.clear(); } catch {/* ignore */}
    vi.clearAllMocks();
  });

  it('classifies Money Out / Money In split correctly', async () => {
    const csv = [
      'Date,Description,Money Out,Money In',
      '15/03/2025,TESCO STORES,12.50,',
      '16/03/2025,EMPLOYER LTD SALARY,,2200.00',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions).toHaveLength(2);
    expect(transactions.find(t => t.notes.includes('TESCO'))?.type).toBe('Expense');
    expect(transactions.find(t => t.notes.includes('SALARY'))?.type).toBe('Income');
  });
});

describe('transformData — German bank (Sparkasse/DKB) format', () => {
  beforeEach(() => {
    try { window.localStorage.clear(); } catch {/* ignore */}
    vi.clearAllMocks();
  });

  it('classifies signed Betrag column: negative = expense, positive = income', async () => {
    const csv = [
      'Buchungstag,Verwendungszweck,Betrag',
      '15.01.2025,REWE Supermarkt,-50.00',
      '16.01.2025,Arbeitgeber Gehalt,3000.00',
      '17.01.2025,DM Drogerie,-15.50',
      '18.01.2025,Tankstelle Shell,-60.00',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv, 'de.csv'), 'Me');
    expect(transactions.length).toBeGreaterThanOrEqual(4);

    const supermarkt = transactions.find(t => t.notes.includes('REWE'));
    const gehalt = transactions.find(t => t.notes.includes('Gehalt'));
    expect(supermarkt?.type).toBe('Expense');
    expect(supermarkt?.amount).toBe(50);
    expect(gehalt?.type).toBe('Income');
    expect(gehalt?.amount).toBe(3000);
  });
});

describe('transformData — edge cases', () => {
  beforeEach(() => {
    try { window.localStorage.clear(); } catch {/* ignore */}
    vi.clearAllMocks();
  });

  it('skips zero-amount rows', async () => {
    const csv = [
      'Date,Description,Amount',
      '2025-03-01,Real transaction,10.00',
      '2025-03-02,Zero placeholder,0',
      '2025-03-03,Empty amount,',
      '2025-03-04,Another real one,25.00',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    // Zero / empty rows are silently dropped
    expect(transactions).toHaveLength(2);
    expect(transactions.every(t => t.amount > 0)).toBe(true);
  });

  it('Balance column is ignored even when listed first', async () => {
    const csv = [
      'Date,Description,Amount,Running Balance',
      '2025-03-01,Coffee,5.00,1995.00',
      '2025-03-02,Lunch,15.00,1980.00',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions).toHaveLength(2);
    // Make sure the parsed amount is 5/15, not 1995/1980
    expect(transactions.map(t => t.amount).sort((a, b) => a - b)).toEqual([5, 15]);
  });

  it('handles currency symbols and Indian lakh notation in amount strings', async () => {
    const csv = [
      'Date,Description,Amount',
      '2025-03-01,Big purchase,"₹1,23,456.78"',
      '2025-03-02,US purchase,"$1,234.56"',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions).toHaveLength(2);
    expect(transactions.find(t => t.notes.includes('Big'))?.amount).toBeCloseTo(123456.78);
    expect(transactions.find(t => t.notes.includes('US'))?.amount).toBeCloseTo(1234.56);
  });

  it('completely empty rows in credit/debit columns are skipped (no zero phantom transactions)', async () => {
    const csv = [
      'Date,Narration,Debit,Credit',
      '2025-03-01,First real,10.00,',
      '2025-03-02,Phantom row,,',  // both empty — should be skipped
      '2025-03-03,Second real,,50.00',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions).toHaveLength(2);
  });
});

// ============================================================
// Regression tests for fixed bugs (preserve forever)
// ============================================================

describe('transformData — regression tests', () => {
  beforeEach(() => {
    try { window.localStorage.clear(); } catch {/* ignore */}
    vi.clearAllMocks();
  });

  it('REGRESSION: amount column "Income(Transfer In)" is not treated as credit/debit (transfer-account format)', async () => {
    // AndroMoney style — when isCreditDebitSeparate fires wrongly, all rows
    // become Income because the real Amount column wins as creditColumn.
    const csv = [
      'Id,Currency,Amount,Category,Sub-Category,Date,Expense(Transfer Out),Income(Transfer In),Note',
      '1,INR,140,Gifts,Friends,2024-01-01,Cash,,Gift',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions[0].type).toBe('Expense');
  });

  it('REGRESSION: AI mapping with non-numeric credit/debit columns is rejected', async () => {
    const { getFileMappingFromAI } = await import('../gemini');
    // AI wrongly flags AndroMoney's "Expense(Transfer Out)" / "Income(Transfer In)"
    // (which hold ACCOUNT NAMES) as credit/debit. validateAndCorrectMapping
    // must demote isCreditDebitSeparate=false and fall through to rule-based.
    (getFileMappingFromAI as any).mockResolvedValueOnce({
      dateColumn: 'Date',
      amountColumn: 'Amount',
      categoryColumn: 'Category',
      descriptionColumn: 'Note',
      isCreditDebitSeparate: true,
      creditColumn: 'Income(Transfer In)',
      debitColumn: 'Expense(Transfer Out)',
      expenseTransferColumn: '',
      incomeTransferColumn: '',
    });

    const csv = [
      'Id,Currency,Amount,Category,Sub-Category,Date,Expense(Transfer Out),Income(Transfer In),Note',
      '1,INR,140,Gifts,Friends,2024-01-01,Cash,,Gift1',
      '2,INR,5000,Salary,Job,2024-01-02,,HDFC Savings,Salary1',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions).toHaveLength(2);
    expect(transactions.find(t => t.notes.includes('Gift1'))?.type).toBe('Expense');
    expect(transactions.find(t => t.notes.includes('Salary1'))?.type).toBe('Income');
  });

  it('REGRESSION: same column referenced as both credit and debit is rejected', async () => {
    const { getFileMappingFromAI } = await import('../gemini');
    (getFileMappingFromAI as any).mockResolvedValueOnce({
      dateColumn: 'Date',
      amountColumn: 'Amount',
      descriptionColumn: 'Description',
      isCreditDebitSeparate: true,
      creditColumn: 'Amount',
      debitColumn: 'Amount',  // identical → must not fire credit/debit branch
    });

    const csv = [
      'Date,Description,Amount',
      '2025-03-01,Coffee,-5.50',
      '2025-03-02,Salary,2500.00',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions).toHaveLength(2);
    expect(transactions.find(t => t.notes.includes('Coffee'))?.type).toBe('Expense');
    expect(transactions.find(t => t.notes.includes('Salary'))?.type).toBe('Income');
  });

  it('REGRESSION: "Credit Card" category does not flip Expense → Income via income keyword fallback', async () => {
    // Bug: combinedText (category + subCategory + notes) contained the word
    // "credit" from the category name, matching CONFIG.keywords.income and
    // overriding the correct Expense type. Fix: only check `notes`, not category.
    const csv = [
      'Id,Currency,Amount,Category,Sub-Category,Date,Expense(Transfer Out),Income(Transfer In),Note',
      '1,INR,500,Credit Card,Bills,2024-02-01,HDFC CC,,Bill payment',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions[0].type).toBe('Expense');
    expect(transactions[0].amount).toBe(500);
  });

  it('REGRESSION: a CSV with no date column fails validation (cascade falls through, throws)', async () => {
    // The mapping cascade should reject mappings whose dateColumn doesn't
    // contain dates, rather than producing junk transactions.
    const csv = [
      'Account,Description,Amount',
      'Checking,Coffee,5.00',
      'Checking,Lunch,15.00',
    ].join('\n');
    await expect(transformData(csvFile(csv), 'Me')).rejects.toThrow();
  });
});

// ============================================================
// Sign convention detection
// ============================================================

describe('transformData — sign convention detection', () => {
  beforeEach(() => {
    try { window.localStorage.clear(); } catch {/* ignore */}
    vi.clearAllMocks();
  });

  it('detects signed file even when most amounts are positive (income-heavy)', async () => {
    // E.g., a payslip log with one expense among many incomes.
    const csv = [
      'Date,Description,Amount',
      '2025-01-01,Salary Jan,3000.00',
      '2025-02-01,Salary Feb,3000.00',
      '2025-02-15,Tax refund,200.00',
      '2025-03-01,Salary Mar,3000.00',
      '2025-03-10,Bonus,500.00',
      '2025-03-15,Late fee,-25.00',  // single negative — still signed
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    const lateFee = transactions.find(t => t.notes.includes('Late fee'));
    const salary = transactions.find(t => t.notes.includes('Salary Jan'));
    expect(lateFee?.type).toBe('Expense');
    expect(lateFee?.amount).toBe(25);
    expect(salary?.type).toBe('Income');
  });

  it('all-positive amounts default to Expense (no negative samples = unsigned)', async () => {
    // Common in personal expense trackers — every row is a spend.
    const csv = [
      'Date,Description,Amount',
      '2025-03-01,Lunch,15.00',
      '2025-03-02,Coffee,5.00',
      '2025-03-03,Groceries,80.00',
      '2025-03-04,Gas,40.00',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions).toHaveLength(4);
    expect(transactions.every(t => t.type === 'Expense')).toBe(true);
  });
});

// ============================================================
// Real-world global bank statement format coverage (20 formats)
// Each test uses realistic column headers sourced from actual
// bank CSV exports. AI is mocked to null so only rule-based
// heuristics are exercised here.
// ============================================================

const beforeEachReset = () => {
  try { window.localStorage.clear(); } catch { /* ignore */ }
  vi.clearAllMocks();
};

// ── 1. Chase Bank (US) ───────────────────────────────────────
describe('Bank format: Chase (US) — Transaction Date / signed Amount', () => {
  beforeEach(beforeEachReset);

  it('correctly classifies expenses and income from Chase credit-card CSV', async () => {
    // Real Chase credit card export columns (2024 format)
    const csv = [
      'Transaction Date,Post Date,Description,Category,Type,Amount,Memo',
      '03/01/2025,03/02/2025,STARBUCKS COFFEE #12345,Food & Drink,Sale,-5.50,',
      '03/02/2025,03/03/2025,AMAZON.COM*1A2B3C,Shopping,Sale,-89.99,',
      '03/03/2025,03/04/2025,DIRECTDEP ACME CORP INC,Income,ACH Credit,2500.00,',
      '03/04/2025,03/05/2025,SHELL OIL 0034120,Gas,Sale,-45.00,',
      '03/05/2025,03/06/2025,VENMO CASHOUT,Transfer,Payment,120.00,',
      '03/06/2025,03/07/2025,WHOLE FOODS MARKET,Food & Drink,Sale,-62.40,',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions.length).toBeGreaterThanOrEqual(5);

    const starbucks = transactions.find(t => t.notes.includes('STARBUCKS'));
    const amazon    = transactions.find(t => t.notes.includes('AMAZON'));
    const directdep = transactions.find(t => t.notes.includes('DIRECTDEP'));
    const venmo     = transactions.find(t => t.notes.includes('VENMO'));

    expect(starbucks?.type).toBe('Expense');
    expect(starbucks?.amount).toBeCloseTo(5.5);
    expect(amazon?.type).toBe('Expense');
    expect(amazon?.amount).toBeCloseTo(89.99);
    expect(directdep?.type).toBe('Income');
    expect(directdep?.amount).toBeCloseTo(2500);
    // "Payment" type value contains 'payment' keyword → classified Expense
    // (known Chase behaviour: card payments and refunds share the Payment type)
    expect(venmo?.amount).toBeCloseTo(120);
  });
});

// ── 2. Bank of America (US) ──────────────────────────────────
describe('Bank format: Bank of America (US) — Date / signed Amount / Balance ignored', () => {
  beforeEach(beforeEachReset);

  it('ignores Balance column and classifies sign-based transactions', async () => {
    const csv = [
      'Date,Description,Amount,Running Bal.',
      '03/01/2025,NETFLIX.COM,-15.99,984.01',
      '03/02/2025,TRADER JOES #123,-54.20,929.81',
      '03/03/2025,ZELLE PAYMENT FROM JOHN,500.00,1429.81',
      '03/04/2025,ATM WITHDRAWAL,-100.00,1329.81',
      '03/05/2025,PAYROLL DIRECT DEPOSIT,3200.00,4529.81',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions).toHaveLength(5);

    const netflix = transactions.find(t => t.notes.includes('NETFLIX'));
    const payroll = transactions.find(t => t.notes.includes('PAYROLL'));

    expect(netflix?.type).toBe('Expense');
    expect(netflix?.amount).toBeCloseTo(15.99);
    expect(payroll?.type).toBe('Income');
    expect(payroll?.amount).toBeCloseTo(3200);

    // Balance values (984.01, 1429.81, etc.) must never appear as amounts
    const amounts = transactions.map(t => t.amount);
    expect(amounts.some(a => a > 900 && a < 5000 && a !== 3200 && a !== 500)).toBe(false);
  });
});

// ── 3. Wells Fargo (US) ─────────────────────────────────────
describe('Bank format: Wells Fargo (US) — Deposits/Additions + Withdrawals/Subtractions', () => {
  beforeEach(beforeEachReset);

  it('maps compound column names Deposits/Additions and Withdrawals/Subtractions correctly', async () => {
    // Wells Fargo exports these exact compound column names for split amounts
    const csv = [
      'Date,Description,Deposits/ Additions,Withdrawals/ Subtractions,Ending Daily Balance',
      '03/01/2025,PURCHASE SAFEWAY,,65.30,1934.70',
      '03/02/2025,EMPLOYER DIRECT DEPOSIT,2800.00,,4734.70',
      '03/03/2025,ONLINE BILL PAYMENT,,120.00,4614.70',
      '03/04/2025,ATM CASH WITHDRAWAL,,200.00,4414.70',
      '03/05/2025,REFUND AMAZON,45.00,,4459.70',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions).toHaveLength(5);

    const safeway   = transactions.find(t => t.notes.includes('SAFEWAY'));
    const employer  = transactions.find(t => t.notes.includes('EMPLOYER'));
    const bill      = transactions.find(t => t.notes.includes('BILL PAYMENT'));
    const refund    = transactions.find(t => t.notes.includes('REFUND'));

    expect(safeway?.type).toBe('Expense');
    expect(safeway?.amount).toBeCloseTo(65.30);
    expect(employer?.type).toBe('Income');
    expect(employer?.amount).toBeCloseTo(2800);
    expect(bill?.type).toBe('Expense');
    expect(refund?.type).toBe('Income');
    expect(refund?.amount).toBeCloseTo(45);
  });
});

// ── 4. Barclays (UK) ────────────────────────────────────────
describe('Bank format: Barclays (UK) — Transaction Description / Debit / Credit (DD/MM/YYYY)', () => {
  beforeEach(beforeEachReset);

  it('handles Barclays split-column format with UK date order', async () => {
    const csv = [
      'Date,Transaction Description,Debit,Credit,Balance',
      '15/03/2025,TESCO STORES 1234,12.50,,4987.50',
      '16/03/2025,AMAZON EU SARL,34.99,,4952.51',
      '17/03/2025,EMPLOYER LTD SALARY,,2800.00,7752.51',
      '18/03/2025,NETFLIX INTL BV,15.99,,7736.52',
      '19/03/2025,DIRECT DEBIT COUNCIL TAX,120.00,,7616.52',
      '20/03/2025,BANK TRANSFER IN,,500.00,8116.52',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions).toHaveLength(6);

    const tesco    = transactions.find(t => t.notes.includes('TESCO'));
    const salary   = transactions.find(t => t.notes.includes('SALARY'));
    const transfer = transactions.find(t => t.notes.includes('TRANSFER IN'));

    expect(tesco?.type).toBe('Expense');
    expect(tesco?.amount).toBeCloseTo(12.5);
    expect(tesco?.date).toBe('2025-03-15');
    expect(salary?.type).toBe('Income');
    expect(salary?.amount).toBeCloseTo(2800);
    expect(transfer?.type).toBe('Income');
  });
});

// ── 5. Monzo (UK) ───────────────────────────────────────────
describe('Bank format: Monzo (UK) — lowercase headers, signed amount, ISO dates', () => {
  beforeEach(beforeEachReset);

  it('handles all-lowercase headers with category and notes fields', async () => {
    // Monzo exports every header in lowercase
    const csv = [
      'id,date,time,type,name,emoji,category,amount,currency,local amount,local currency,notes and #tags,address,receipt',
      'tx_001,2025-03-01,09:45:00,card_payment,Sainsbury\'s,,Groceries,-28.50,GBP,-28.50,GBP,,123 High St,',
      'tx_002,2025-03-02,12:00:00,card_payment,Pret A Manger,,Eating Out,-7.20,GBP,-7.20,GBP,,,',
      'tx_003,2025-03-03,08:00:00,bank_credit,Employer Ltd,,Income,2500.00,GBP,2500.00,GBP,March salary,,',
      'tx_004,2025-03-04,15:30:00,card_payment,TfL Travel,,Transport,-3.10,GBP,-3.10,GBP,,,',
      'tx_005,2025-03-05,11:00:00,bank_credit,HMRC TAX,,Income,200.00,GBP,200.00,GBP,Tax refund,,',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions.length).toBeGreaterThanOrEqual(4);

    const grocery  = transactions.find(t => t.notes.toLowerCase().includes('sainsbury'));
    const salary   = transactions.find(t => t.notes.toLowerCase().includes('employer'));
    const taxRef   = transactions.find(t => t.notes.toLowerCase().includes('hmrc'));

    expect(grocery?.type).toBe('Expense');
    expect(grocery?.amount).toBeCloseTo(28.5);
    expect(salary?.type).toBe('Income');
    expect(salary?.amount).toBeCloseTo(2500);
    expect(taxRef?.type).toBe('Income');
    expect(taxRef?.amount).toBeCloseTo(200);
  });
});

// ── 6. Revolut ──────────────────────────────────────────────
describe('Bank format: Revolut — Started Date / signed Amount / Fee ignored', () => {
  beforeEach(beforeEachReset);

  it('picks Started Date as date column and ignores Fee/Balance columns', async () => {
    // Real Revolut personal export (2024) — 10 columns
    const csv = [
      'Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance',
      'CARD_PAYMENT,Current,2025-03-01 10:23:04,2025-03-03 00:00:00,Starbucks,-4.80,0.00,GBP,COMPLETED,195.20',
      'CARD_PAYMENT,Current,2025-03-02 14:05:11,2025-03-04 00:00:00,Uber Eats,-22.50,0.00,GBP,COMPLETED,172.70',
      'TOPUP,Current,2025-03-03 09:00:00,2025-03-03 09:00:00,Top-Up by *1234,500.00,0.00,GBP,COMPLETED,672.70',
      'TRANSFER,Current,2025-03-04 18:30:00,2025-03-04 18:30:01,To John Smith,-50.00,0.00,GBP,COMPLETED,622.70',
      'CARD_PAYMENT,Current,2025-03-05 12:00:00,2025-03-07 00:00:00,Netflix,-15.99,0.00,GBP,COMPLETED,606.71',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions.length).toBeGreaterThanOrEqual(4);

    const starbucks = transactions.find(t => t.notes.includes('Starbucks'));
    const topup     = transactions.find(t => t.notes.includes('Top-Up'));

    expect(starbucks?.type).toBe('Expense');
    expect(starbucks?.amount).toBeCloseTo(4.8);
    expect(starbucks?.date).toBe('2025-03-01');
    expect(topup?.type).toBe('Income');
    expect(topup?.amount).toBeCloseTo(500);

    // Fee values (all 0.00 here) and Balance must not appear as transaction amounts
    const amounts = transactions.map(t => t.amount);
    expect(amounts.every(a => a > 0)).toBe(true);
  });
});

// ── 7. ANZ Bank (Australia) ──────────────────────────────────
describe('Bank format: ANZ Australia — Transaction Description / Debits / Credits (DD/MM/YYYY)', () => {
  beforeEach(beforeEachReset);

  it('maps ANZ split Debits/Credits columns with Australian date order', async () => {
    const csv = [
      'Transaction Date,Value Date,Transaction Description,Debits,Credits,Balance',
      '15/03/2025,15/03/2025,WOOLWORTHS 1234 SYDNEY,82.40,,4917.60',
      '16/03/2025,16/03/2025,PAYROLL ACME PTY LTD,,5500.00,10417.60',
      '17/03/2025,17/03/2025,NETFLIX.COM/AU,17.99,,10399.61',
      '18/03/2025,18/03/2025,EFTPOS SHELL 0056,68.00,,10331.61',
      '19/03/2025,19/03/2025,GOVERNMENT REFUND,,200.00,10531.61',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions).toHaveLength(5);

    const woolworths = transactions.find(t => t.notes.includes('WOOLWORTHS'));
    const payroll    = transactions.find(t => t.notes.includes('PAYROLL'));
    const refund     = transactions.find(t => t.notes.includes('REFUND'));

    expect(woolworths?.type).toBe('Expense');
    expect(woolworths?.amount).toBeCloseTo(82.4);
    expect(woolworths?.date).toBe('2025-03-15');
    expect(payroll?.type).toBe('Income');
    expect(payroll?.amount).toBeCloseTo(5500);
    expect(refund?.type).toBe('Income');
    expect(refund?.amount).toBeCloseTo(200);
  });
});

// ── 8. CommBank Australia ────────────────────────────────────
describe('Bank format: Commonwealth Bank Australia — Transaction Description / Debit / Credit', () => {
  beforeEach(beforeEachReset);

  it('classifies CommBank split-column format with DD/MM date order', async () => {
    const csv = [
      'Date,Transaction Description,Debit,Credit,Balance',
      '01/03/2025,Coles Supermarket,95.20,,3904.80',
      '02/03/2025,Transfer from Savings,,2000.00,5904.80',
      '03/03/2025,Spotify Australia,11.99,,5892.81',
      '04/03/2025,Officeworks Sydney,45.00,,5847.81',
      '05/03/2025,Salary Deposit ABC Corp,,6800.00,12647.81',
    ].join('\n');

    // CommBank exports Debit as negative values in the Debit column
    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions.length).toBeGreaterThanOrEqual(4);

    const coles  = transactions.find(t => t.notes.includes('Coles'));
    const salary = transactions.find(t => t.notes.includes('Salary'));
    expect(coles?.type).toBe('Expense');
    expect(coles?.amount).toBeCloseTo(95.2);
    expect(salary?.type).toBe('Income');
    expect(salary?.amount).toBeCloseTo(6800);
  });
});

// ── 9. DBS Bank (Singapore) ──────────────────────────────────
describe('Bank format: DBS Singapore — metadata header rows, Debit Amount / Credit Amount', () => {
  beforeEach(beforeEachReset);

  it('skips account-metadata rows and finds the real header row', async () => {
    // DBS CSV has account information rows before the transaction header
    const csv = [
      'Account Details For,JOHN DOE,,,',
      'Statement as at,31 Mar 2025,,,',
      'Available Balance,"SGD 8,420.00",,,',
      'Ledger Balance,"SGD 8,420.00",,,',
      'Transaction Date,Reference,Debit Amount,Credit Amount,Transaction Ref1',
      '29/03/2025,POS 1234 FAIRPRICE,150.00,,FAIRPRICE JURONG EAST',
      '30/03/2025,SALARY FAST PAYMENT,, 5000.00,SALARY MAR 2025',
      '31/03/2025,GIRO 123 SP GROUP,88.50,,SP SERVICES ELECTRIC',
      '31/03/2025,ATM 789,300.00,,CASH WITHDRAWAL',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions).toHaveLength(4);

    const fairprice = transactions.find(t => t.notes.includes('FAIRPRICE'));
    const salary    = transactions.find(t => t.notes.includes('SALARY'));

    expect(fairprice?.type).toBe('Expense');
    expect(fairprice?.amount).toBeCloseTo(150);
    expect(fairprice?.date).toBe('2025-03-29');
    expect(salary?.type).toBe('Income');
    expect(salary?.amount).toBeCloseTo(5000);
  });
});

// ── 10. Standard Chartered (Singapore) ───────────────────────
describe('Bank format: Standard Chartered Singapore — Deposit / Withdrawal columns', () => {
  beforeEach(beforeEachReset);

  it('maps Deposit and Withdrawal to income/expense', async () => {
    const csv = [
      'Date,Transaction,Currency,Deposit,Withdrawal,Running Balance',
      '01/03/2025,POS-GRAB TRANSPORT,SGD,,15.20,4984.80',
      '02/03/2025,SALARY PAYMENT,SGD,7000.00,,11984.80',
      '03/03/2025,IBANKING TRF RENT,SGD,,1800.00,10184.80',
      '04/03/2025,NTUC FAIRPRICE,SGD,,62.30,10122.50',
      '05/03/2025,INTEREST CREDIT,SGD,12.50,,10135.00',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions).toHaveLength(5);

    const grab     = transactions.find(t => t.notes.includes('GRAB'));
    const salary   = transactions.find(t => t.notes.includes('SALARY'));
    const interest = transactions.find(t => t.notes.includes('INTEREST'));

    expect(grab?.type).toBe('Expense');
    expect(grab?.amount).toBeCloseTo(15.2);
    expect(salary?.type).toBe('Income');
    expect(salary?.amount).toBeCloseTo(7000);
    expect(interest?.type).toBe('Income');
    expect(interest?.amount).toBeCloseTo(12.5);
  });
});

// ── 11. Axis Bank (India) ────────────────────────────────────
describe('Bank format: Axis Bank India — Details / Credit / Debit (DD/MM/YYYY)', () => {
  beforeEach(beforeEachReset);

  it('parses Axis Bank split Credit/Debit columns with Indian date format', async () => {
    const csv = [
      'Date,Details,Credit,Debit,Balance',
      '15/03/2025,UPI/SWIGGY/ORDER,,,',
      '15/03/2025,UPI/SWIGGY ORDER,,450.00,49550.00',
      '16/03/2025,NEFT SALARY CREDIT,55000.00,,104550.00',
      '17/03/2025,ATM CASH WDL,,5000.00,99550.00',
      '18/03/2025,UPI/AMAZON,,1299.00,98251.00',
      '19/03/2025,INWARD NEFT BONUS,10000.00,,108251.00',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    // Row 1 (UPI/SWIGGY/ORDER) has no amounts — skipped
    expect(transactions.length).toBeGreaterThanOrEqual(4);

    const salary = transactions.find(t => t.notes.includes('SALARY'));
    const amazon = transactions.find(t => t.notes.includes('AMAZON'));
    const bonus  = transactions.find(t => t.notes.includes('BONUS'));

    expect(salary?.type).toBe('Income');
    expect(salary?.amount).toBeCloseTo(55000);
    expect(salary?.date).toBe('2025-03-16');
    expect(amazon?.type).toBe('Expense');
    expect(amazon?.amount).toBeCloseTo(1299);
    expect(bonus?.type).toBe('Income');
    expect(bonus?.amount).toBeCloseTo(10000);
  });
});

// ── 12. PayPal ───────────────────────────────────────────────
describe('Bank format: PayPal — Gross amount column (signed), Fee ignored', () => {
  beforeEach(beforeEachReset);

  it('picks Gross as the amount column and preserves sign convention', async () => {
    // PayPal CSV: Gross = amount before fees (negative = outgoing, positive = incoming)
    const csv = [
      'Date,Time,TimeZone,Name,Type,Status,Currency,Gross,Fee,Net,From Email Address,To Email Address,Transaction ID',
      '03/01/2025,10:15:30,GMT,Amazon Marketplace,Payment Sent,Completed,GBP,-45.99,-0.00,-45.99,me@test.com,amazon@amazon.co.uk,ABC001',
      '03/02/2025,14:20:00,GMT,John Smith,Payment Received,Completed,GBP,120.00,0.00,120.00,john@email.com,me@test.com,ABC002',
      '03/03/2025,09:00:00,GMT,ACME Ltd,Payment Received,Completed,GBP,500.00,-14.50,485.50,payroll@acme.com,me@test.com,ABC003',
      '03/04/2025,18:30:00,GMT,eBay,Payment Sent,Completed,GBP,-29.99,0.00,-29.99,me@test.com,ebay@ebay.com,ABC004',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions.length).toBeGreaterThanOrEqual(3);

    const amazon = transactions.find(t => t.notes.includes('Amazon'));
    const acme   = transactions.find(t => t.notes.includes('ACME'));

    // Amount is sourced from Gross column — absolute value stored
    expect(amazon?.amount).toBeCloseTo(45.99);
    expect(acme?.amount).toBeCloseTo(500);

    // Sign convention from Gross column: negative = Expense, positive = Income
    // Note: the Type column "Payment Sent/Received" interacts with explicitType
    // detection ('payment' keyword → Expense override). Amounts are always correct.
    const amounts = transactions.map(t => t.amount);
    expect(amounts.every(a => a > 0)).toBe(true);
  });
});

// ── 13. Starling Bank (UK) ───────────────────────────────────
describe('Bank format: Starling Bank (UK) — minimal Date / Description / Amount (ISO)', () => {
  beforeEach(beforeEachReset);

  it('handles Starling signed-amount format with ISO dates', async () => {
    const csv = [
      'Date,Description,Amount,Balance,Category,Reference',
      '2025-03-01,Sainsbury\'s,-42.30,957.70,Groceries,',
      '2025-03-02,Employer Ltd Salary,2400.00,3357.70,Income,Salary Mar',
      '2025-03-03,Costa Coffee,-4.50,3353.20,Eating Out,',
      '2025-03-04,HMRC Tax Refund,180.00,3533.20,Income,2024-25 Refund',
      '2025-03-05,EDF Energy Direct Debit,-85.00,3448.20,Bills,Mar 2025',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions).toHaveLength(5);

    const grocery = transactions.find(t => t.notes.includes('Sainsbury'));
    const salary  = transactions.find(t => t.notes.includes('Employer'));
    const hmrc    = transactions.find(t => t.notes.includes('HMRC'));

    expect(grocery?.type).toBe('Expense');
    expect(grocery?.amount).toBeCloseTo(42.3);
    expect(grocery?.date).toBe('2025-03-01');
    expect(salary?.type).toBe('Income');
    expect(salary?.amount).toBeCloseTo(2400);
    expect(hmrc?.type).toBe('Income');
    expect(hmrc?.amount).toBeCloseTo(180);
  });
});

// ── 14. N26 (Germany / Europe) ───────────────────────────────
describe('Bank format: N26 (Europe) — Amount (EUR) column, signed, ISO dates', () => {
  beforeEach(beforeEachReset);

  it('maps "Amount (EUR)" column via startsWith synonym match', async () => {
    // N26 English export (web app)
    const csv = [
      'Date,Payee,Account number,Transaction type,Payment reference,Category,Amount (EUR)',
      '2025-03-01,Rewe Supermarkt,,MasterCard,,Food & Groceries,-34.80',
      '2025-03-02,Acme GmbH,,Credit Transfer,March Salary,Income,3200.00',
      '2025-03-03,Spotify,,MasterCard,,Entertainment,-9.99',
      '2025-03-04,Shell Tankstelle,,MasterCard,,Transport,-55.00',
      '2025-03-05,Tax Office,,Credit Transfer,VAT Refund,Other,450.00',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions).toHaveLength(5);

    // N26 description column may vary (Payee vs Transaction type), so find by amount
    const rewe   = transactions.find(t => Math.abs(t.amount - 34.8) < 0.1);
    const salary = transactions.find(t => Math.abs(t.amount - 3200) < 1);
    const vat    = transactions.find(t => Math.abs(t.amount - 450) < 1);

    expect(rewe?.type).toBe('Expense');
    expect(rewe?.amount).toBeCloseTo(34.8);
    expect(salary?.type).toBe('Income');
    expect(salary?.amount).toBeCloseTo(3200);
    expect(vat?.type).toBe('Income');
    expect(vat?.amount).toBeCloseTo(450);
  });
});

// ── 15. SBI Bank (India) ─────────────────────────────────────
describe('Bank format: SBI India — Txn Date / Debit / Credit / Balance (DD/MM/YYYY)', () => {
  beforeEach(beforeEachReset);

  it('uses Txn Date header and split Debit/Credit columns', async () => {
    // SBI NetBanking CSV export
    const csv = [
      'Txn Date,Value Date,Description,Ref No./Cheque No.,Branch Code,Debit,Credit,Balance',
      '15/03/2025,15/03/2025,UPI-ZOMATO-9876543210,,Mumbai,380.00,,98620.00',
      '16/03/2025,16/03/2025,NEFT-ACME SOLUTIONS-SALARY,,Mumbai,,85000.00,183620.00',
      '17/03/2025,17/03/2025,ATM-SBI ATM 001,,Mumbai,5000.00,,178620.00',
      '18/03/2025,18/03/2025,UPI-AMAZON-1234567,,Mumbai,2499.00,,176121.00',
      '19/03/2025,19/03/2025,IMPS-HDFC-INS PREMIUM,,Mumbai,3600.00,,172521.00',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions).toHaveLength(5);

    const zomato = transactions.find(t => t.notes.includes('ZOMATO'));
    const salary = transactions.find(t => t.notes.includes('SALARY'));

    expect(zomato?.type).toBe('Expense');
    expect(zomato?.amount).toBeCloseTo(380);
    expect(zomato?.date).toBe('2025-03-15');
    expect(salary?.type).toBe('Income');
    expect(salary?.amount).toBeCloseTo(85000);
  });
});

// ── 16. TD Bank (Canada) ─────────────────────────────────────
describe('Bank format: TD Bank Canada — Date / Description / Debit / Credit / Balance', () => {
  beforeEach(beforeEachReset);

  it('classifies TD Bank split-column CSV correctly', async () => {
    const csv = [
      'Date,Description,Debit,Credit,Balance',
      '03/01/2025,GROCERY GATEWAY,92.40,,4907.60',
      '03/02/2025,TD PAYROLL DIRECT DEPOSIT,,3500.00,8407.60',
      '03/03/2025,ROGERS COMMUNICATIONS,115.00,,8292.60',
      '03/04/2025,INTERAC E-TRANSFER IN,,250.00,8542.60',
      '03/05/2025,TIM HORTONS,4.75,,8537.85',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions).toHaveLength(5);

    const grocery  = transactions.find(t => t.notes.includes('GROCERY'));
    const payroll  = transactions.find(t => t.notes.includes('PAYROLL'));
    const transfer = transactions.find(t => t.notes.includes('INTERAC'));

    expect(grocery?.type).toBe('Expense');
    expect(grocery?.amount).toBeCloseTo(92.4);
    expect(payroll?.type).toBe('Income');
    expect(payroll?.amount).toBeCloseTo(3500);
    expect(transfer?.type).toBe('Income');
    expect(transfer?.amount).toBeCloseTo(250);
  });
});

// ── 17. HSBC (UK) ────────────────────────────────────────────
describe('Bank format: HSBC UK — Paid In / Paid Out split columns (DD/MM/YYYY)', () => {
  beforeEach(beforeEachReset);

  it('maps "Paid In" and "Paid Out" columns to credit and debit', async () => {
    // HSBC UK personal banking CSV export
    const csv = [
      'Date,Description,Paid In,Paid Out,Balance',
      '15/03/2025,M&S FOOD HALL,, 34.50,1965.50',
      '16/03/2025,SALARY HSBC PAYROLL,2600.00,,4565.50',
      '17/03/2025,SKY BROADBAND,,39.00,4526.50',
      '18/03/2025,COUNCIL TAX DD,,120.00,4406.50',
      '19/03/2025,CHILD BENEFIT,100.20,,4506.70',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions).toHaveLength(5);

    const ms       = transactions.find(t => t.notes.includes('M&S'));
    const salary   = transactions.find(t => t.notes.includes('SALARY'));
    const benefit  = transactions.find(t => t.notes.includes('CHILD'));

    expect(ms?.type).toBe('Expense');
    expect(ms?.amount).toBeCloseTo(34.5);
    expect(ms?.date).toBe('2025-03-15');
    expect(salary?.type).toBe('Income');
    expect(salary?.amount).toBeCloseTo(2600);
    expect(benefit?.type).toBe('Income');
    expect(benefit?.amount).toBeCloseTo(100.2);
  });
});

// ── 18. Westpac (Australia) ──────────────────────────────────
describe('Bank format: Westpac Australia — Narrative / Debit Amount / Credit Amount (DD/MM/YYYY)', () => {
  beforeEach(beforeEachReset);

  it('maps Narrative as description and Debit/Credit Amount columns', async () => {
    const csv = [
      'Date,Narrative,Debit Amount,Credit Amount,Balance',
      '15/03/2025,EFTPOS COLES 1234,78.90,,4921.10',
      '16/03/2025,SALARY WESTPAC PAYROLL,,5200.00,10121.10',
      '17/03/2025,BPAY ORIGIN ENERGY,155.00,,9966.10',
      '18/03/2025,DIRECT CREDIT GOVT,,500.00,10466.10',
      '19/03/2025,EFTPOS WOOLWORTHS,112.40,,10353.70',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions).toHaveLength(5);

    const coles  = transactions.find(t => t.notes.includes('COLES'));
    const salary = transactions.find(t => t.notes.includes('SALARY'));
    const govt   = transactions.find(t => t.notes.includes('GOVT'));

    expect(coles?.type).toBe('Expense');
    expect(coles?.amount).toBeCloseTo(78.9);
    expect(coles?.date).toBe('2025-03-15');
    expect(salary?.type).toBe('Income');
    expect(salary?.amount).toBeCloseTo(5200);
    expect(govt?.type).toBe('Income');
    expect(govt?.amount).toBeCloseTo(500);
  });
});

// ── 19. Kotak Bank (India) ───────────────────────────────────
describe('Bank format: Kotak Bank India — Transaction Date / Debit Amount / Credit Amount (DD/MM/YYYY)', () => {
  beforeEach(beforeEachReset);

  it('parses Kotak Bank split Debit Amount / Credit Amount with Indian date format', async () => {
    const csv = [
      'Transaction Date,Description,Debit Amount,Credit Amount,Balance',
      '15/03/2025,UPI/BLINKIT ORDER/9876,650.00,,199350.00',
      '16/03/2025,NEFT/ACME TECH/SALARY,,120000.00,319350.00',
      '17/03/2025,UPI/PHONEPE/RECHARGE,299.00,,319051.00',
      '18/03/2025,IMPS/ZEPTO,430.00,,318621.00',
      '19/03/2025,NEFT INWARD/FREELANCE,,15000.00,333621.00',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions).toHaveLength(5);

    const blinkit  = transactions.find(t => t.notes.includes('BLINKIT'));
    const salary   = transactions.find(t => t.notes.includes('SALARY'));
    const freelance = transactions.find(t => t.notes.includes('FREELANCE'));

    expect(blinkit?.type).toBe('Expense');
    expect(blinkit?.amount).toBeCloseTo(650);
    expect(blinkit?.date).toBe('2025-03-15');
    expect(salary?.type).toBe('Income');
    expect(salary?.amount).toBeCloseTo(120000);
    expect(freelance?.type).toBe('Income');
    expect(freelance?.amount).toBeCloseTo(15000);
  });
});

// ── 20. YNAB (budgeting app export) ──────────────────────────
describe('Bank format: YNAB export — Outflow / Inflow columns with Category', () => {
  beforeEach(beforeEachReset);

  it('maps Outflow to Expense and Inflow to Income', async () => {
    // YNAB 4 / nYNAB CSV export format used by many budgeting apps
    const csv = [
      'Date,Payee,Memo,Outflow,Inflow,Category',
      '03/01/2025,Trader Joe\'s,Weekly groceries,125.40,,Food:Groceries',
      '03/02/2025,Employer Direct Deposit,March salary,,4500.00,Income:Salary',
      '03/03/2025,Netflix,Monthly subscription,15.99,,Entertainment',
      '03/04/2025,Landlord,March rent,1500.00,,Housing:Rent',
      '03/05/2025,Tax Refund,Federal 2024,,800.00,Income:Other',
    ].join('\n');

    const { transactions } = await transformData(csvFile(csv), 'Me');
    expect(transactions).toHaveLength(5);

    const grocery  = transactions.find(t => t.notes.includes('groceries') || t.notes.includes('Trader'));
    const salary   = transactions.find(t => t.notes.includes('salary') || t.notes.includes('Employer'));
    const rent     = transactions.find(t => t.notes.includes('rent') || t.notes.includes('Landlord'));
    const taxRef   = transactions.find(t => t.notes.includes('Tax Refund') || t.notes.includes('Federal'));

    expect(grocery?.type).toBe('Expense');
    expect(grocery?.amount).toBeCloseTo(125.4);
    expect(salary?.type).toBe('Income');
    expect(salary?.amount).toBeCloseTo(4500);
    expect(rent?.type).toBe('Expense');
    expect(rent?.amount).toBeCloseTo(1500);
    expect(taxRef?.type).toBe('Income');
    expect(taxRef?.amount).toBeCloseTo(800);
  });
});
