import { describe, it, expect } from 'vitest';
import { deduplicateTransactions, identifyInterAccountTransfers } from '../transformer';
import type { Transaction } from '@/types';

// Helper to create mock transactions
const createTx = (
  id: string,
  owner: string,
  date: string,
  amount: number,
  notes: string = '',
  type: 'Income' | 'Expense' | 'Transfer' = 'Expense'
): Transaction => ({
  id,
  owner,
  date,
  amount,
  notes,
  type,
  category: 'Test',
  subCategory: '',
  time: null,
  project: null,
});

describe('Deduplication Engine', () => {
  it('handles empty lists', () => {
    const { unique, duplicateCount } = deduplicateTransactions([], []);
    expect(unique.length).toBe(0);
    expect(duplicateCount).toBe(0);

    const existing = [createTx('1', 'Me', '2025-01-01', 100)];
    const res = deduplicateTransactions(existing, []);
    expect(res.unique.length).toBe(0);
  });

  it('keeps incoming transactions if no existing data', () => {
    const incoming = [createTx('1', 'Me', '2025-01-01', 100)];
    const { unique, duplicateCount } = deduplicateTransactions([], incoming);
    expect(unique).toHaveLength(1);
    expect(duplicateCount).toBe(0);
  });

  it('detects exact same transaction (same owner, date, amount, description)', () => {
    const existing = [createTx('1', 'Me', '2025-01-01', 150.5, 'Starbucks Coffee')];
    const incoming = [createTx('2', 'Me', '2025-01-01', 150.5, 'Starbucks Coffee')];

    const { unique, duplicateCount } = deduplicateTransactions(existing, incoming);
    expect(unique).toHaveLength(0);
    expect(duplicateCount).toBe(1);
  });

  it('keeps transactions with different dates', () => {
    const existing = [createTx('1', 'Me', '2025-01-01', 150.5, 'Starbucks Coffee')];
    const incoming = [createTx('2', 'Me', '2025-01-02', 150.5, 'Starbucks Coffee')];

    const { unique, duplicateCount } = deduplicateTransactions(existing, incoming);
    expect(unique).toHaveLength(1);
    expect(duplicateCount).toBe(0);
  });

  it('detects fuzzy duplicates (similar description on same day with same amount)', () => {
    const existing = [createTx('1', 'Me', '2025-01-01', 50, 'Zomato Online Order #1234')];
    const incoming = [createTx('2', 'Me', '2025-01-01', 50, 'Zomato Online Order')]; // Fuzzy match

    const { unique, duplicateCount } = deduplicateTransactions(existing, incoming);
    expect(unique).toHaveLength(0);
    expect(duplicateCount).toBe(1);
  });

  it('allows same daily amounts if descriptions are completely different (false positive prevention)', () => {
    const existing = [createTx('1', 'Me', '2025-01-01', 20, 'Uber Ride')];
    const incoming = [createTx('2', 'Me', '2025-01-01', 20, 'Starbucks Coffee')]; // Same date and amount, different desc

    const { unique, duplicateCount } = deduplicateTransactions(existing, incoming);
    expect(unique).toHaveLength(1);
    expect(duplicateCount).toBe(0);
  });

  it('maintains cross-owner independence', () => {
    const existing = [createTx('1', 'Me', '2025-01-01', 100, 'Lunch')];
    const incoming = [createTx('2', 'Wife', '2025-01-01', 100, 'Lunch')]; // Same everything but owner

    const { unique, duplicateCount } = deduplicateTransactions(existing, incoming);
    expect(unique).toHaveLength(1);
    expect(duplicateCount).toBe(0);
  });

  it('removes all duplicates when same file is uploaded twice', () => {
    const file = [
      createTx('1', 'Me', '2025-01-01', 100, 'Amazon Order'),
      createTx('2', 'Me', '2025-01-02', 50, 'Uber'),
      createTx('3', 'Me', '2025-01-03', 25, 'Coffee'),
    ];
    const reupload = file.map((t, i) => ({ ...t, id: `dup-${i}` }));
    const { unique, duplicateCount } = deduplicateTransactions(file, reupload);
    expect(unique).toHaveLength(0);
    expect(duplicateCount).toBe(3);
  });

  it('keeps both txns when same date+amount but completely different descriptions', () => {
    const existing = [createTx('1', 'Me', '2025-01-01', 200, 'Random Merchant Name')];
    const incoming = [createTx('2', 'Me', '2025-01-01', 200, 'Totally Unrelated Vendor')];
    const { unique, duplicateCount } = deduplicateTransactions(existing, incoming);
    expect(unique).toHaveLength(1);
    expect(duplicateCount).toBe(0);
  });

  it('treats numbered orders from same merchant as duplicates by token overlap', () => {
    // SWIGGY ORDER 123 vs SWIGGY ORDER 124 — token overlap is high
    const existing = [createTx('1', 'Me', '2025-01-01', 350, 'SWIGGY ORDER 123')];
    const incoming = [createTx('2', 'Me', '2025-01-01', 350, 'SWIGGY ORDER 124')];
    const { unique, duplicateCount } = deduplicateTransactions(existing, incoming);
    expect(unique).toHaveLength(0);
    expect(duplicateCount).toBe(1);
  });

  it('dedups same transaction across formats (CSV vs PDF descriptions)', () => {
    const existing = [createTx('1', 'Me', '2025-01-01', 500, 'UPI-SWIGGY-123456')];
    const incoming = [createTx('2', 'Me', '2025-01-01', 500, 'UPI SWIGGY 123456')];
    const { unique, duplicateCount } = deduplicateTransactions(existing, incoming);
    expect(unique).toHaveLength(0);
    expect(duplicateCount).toBe(1);
  });

  it('multi-file scenario: 100 txns + 80 txns with 30 overlap → 150 total', () => {
    const fileA: Transaction[] = [];
    for (let i = 0; i < 100; i++) {
      fileA.push(createTx(`a-${i}`, 'Me', `2025-01-${String((i % 28) + 1).padStart(2, '0')}`, 10 + i, `Merchant A ${i}`));
    }
    // File B: 30 overlap with file A (first 30 entries identical), 50 new
    const fileB: Transaction[] = [];
    for (let i = 0; i < 30; i++) {
      fileB.push(createTx(`b-${i}`, 'Me', fileA[i].date, fileA[i].amount, fileA[i].notes));
    }
    for (let i = 0; i < 50; i++) {
      fileB.push(createTx(`b-new-${i}`, 'Me', `2025-02-${String((i % 28) + 1).padStart(2, '0')}`, 1000 + i, `Merchant B ${i}`));
    }

    // Mimics processFiles: dedup B against A, then merge
    const { unique: bUnique } = deduplicateTransactions(fileA, fileB);
    const merged = [...fileA, ...bUnique];
    expect(bUnique).toHaveLength(50);
    expect(merged).toHaveLength(150);
  });

  it('"bought coffee twice" — same fingerprint within ONE file, both kept', () => {
    // The hardest case: user really did buy two ₹350 Starbucks coffees on the same day.
    // The file lists both as separate line items. Dedup must NOT collapse them.
    const incoming = [
      createTx('1', 'Me', '2025-01-01', 350, 'Starbucks Coffee'),
      createTx('2', 'Me', '2025-01-01', 350, 'Starbucks Coffee'),
    ];
    const { unique, duplicateCount } = deduplicateTransactions([], incoming);
    expect(unique).toHaveLength(2);
    expect(duplicateCount).toBe(0);
  });

  it('"bought coffee twice" with existing data — within-batch dups still kept', () => {
    // Existing has nothing on this day. New file has two identical rows.
    // Both must pass through; dedup is only against existing.
    const existing = [createTx('e', 'Me', '2024-12-31', 999, 'Old')];
    const incoming = [
      createTx('1', 'Me', '2025-01-01', 350, 'Starbucks Coffee'),
      createTx('2', 'Me', '2025-01-01', 350, 'Starbucks Coffee'),
    ];
    const { unique, duplicateCount } = deduplicateTransactions(existing, incoming);
    expect(unique).toHaveLength(2);
    expect(duplicateCount).toBe(0);
  });

  it('does not double-collapse: existing has one Starbucks, file has another two', () => {
    // Real scenario: user bought one yesterday (already in cloud), buys two more today.
    // Today's two should both be kept (legitimate, within-batch). Re-uploading the file
    // would correctly remove all three on second upload.
    const existing = [createTx('e', 'Me', '2025-01-01', 350, 'Starbucks Coffee')];
    const incoming = [
      createTx('1', 'Me', '2025-01-02', 350, 'Starbucks Coffee'),
      createTx('2', 'Me', '2025-01-02', 350, 'Starbucks Coffee'),
    ];
    const { unique, duplicateCount } = deduplicateTransactions(existing, incoming);
    expect(unique).toHaveLength(2);
    expect(duplicateCount).toBe(0);
  });
});

