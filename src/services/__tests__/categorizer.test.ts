import { describe, it, expect } from 'vitest';
import { CONFIG, hasKeyword } from '../categorizer';

describe('hasKeyword', () => {
  it('matches whole words case-insensitively', () => {
    expect(hasKeyword('Paid at STARBUCKS', ['starbucks'])).toBe(true);
    expect(hasKeyword('SALARY CREDIT', ['salary', 'wage'])).toBe(true);
  });

  it('does not match partial substrings (whole-word only)', () => {
    expect(hasKeyword('supermarket run', ['super'])).toBe(false);
    expect(hasKeyword('unaffordable', ['afford'])).toBe(false);
  });

  it('returns false when no keywords given', () => {
    expect(hasKeyword('anything', [])).toBe(false);
  });

  it('safely handles regex metacharacters in keywords', () => {
    expect(() => hasKeyword('a+b test', ['a+b'])).not.toThrow();
    expect(hasKeyword('AT&T bill', ['at&t'])).toBe(true);
  });
});

describe('CONFIG.category_mapping', () => {
  it('maps common Indian merchants to expected categories', () => {
    expect(CONFIG.category_mapping['swiggy']).toBe('Food');
    expect(CONFIG.category_mapping['zomato']).toBe('Food');
    expect(CONFIG.category_mapping['uber']).toBe('Transport');
    expect(CONFIG.category_mapping['amazon']).toBe('Shopping');
  });

  it('maps common US merchants to expected categories', () => {
    expect(CONFIG.category_mapping['starbucks']).toBe('Food');
    expect(CONFIG.category_mapping['lyft']).toBe('Transport');
    expect(CONFIG.category_mapping['netflix']).toBe('Entertainment');
  });

  it('routes utility payments to Utilities', () => {
    expect(CONFIG.category_mapping['electricity']).toBe('Utilities');
    expect(CONFIG.category_mapping['verizon']).toBe('Utilities');
    expect(CONFIG.category_mapping['broadband']).toBe('Utilities');
  });

  it('routes loan/mortgage to EMI/Housing', () => {
    expect(CONFIG.category_mapping['loan']).toBe('EMI');
    expect(CONFIG.category_mapping['mortgage']).toBe('Housing');
    expect(CONFIG.category_mapping['rent']).toBe('Housing');
  });
});

describe('CONFIG.smart_patterns', () => {
  const matchCategory = (text: string): string | null => {
    for (const p of CONFIG.smart_patterns) if (p.regex.test(text)) return p.category;
    return null;
  };

  it('detects UPI/Zelle food transfers as Food', () => {
    expect(matchCategory('UPI-ZOMATO ONLINE ORDER')).toBe('Food');
    expect(matchCategory('ZELLE SWIGGY LUNCH')).toBe('Food');
  });

  it('classifies ATM withdrawals as Cash', () => {
    expect(matchCategory('ATM WDL @ 123 MAIN ST')).toBe('Cash');
    expect(matchCategory('ATM CASH WITHDRAWAL')).toBe('Cash');
  });

  it('classifies generic transfer prefixes as Transfer', () => {
    expect(matchCategory('NEFT 000123 TO HDFC')).toBe('Transfer');
    expect(matchCategory('WIRE TRANSFER')).toBe('Transfer');
  });

  it('classifies loan/EMI keywords as EMI', () => {
    expect(matchCategory('SBI HOME LOAN EMI')).toBe('EMI');
    expect(matchCategory('monthly mortgage payment')).toBe('EMI');
  });

  it('routes direct debits to Bill Payment', () => {
    expect(matchCategory('DD Electricity Board')).toBe('Bill Payment');
    expect(matchCategory('DIRECT DEBIT Council Tax')).toBe('Bill Payment');
  });

  it('does not false-match unrelated text', () => {
    expect(matchCategory('Normal purchase at store')).toBe(null);
  });
});

describe('CONFIG.field_synonyms', () => {
  it('covers common amount column names across banks', () => {
    const { amount } = CONFIG.field_synonyms;
    expect(amount).toContain('Amount');
    expect(amount).toContain('Debit');
    expect(amount).toContain('Credit Amount');
  });

  it('does not conflate Balance columns with Amount', () => {
    expect(CONFIG.field_synonyms.ignore_columns).toContain('Balance');
    expect(CONFIG.field_synonyms.amount).not.toContain('Balance');
  });
});
