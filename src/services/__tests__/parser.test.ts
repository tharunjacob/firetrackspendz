import { describe, it, expect } from 'vitest';
import { parseDate, cleanAmount, findBestColumn, detectDateFormat } from '../parser';
import { CONFIG } from '../categorizer';

describe('parseDate', () => {
  it('parses ISO YYYY-MM-DD', () => {
    expect(parseDate('2025-03-07')).toEqual({ date: '2025-03-07', time: '00:00', year: 2025 });
  });

  it('parses ISO with time and strips time portion', () => {
    expect(parseDate('2025-03-07T14:30:00')).toEqual({ date: '2025-03-07', time: '00:00', year: 2025 });
  });

  it('parses YYYY/MM/DD and YYYY.MM.DD', () => {
    expect(parseDate('2025/03/07')?.date).toBe('2025-03-07');
    expect(parseDate('2025.03.07')?.date).toBe('2025-03-07');
  });

  it('parses YYYYMMDD compact form', () => {
    expect(parseDate('20250307')?.date).toBe('2025-03-07');
  });

  it('parses Date objects from xlsx cellDates', () => {
    expect(parseDate(new Date(2025, 2, 7))?.date).toBe('2025-03-07');
  });

  it('uses DMY when day part > 12 (unambiguous)', () => {
    expect(parseDate('25/03/2025')?.date).toBe('2025-03-25');
    expect(parseDate('25-03-2025')?.date).toBe('2025-03-25');
  });

  it('uses MDY when middle part > 12 (unambiguous)', () => {
    expect(parseDate('03/25/2025')?.date).toBe('2025-03-25');
  });

  it('respects DMY hint when both parts ≤ 12', () => {
    // 03/07/2025 with DMY hint → 7th March
    expect(parseDate('03/07/2025', 'DMY')?.date).toBe('2025-07-03');
  });

  it('respects MDY hint when both parts ≤ 12', () => {
    // 03/07/2025 with MDY hint → March 7th
    expect(parseDate('03/07/2025', 'MDY')?.date).toBe('2025-03-07');
  });

  it('parses 2-digit year as 20YY', () => {
    expect(parseDate('07/03/25', 'DMY')?.year).toBe(2025);
  });

  it('parses German DD.MM.YYYY format', () => {
    expect(parseDate('07.03.2025', 'DMY')?.date).toBe('2025-03-07');
    // Unambiguous case (day > 12)
    expect(parseDate('25.03.2025')?.date).toBe('2025-03-25');
  });

  it('parses DD-Mon-YY (short month abbreviation)', () => {
    expect(parseDate('07-Mar-25')?.date).toBe('2025-03-07');
    expect(parseDate('07-MAR-2025')?.date).toBe('2025-03-07');
  });

  it('parses DD Mon YYYY with full month names', () => {
    expect(parseDate('07 March 2025')?.date).toBe('2025-03-07');
    expect(parseDate('7 March 2025')?.date).toBe('2025-03-07');
  });

  it('parses Mon DD, YYYY (US long form)', () => {
    expect(parseDate('March 7, 2025')?.date).toBe('2025-03-07');
    expect(parseDate('Mar 7, 2025')?.date).toBe('2025-03-07');
    expect(parseDate('March 7 2025')?.date).toBe('2025-03-07');
  });

  it('returns null for empty/invalid input', () => {
    expect(parseDate(null)).toBeNull();
    expect(parseDate('')).toBeNull();
    expect(parseDate('not a date')).toBeNull();
  });

  it('returns null for impossible dates', () => {
    // Month > 12 in both positions → bogus
    expect(parseDate('20250307', undefined)).not.toBeNull(); // valid
    expect(parseDate('99999999')).toBeNull();
  });
});

describe('detectDateFormat', () => {
  it('returns DMY when any sample has first part > 12', () => {
    expect(detectDateFormat(['25/03/2025', '07/03/2025'])).toBe('DMY');
  });

  it('returns MDY when any sample has second part > 12', () => {
    expect(detectDateFormat(['03/25/2025', '03/07/2025'])).toBe('MDY');
  });

  it('returns null when all samples are ambiguous', () => {
    expect(detectDateFormat(['03/07/2025', '04/05/2025'])).toBeNull();
  });

  it('skips ISO and named-month formats during detection', () => {
    expect(detectDateFormat(['2025-03-07', 'March 7, 2025'])).toBeNull();
  });

  it('handles empty / null entries gracefully', () => {
    expect(detectDateFormat([null, '', undefined as any, '25/03/2025'])).toBe('DMY');
  });
});