describe('Inter-Account Transfers Detection', () => {
  it('detects transfers between accounts', () => {
    const txns = [
      createTx('1', 'Me', '2025-01-01', 500, 'Self Transfer to HDFC', 'Expense'),
      createTx('2', 'Wife', '2025-01-01', 500, 'Transfer from ICICI', 'Income'),
      createTx('3', 'Me', '2025-01-01', 50, 'Starbucks', 'Expense') // Unrelated
    ];

    const { transactions, transferCount } = identifyInterAccountTransfers(txns);
    expect(transferCount).toBe(1);
    
    // Original array is mutated, so we check properties
    const expTrans = transactions.find(t => t.id === '1');
    const incTrans = transactions.find(t => t.id === '2');
    const unrelated = transactions.find(t => t.id === '3');

    expect(expTrans?.type).toBe('Transfer');
    expect(incTrans?.type).toBe('Transfer');
    expect(unrelated?.type).toBe('Expense');
  });

  it('requires similar keywords to match a transfer', () => {
    const txns = [
      createTx('1', 'Me', '2025-01-01', 500, 'Amazon Purchase', 'Expense'), // Not a transfer
      createTx('2', 'Me', '2025-01-01', 500, 'Salary Bonus', 'Income'), // Not a transfer
    ];

    const { transferCount } = identifyInterAccountTransfers(txns);
    expect(transferCount).toBe(0);
  });
});

