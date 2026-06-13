import type { Transaction } from '@/types';
import { getSimilarity } from './parser';

/**
 * Removes incoming transactions that already exist in `existing`.
 *
 * Within-batch duplicates are intentionally KEPT: if a single uploaded file lists
 * "Starbucks $5.00" twice on the same day, both are real (the user bought coffee
 * twice). Dedup only fires across uploads/sources, never within one batch.
 */
export const deduplicateTransactions = (
  existing: Transaction[],
  incoming: Transaction[]
): { unique: Transaction[]; duplicateCount: number } => {
  if (existing.length === 0) return { unique: incoming, duplicateCount: 0 };

  // Index built ONLY from `existing` and never mutated. New items from `incoming`
  // are not added — that's what allows two identical same-day rows in one file
  // (e.g., coffee twice) to both pass through.
  const fingerprints = new Set<string>();
  const fuzzyIndex = new Map<string, Transaction[]>(); // date+amount → transactions

  existing.forEach(t => {
    // Exact fingerprint: date + amount (2 decimal) + owner
    const exact = `${t.date}|${t.amount.toFixed(2)}|${t.owner}`;
    fingerprints.add(exact);

    // Fuzzy key: date + amount (for cross-description matching)
    const fuzzyKey = `${t.date}|${t.amount.toFixed(2)}`;
    if (!fuzzyIndex.has(fuzzyKey)) fuzzyIndex.set(fuzzyKey, []);
    fuzzyIndex.get(fuzzyKey)!.push(t);
  });

  let duplicateCount = 0;
  const unique: Transaction[] = [];

  incoming.forEach(t => {
    // 1. Exact match: same date + amount + owner
    const exactKey = `${t.date}|${t.amount.toFixed(2)}|${t.owner}`;
    if (fingerprints.has(exactKey)) {
      // Check description similarity to avoid false positives
      // (same amount on same day from same account could be legit if descriptions differ significantly)
      const fuzzyKey = `${t.date}|${t.amount.toFixed(2)}`;
      const candidates = fuzzyIndex.get(fuzzyKey) || [];
      const sameOwnerCandidates = candidates.filter(c => c.owner === t.owner);

      const isDup = sameOwnerCandidates.some(c => {
        const d1 = (c.notes || c.category).toLowerCase().trim();
        const d2 = (t.notes || t.category).toLowerCase().trim();
        // Empty descriptions or same descriptions → duplicate
        if (!d1 || !d2) return true;
        if (d1 === d2) return true;
        // Check token overlap (>50% shared tokens = likely duplicate)
        const t1 = d1.replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2);
        const t2 = d2.replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2);
        if (t1.length === 0 || t2.length === 0) return true;
        const shared = t1.filter(tok => t2.includes(tok)).length;
        return shared / Math.min(t1.length, t2.length) >= 0.5;
      });

      if (isDup) {
        duplicateCount++;
        return;
      }
    }

    // 2. Fuzzy match: same date + amount but different owner (could still be duplicate from re-upload)
    const fuzzyKey = `${t.date}|${t.amount.toFixed(2)}`;
    const candidates = fuzzyIndex.get(fuzzyKey) || [];
    if (candidates.some(c => {
      if (c.owner !== t.owner) return false; // Only dedup within same owner
      const d1 = (c.notes || '').toLowerCase();
      const d2 = (t.notes || '').toLowerCase();
      return d1 === d2 || getSimilarity(d1, d2) > 0.85;
    })) {
      duplicateCount++;
      return;
    }

    unique.push(t);
  });

  return { unique, duplicateCount };
};

