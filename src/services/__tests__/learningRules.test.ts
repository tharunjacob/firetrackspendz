import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the supabase module so saveRule stays local and no real network hits.
vi.mock('../supabase', () => ({
  supabase: null,
  getSupabase: vi.fn(),
  isCloudEnabled: () => false,
}));
vi.mock('../logger', () => ({ logEvent: vi.fn() }));

// vitest 4.x + jsdom exposes a localStorage that misbehaves (clear() is missing
// and writes sometimes don't persist). Install a minimal in-memory stub.
const memoryStore: Record<string, string> = {};
const stub = {
  getItem: (k: string) => (k in memoryStore ? memoryStore[k] : null),
  setItem: (k: string, v: string) => { memoryStore[k] = String(v); },
  removeItem: (k: string) => { delete memoryStore[k]; },
  clear: () => { for (const k of Object.keys(memoryStore)) delete memoryStore[k]; },
  key: (i: number) => Object.keys(memoryStore)[i] ?? null,
  get length() { return Object.keys(memoryStore).length; },
};
Object.defineProperty(window, 'localStorage', { configurable: true, value: stub });

// Import AFTER mocks so the module picks up the mocked supabase=null path.
import {
  getFileSignature,
  getStoredMapping,
  saveMapping,
  applyRules,
  getLearnedCategory,
  saveRule,
  createRuleFromEdit,
  initializeRules,
  getAllRules,
} from '../learningRules';

describe('getFileSignature', () => {
  it('produces the same signature regardless of header order', () => {
    const a = getFileSignature(['Date', 'Amount', 'Description']);
    const b = getFileSignature(['Description', 'Date', 'Amount']);
    expect(a).toBe(b);
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(getFileSignature(['Date', ' amount ', 'DESC'])).toBe(
      getFileSignature(['date', 'AMOUNT', 'desc']),
    );
  });

  it('returns empty string on empty input', () => {
    expect(getFileSignature([])).toBe('');
  });
});

describe('getStoredMapping / saveMapping round-trip', () => {
  beforeEach(() => { window.localStorage.clear(); });

  it('persists a mapping and reads it back by header signature', () => {
    const headers = ['Date', 'Amount', 'Description'];
    const mapping = {
      dateColumn: 'Date',
      amountColumn: 'Amount',
      descriptionColumn: 'Description',
      isCreditDebitSeparate: false,
    };
    saveMapping(headers, mapping);
    expect(getStoredMapping(headers)).toEqual(mapping);
    // Header reorder still matches — signature is order-insensitive
    expect(getStoredMapping(['Amount', 'Description', 'Date'])).toEqual(mapping);
  });

  it('returns null when no mapping is stored', () => {
    expect(getStoredMapping(['No', 'Match'])).toBe(null);
  });
});

describe('saveRule + applyRules', () => {
  beforeEach(async () => {
    // initializeRules on a nulled supabase resets the cache.
    await initializeRules();
  });

  it('does nothing on empty keyword', async () => {
    await saveRule('   ', 'Food', 'category', 'active');
    expect(getAllRules()).toHaveLength(0);
  });

  it('matches active rules by case-insensitive substring', async () => {
    await saveRule('zomato', 'Food', 'category', 'active');
    expect(applyRules('UPI ZOMATO ORDER', 'category')).toBe('Food');
    expect(applyRules('zomato dinner', 'category')).toBe('Food');
    expect(applyRules('uber ride', 'category')).toBe(null);
  });

  it('ignores pending rules until promoted', async () => {
    await saveRule('netflix', 'Entertainment', 'category', 'pending');
    expect(applyRules('NETFLIX MONTHLY', 'category')).toBe(null);
  });

  it('prefers the longest matching keyword (specificity wins)', async () => {
    await saveRule('amazon', 'Shopping', 'category', 'active');
    await saveRule('amazon prime', 'Entertainment', 'category', 'active');
    expect(applyRules('amazon prime video sub', 'category')).toBe('Entertainment');
    expect(applyRules('amazon shopping order', 'category')).toBe('Shopping');
  });

  it('scopes matches by target_field', async () => {
    await saveRule('bonus', 'Income', 'type', 'active');
    expect(applyRules('year end BONUS', 'type')).toBe('Income');
    // Same text, different field — no rule for category
    expect(applyRules('year end BONUS', 'category')).toBe(null);
  });

  it('returns null on empty text', () => {
    expect(applyRules('', 'category')).toBe(null);
  });
});

describe('getLearnedCategory', () => {
  beforeEach(async () => { await initializeRules(); });

  it('is a shortcut for applyRules on the category field', async () => {
    await saveRule('starbucks', 'Food', 'category', 'active');
    expect(getLearnedCategory('Paid at Starbucks')).toBe('Food');
  });
});

describe('createRuleFromEdit', () => {
  beforeEach(async () => { await initializeRules(); });

  it('creates a rule from original bank description', async () => {
    const made = await createRuleFromEdit(
      { notes: 'Coffee run', original_description: 'UPI-STARBUCKS-REF123' },
      'category',
      'Food',
    );
    expect(made).toBe(true);
    expect(applyRules('upi-starbucks-ref123', 'category')).toBe('Food');
  });

  it('falls back to notes when original_description is missing', async () => {
    const made = await createRuleFromEdit(
      { notes: 'Dominos pizza dinner' },
      'category',
      'Food',
    );
    expect(made).toBe(true);
  });

  it('skips rules with too-short keywords', async () => {
    const made = await createRuleFromEdit({ notes: 'hi' }, 'category', 'Food');
    expect(made).toBe(false);
  });

  it('skips meaningless values', async () => {
    const made = await createRuleFromEdit(
      { notes: 'Some transaction', original_description: 'Some transaction' },
      'category',
      'Unclassified',
    );
    expect(made).toBe(false);
  });
});