describe('Refunds Detection', () => {
  it('detects refunds within the same account', () => {
    const txns = [
      createTx('1', 'CreditCard', '2026-05-02', 1622.82, 'Wasteland Entertainmen Gurgaon', 'Expense'),
      createTx('2', 'CreditCard', '2026-05-07', 1622.82, 'District Movie Ticket Gurugram', 'Income'),
    ];

    const { transactions, transferCount } = identifyInterAccountTransfers(txns);
    expect(transferCount).toBe(1);

    const exp = transactions.find(t => t.id === '1');
    const inc = transactions.find(t => t.id === '2');

    expect(exp?.type).toBe('Transfer');
    expect(exp?.category).toBe('Transfer');
    expect(exp?.subCategory).toBe('Refund');

    expect(inc?.type).toBe('Transfer');
    expect(inc?.category).toBe('Transfer');
    expect(inc?.subCategory).toBe('Refund');
  });

  it('rejects refund if owner/account is different', () => {
    const txns = [
      createTx('1', 'CreditCardA', '2026-05-02', 100, 'Some Merchant', 'Expense'),
      createTx('2', 'CreditCardB', '2026-05-07', 100, 'Some Merchant Refund', 'Income'),
    ];

    const { transferCount } = identifyInterAccountTransfers(txns);
    expect(transferCount).toBe(0);
  });

  it('rejects refund if date difference is > 10 days', () => {
    const txns = [
      createTx('1', 'CreditCard', '2026-05-02', 100, 'Some Merchant', 'Expense'),
      createTx('2', 'CreditCard', '2026-05-13', 100, 'Some Merchant Refund', 'Income'),
    ];

    const { transferCount } = identifyInterAccountTransfers(txns);
    expect(transferCount).toBe(0);
  });

  it('rejects refund if descriptions are not similar', () => {
    const txns = [
      createTx('1', 'CreditCard', '2026-05-02', 100, 'Some Merchant', 'Expense'),
      createTx('2', 'CreditCard', '2026-05-07', 100, 'Totally Unrelated Shop', 'Income'),
    ];

    const { transferCount } = identifyInterAccountTransfers(txns);
    expect(transferCount).toBe(0);
  });
});