export const identifyInterAccountTransfers = (transactions: Transaction[]): { transactions: Transaction[]; transferCount: number } => {
  let transferCount = 0;
  const TRANSFER_KEYWORDS = ['transfer', 'upi', 'neft', 'imps', 'rtgs', 'payment', 'trf', 'self', 'zelle', 'venmo', 'wire', 'sepa'];

  const hasTransferKeyword = (str: string) => TRANSFER_KEYWORDS.some(k => str.toLowerCase().includes(k));
  const getTokens = (str: string) => str.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(x => x.length > 2);

  // Substantial token overlap — NOT a single incidental shared word. A lone common
  // token (a city, "online", "payment") used to be enough to fuse two unrelated
  // rows into a phantom transfer/refund, silently erasing real money from totals.
  // We accept a match when either the shorter description's tokens are fully
  // contained in the longer one (e.g. "Amazon" vs "Amazon Marketplace Order") or
  // there are ≥2 shared tokens covering ≥50% of the shorter description.
  const strongTokenOverlap = (d1: string, d2: string): boolean => {
    const t1 = getTokens(d1), t2 = getTokens(d2);
    if (!t1.length || !t2.length) return false;
    const shared = t1.filter(token => t2.includes(token)).length;
    const minLen = Math.min(t1.length, t2.length);
    return shared === minLen || (shared >= 2 && shared / minLen >= 0.5);
  };

  const areSimilar = (d1: string, d2: string) => {
    if (hasTransferKeyword(d1) && hasTransferKeyword(d2)) return true;
    return strongTokenOverlap(d1, d2);
  };

  const groups = new Map<string, Transaction[]>();
  transactions.forEach(t => {
    if (!groups.has(t.date)) groups.set(t.date, []);
    groups.get(t.date)!.push(t);
  });

  // 1. Identify inter-account transfers (different owners, same date + amount, similar descriptions)
  // We run this in three rounds:
  // - Round 1: Match Income with Expense (standard transfer pairing)
  // - Round 2: Match remaining Income with Transfer (where the Transfer is the debit leg)
  // - Round 3: Match remaining Expense with Transfer (where the Transfer is the credit leg)
  groups.forEach(group => {
    if (group.length < 2) return;

    const matchedIds = new Set<string>();

    const getUnmatched = (type: 'Income' | 'Expense' | 'Transfer') =>
      group.filter(t => t.type === type && !matchedIds.has(t.id));

    // Round 1: Income with Expense
    let incomes = getUnmatched('Income');
    let expenses = getUnmatched('Expense');

    incomes.forEach(inc => {
      const matchIndex = expenses.findIndex(exp => {
        if (Math.abs(Math.abs(inc.amount) - Math.abs(exp.amount)) > 0.01) return false;
        if (inc.owner === exp.owner) return false;
        return areSimilar(inc.notes || inc.category, exp.notes || exp.category);
      });

      if (matchIndex !== -1) {
        const exp = expenses[matchIndex];
        inc.type = 'Transfer'; inc.category = 'Transfer'; inc.subCategory = 'Inter-Account';
        exp.type = 'Transfer'; exp.category = 'Transfer'; exp.subCategory = 'Inter-Account';
        matchedIds.add(inc.id);
        matchedIds.add(exp.id);
        transferCount++;
        expenses.splice(matchIndex, 1);
      }
    });

    // Round 2: Remaining Income with existing Transfer
    incomes = getUnmatched('Income');
    let transfers = getUnmatched('Transfer');

    incomes.forEach(inc => {
      const matchIndex = transfers.findIndex(trf => {
        if (Math.abs(Math.abs(inc.amount) - Math.abs(trf.amount)) > 0.01) return false;
        if (inc.owner === trf.owner) return false;
        return areSimilar(inc.notes || inc.category, trf.notes || trf.category);
      });

      if (matchIndex !== -1) {
        const trf = transfers[matchIndex];
        inc.type = 'Transfer'; inc.category = 'Transfer'; inc.subCategory = 'Inter-Account';
        trf.category = 'Transfer'; trf.subCategory = 'Inter-Account';
        matchedIds.add(inc.id);
        matchedIds.add(trf.id);
        transferCount++;
        transfers.splice(matchIndex, 1);
      }
    });

    // Round 3: Remaining Expense with existing Transfer
    expenses = getUnmatched('Expense');
    transfers = getUnmatched('Transfer');

    expenses.forEach(exp => {
      const matchIndex = transfers.findIndex(trf => {
        if (Math.abs(Math.abs(exp.amount) - Math.abs(trf.amount)) > 0.01) return false;
        if (exp.owner === trf.owner) return false;
        return areSimilar(exp.notes || exp.category, trf.notes || trf.category);
      });

      if (matchIndex !== -1) {
        const trf = transfers[matchIndex];
        exp.type = 'Transfer'; exp.category = 'Transfer'; exp.subCategory = 'Inter-Account';
        trf.category = 'Transfer'; trf.subCategory = 'Inter-Account';
        matchedIds.add(exp.id);
        matchedIds.add(trf.id);
        transferCount++;
        transfers.splice(matchIndex, 1);
      }
    });
  });

  // 2. Identify refunds (same owner/account, date difference <= 10 days, similar descriptions)
  const getDateDiffInDays = (d1: string, d2: string): number => {
    const date1 = new Date(`${d1}T00:00:00Z`);
    const date2 = new Date(`${d2}T00:00:00Z`);
    if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return 999;
    const diffTime = Math.abs(date1.getTime() - date2.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const areRefundDescriptionsSimilar = (inc: Transaction, exp: Transaction): boolean => {
    const d1 = (inc.notes || inc.category || '').toLowerCase();
    const d2 = (exp.notes || exp.category || '').toLowerCase();

    // An explicit refund/reversal marker is strong evidence on its own — paired with
    // the same owner, exact amount, and ≤10-day window the caller already enforces,
    // this is a confident refund. ("credited" was removed: it's too generic — e.g.
    // "Salary credited" / "Interest credited" would falsely reverse real income.)
    const isRefundKeyword = (s: string) => /\b(refund|reversal|rvsl|rtn|return|chargeback|reversed)\b/i.test(s);
    if (isRefundKeyword(d1) || isRefundKeyword(d2)) return true;

    // Otherwise require substantial merchant-name overlap. (Previously a single
    // shared token — or a hardcoded movie-ticket regex overfit to one developer's
    // own statement — was enough, which produced phantom refunds.)
    return strongTokenOverlap(d1, d2);
  };

  // Refund matching — only look at transactions that weren't already tagged as Transfer
  // (inter-account transfer section above may have tagged some)
  // Round 1: Exact description matches first
  let remainingIncomes = transactions.filter(t => t.type === 'Income');
  let remainingExpenses = transactions.filter(t => t.type === 'Expense');

  remainingIncomes.forEach(inc => {
    if (inc.type !== 'Income') return; // skip if already tagged by another round
    const matchIndex = remainingExpenses.findIndex(exp => {
      if (exp.type !== 'Expense') return false; // skip if already tagged
      if (inc.owner !== exp.owner) return false;
      if (Math.abs(inc.amount - exp.amount) > 0.01) return false;
      if (getDateDiffInDays(inc.date, exp.date) > 10) return false;

      const d1 = (inc.notes || '').toLowerCase().trim();
      const d2 = (exp.notes || '').toLowerCase().trim();
      return d1 && d2 && d1 === d2;
    });

    if (matchIndex !== -1) {
      const exp = remainingExpenses[matchIndex];
      inc.type = 'Transfer'; inc.category = 'Transfer'; inc.subCategory = 'Refund';
      exp.type = 'Transfer'; exp.category = 'Transfer'; exp.subCategory = 'Refund';
      transferCount++;
      remainingExpenses.splice(matchIndex, 1);
    }
  });

  // Round 2: Fuzzy/Heuristic matches for the remainder
  // Re-filter both lists to get only still-untagged transactions
  remainingIncomes = transactions.filter(t => t.type === 'Income');
  remainingExpenses = transactions.filter(t => t.type === 'Expense'); // ← must refresh, inter-account may have tagged some
  remainingIncomes.forEach(inc => {
    if (inc.type !== 'Income') return; // skip if already tagged
    const matchIndex = remainingExpenses.findIndex(exp => {
      if (exp.type !== 'Expense') return false; // skip if already tagged
      if (inc.owner !== exp.owner) return false;
      if (Math.abs(inc.amount - exp.amount) > 0.01) return false;
      if (getDateDiffInDays(inc.date, exp.date) > 10) return false;
      return areRefundDescriptionsSimilar(inc, exp);
    });

    if (matchIndex !== -1) {
      const exp = remainingExpenses[matchIndex];
      inc.type = 'Transfer'; inc.category = 'Transfer'; inc.subCategory = 'Refund';
      exp.type = 'Transfer'; exp.category = 'Transfer'; exp.subCategory = 'Refund';
      transferCount++;
      remainingExpenses.splice(matchIndex, 1);
    }
  });

  return { transactions, transferCount };
};