describe('cleanAmount', () => {
  it('parses plain decimals', () => {
    expect(cleanAmount('1234.56')).toBeCloseTo(1234.56);
    expect(cleanAmount(1234.56)).toBeCloseTo(1234.56);
  });

  it('parses US/UK format "1,234.56"', () => {
    expect(cleanAmount('1,234.56')).toBeCloseTo(1234.56);
    expect(cleanAmount('$ 1,234.56')).toBeCloseTo(1234.56);
    expect(cleanAmount('£1,234.56')).toBeCloseTo(1234.56);
  });

  it('parses European format "1.234,56" (German/Italian)', () => {
    expect(cleanAmount('1.234,56')).toBeCloseTo(1234.56);
    expect(cleanAmount('€ 1.234,56')).toBeCloseTo(1234.56);
    expect(cleanAmount('1.234.567,89')).toBeCloseTo(1234567.89);
  });

  it('parses French format with space as thousands separator', () => {
    expect(cleanAmount('1 234,56')).toBeCloseTo(1234.56);
    expect(cleanAmount('1 234 567,89')).toBeCloseTo(1234567.89);
  });

  it('parses single-comma decimal "12,50"', () => {
    expect(cleanAmount('12,50')).toBeCloseTo(12.5);
  });

  it('parses single-comma thousands "1,234"', () => {
    expect(cleanAmount('1,234')).toBeCloseTo(1234);
  });

  it('parses Indian lakh notation "1,00,000.50"', () => {
    expect(cleanAmount('1,00,000.50')).toBeCloseTo(100000.5);
    expect(cleanAmount('₹ 12,34,567.89')).toBeCloseTo(1234567.89);
  });

  it('handles accounting parentheses as negative', () => {
    expect(cleanAmount('(500.00)')).toBe(-500);
    expect(cleanAmount('(1,234.56)')).toBeCloseTo(-1234.56);
  });

  it('handles leading minus sign', () => {
    expect(cleanAmount('-350')).toBe(-350);
    expect(cleanAmount('-1,234.56')).toBeCloseTo(-1234.56);
  });

  it('strips currency symbols and INR prefixes', () => {
    expect(cleanAmount('₹ 1,500')).toBe(1500);
    expect(cleanAmount('₹12,345')).toBe(12345); // no space, comma thousands
    expect(cleanAmount('$1,234')).toBe(1234);
    expect(cleanAmount('£1,234')).toBe(1234);
    expect(cleanAmount('Rs. 1,500.50')).toBeCloseTo(1500.5);
    expect(cleanAmount('USD 99.99')).toBeCloseTo(99.99);
  });

  it('returns 0 for empty / NA / non-numeric', () => {
    expect(cleanAmount(null)).toBe(0);
    expect(cleanAmount('')).toBe(0);
    expect(cleanAmount('NaN')).toBe(0);
    expect(cleanAmount('abc')).toBe(0);
  });
});

describe('findBestColumn — international headers', () => {
  it('matches German date headers', () => {
    expect(findBestColumn(['Buchungstag', 'Betrag', 'Verwendungszweck'], CONFIG.field_synonyms.date))
      .toBe('Buchungstag');
  });

  it('matches German amount header', () => {
    expect(findBestColumn(['Buchungstag', 'Betrag', 'Verwendungszweck'], CONFIG.field_synonyms.amount))
      .toBe('Betrag');
  });

  it('matches German description header', () => {
    expect(findBestColumn(['Buchungstag', 'Betrag', 'Verwendungszweck'], CONFIG.field_synonyms.description))
      .toBe('Verwendungszweck');
  });

  it('matches French headers', () => {
    const headers = ['Date d\'opération', 'Libellé', 'Montant', 'Solde'];
    expect(findBestColumn(headers, CONFIG.field_synonyms.amount)).toBe('Montant');
    expect(findBestColumn(headers, CONFIG.field_synonyms.description)).toBe('Libellé');
    // Solde (balance) should be ignored
    expect(findBestColumn(headers, CONFIG.field_synonyms.amount)).not.toBe('Solde');
  });

  it('matches Spanish headers', () => {
    const headers = ['Fecha', 'Concepto', 'Importe'];
    expect(findBestColumn(headers, CONFIG.field_synonyms.date)).toBe('Fecha');
    expect(findBestColumn(headers, CONFIG.field_synonyms.amount)).toBe('Importe');
    expect(findBestColumn(headers, CONFIG.field_synonyms.description)).toBe('Concepto');
  });

  it('still matches plain English headers', () => {
    const headers = ['Date', 'Amount', 'Description'];
    expect(findBestColumn(headers, CONFIG.field_synonyms.date)).toBe('Date');
    expect(findBestColumn(headers, CONFIG.field_synonyms.amount)).toBe('Amount');
    expect(findBestColumn(headers, CONFIG.field_synonyms.description)).toBe('Description');
  });
});
