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
  const areSimilar = (d1: string, d2: string) => {
    if (hasTransferKeyword(d1) && hasTransferKeyword(d2)) return true;
    const t1 = getTokens(d1), t2 = getTokens(d2);
    return t1.filter(token => t2.includes(token)).length > 0;
  };

  const groups = new Map<string, Transaction[]>();
  transactions.forEach(t => {
    if (!groups.has(t.date)) groups.set(t.date, []);
    groups.get(t.date)!.push(t);
  });

  groups.forEach(group => {
    if (group.length < 2) return;
    const incomes = group.filter(t => t.type === 'Income');
    const expenses = group.filter(t => t.type === 'Expense');
    if (!incomes.length || !expenses.length) return;

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
        transferCount++;
        expenses.splice(matchIndex, 1);
      }
    });
  });

  return { transactions, transferCount };
};
