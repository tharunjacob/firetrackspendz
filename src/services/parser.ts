import { CONFIG } from './categorizer';

export const levenshtein = (a: string, b: string): number => {
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const ind = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + ind);
    }
  }
  return matrix[b.length][a.length];
};

export const getSimilarity = (s1: string, s2: string): number => {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  if (longer.length === 0) return 1.0;
  return (longer.length - levenshtein(longer, shorter)) / longer.length;
};

/**
 * Score-based column matcher. Tries each (column, candidate) pair and returns the
 * column with the highest score. Scoring band (higher wins):
 *   1.00  exact case-insensitive match (immediate return)
 *   0.95  column starts with or ends with candidate
 *   0.90  one fully contains the other AND the shorter side ≥ 3 chars
 *   0.70-0.95  Levenshtein similarity above 0.7 threshold
 *
 * Exact matches always win over partial matches, so a column "Income" never gets
 * picked when a synonym list contains both "Income" and "Income(Transfer In)" and
 * one of those is the literal header. Logs scoring details when DEV mode is set.
 */
export const findBestColumn = (columns: string[], candidates: string[]): string | undefined => {
  let bestMatch: string | undefined;
  let bestScore = 0;
  const debug = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development';
  const trace: Array<{ col: string; cand: string; score: number; reason: string }> = [];

  for (const col of columns) {
    if (!col) continue;
    const colLower = String(col).toLowerCase().trim();
    if (CONFIG.field_synonyms.ignore_columns.some(ig => colLower.includes(ig.toLowerCase()))) continue;
    for (const cand of candidates) {
      const candLower = cand.toLowerCase().trim();
      let score = 0;
      let reason = '';

      if (colLower === candLower) {
        // Exact match short-circuits — nothing beats this.
        if (debug) trace.push({ col, cand, score: 1, reason: 'exact' });
        return col;
      }
      if (colLower.startsWith(candLower) || colLower.endsWith(candLower)) {
        // Col is at least as specific as cand (col === cand handled by exact branch above).
        // Don't accept the inverse — cand starts/ends with col — because that means col is
        // SHORTER than cand and matching loses meaning (e.g., "Amount" inside "Debit Amount").
        if (colLower.length >= candLower.length && candLower.length >= 3) {
          score = 0.95; reason = 'col contains cand (prefix/suffix)';
        }
      }
      if (score === 0 && colLower.includes(candLower)) {
        // Col is more specific than cand. Acceptable.
        if (candLower.length >= 3) { score = 0.9; reason = 'col contains cand (substring)'; }
      }
      // Note: we deliberately do NOT match when cand contains col (i.e., col is a generic
      // substring of a more specific synonym). That caused "Amount" to match both
      // "Debit Amount" and "Credit Amount" synonyms simultaneously, making the rule-based
      // mapper assign the same Amount column to expenseTransferColumn AND incomeTransferColumn.
      if (score === 0) {
        const sim = getSimilarity(colLower, candLower);
        if (sim > 0.7) { score = sim; reason = 'levenshtein'; }
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = col;
      }
      if (debug && score > 0) trace.push({ col, cand, score, reason });
    }
  }
  if (debug && bestMatch) {
    // eslint-disable-next-line no-console
    console.info('[findBestColumn]', { winner: bestMatch, score: bestScore, candidates: trace.slice(0, 5) });
  }
  return bestMatch;
};

export const isNA = (val: any) => val === null || val === undefined || String(val).trim() === '' || String(val).toLowerCase() === 'nan';

/**
 * Parses bank-statement amounts handling US/UK/India and European number formats.
 *
 * Examples:
 *   "1,234.56"       → 1234.56  (US/UK/India: comma=thousands, dot=decimal)
 *   "€ 1.234,56"     → 1234.56  (European: dot=thousands, comma=decimal)
 *   "1 234,56"       → 1234.56  (French: space=thousands, comma=decimal)
 *   "1,00,000.50"    → 100000.5 (Indian lakh grouping; commas dropped)
 *   "(500.00)"       → -500     (accounting parens)
 *   "-350" / "₹ 1,500" → -350 / 1500
 */
export const cleanAmount = (val: any): number => {
  if (isNA(val)) return 0;
  let str = String(val).trim();
  const isNegative = (str.startsWith('(') && str.endsWith(')')) || str.startsWith('-');

  // Strip currency symbols, letters, spaces — keep digits and the two possible separators.
  str = str.replace(/[^\d.,]/g, '');
  // Drop leading or trailing separator artifacts left over from prefixes like "Rs." or
  // suffixes like "USD." (we don't want a stray "." to look like the start of a decimal).
  str = str.replace(/^[.,]+/, '').replace(/[.,]+$/, '');

  if (!str) return 0;

  const lastComma = str.lastIndexOf(',');
  const lastDot = str.lastIndexOf('.');

  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      // European: 1.234,56 — dots are thousands separators, comma is decimal
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // US/UK/India: 1,234.56 — commas are thousands separators
      str = str.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    // Only commas. Two cases:
    //   "1,234"   → thousands grouping (3 digits after the only comma)
    //   "1,56"    → European decimal (1 or 2 digits after)
    //   "1,00,000" → Indian lakh grouping (multiple commas, drop all)
    const commaCount = (str.match(/,/g) || []).length;
    const afterComma = str.substring(lastComma + 1);
    if (commaCount > 1 || afterComma.length === 3) {
      str = str.replace(/,/g, '');
    } else {
      str = str.replace(',', '.');
    }
  }
  // Else: only dots or no separators — leave as-is.

  // Final cleanup: keep only digits and a single dot
  str = str.replace(/[^\d.]/g, '');
  if (!str) return 0;

  const num = parseFloat(str);
  if (isNaN(num)) return 0;
  return isNegative ? -Math.abs(num) : Math.abs(num);
};

const SHORT_MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

const FULL_MONTHS: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
};

const monthFromName = (name: string): string | null => {
  const lower = name.toLowerCase();
  return FULL_MONTHS[lower] || SHORT_MONTHS[lower.substring(0, 3)] || null;
};

export type DateFormatHint = 'DMY' | 'MDY' | 'YMD';

/**
 * Decides whether a numeric date like "03/07/2025" should be read as DD/MM (March 7→Mar 7? no:
 * "03/07" = day 3, month 7 = July 3rd) or MM/DD (March 7th).
 *
 * Strategy:
 *   1. If any sample has p1 > 12, the file is unambiguously DD/MM.
 *   2. If any sample has p2 > 12, the file is unambiguously MM/DD.
 *   3. Otherwise fall back to caller-supplied hint or browser locale.
 */
export const detectDateFormat = (samples: any[]): DateFormatHint | null => {
  let hasDmyEvidence = false;
  let hasMdyEvidence = false;
  for (const s of samples) {
    if (s == null) continue;
    const str = String(s).trim();
    // Skip ISO and named-month formats — they're already unambiguous
    if (/^\d{4}[-/.]/.test(str)) continue;
    if (/[a-zA-Z]/.test(str)) continue;
    const m = str.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/);
    if (!m) continue;
    const p1 = parseInt(m[1]);
    const p2 = parseInt(m[2]);
    if (p1 > 12 && p2 <= 12) hasDmyEvidence = true;
    if (p2 > 12 && p1 <= 12) hasMdyEvidence = true;
  }
  if (hasDmyEvidence && !hasMdyEvidence) return 'DMY';
  if (hasMdyEvidence && !hasDmyEvidence) return 'MDY';
  if (hasDmyEvidence && hasMdyEvidence) return 'DMY'; // mixed/conflicting — DMY is safer globally
  return null;
};

const localeFallback = (): DateFormatHint => {
  try {
    const lang = typeof navigator !== 'undefined' ? navigator.language || '' : '';
    return /^en-US/i.test(lang) ? 'MDY' : 'DMY';
  } catch {
    return 'DMY';
  }
};

/**
 * Parses a date value into a normalized YYYY-MM-DD string.
 *
 * Supports:
 *   - Date objects (from xlsx cellDates)
 *   - YYYYMMDD compact form
 *   - YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD (ISO and variants, with optional time)
 *   - DD/MM/YYYY, MM/DD/YYYY, DD.MM.YYYY (German), DD-MM-YYYY (DMY/MDY disambiguated by hint)
 *   - DD-Mon-YYYY, DD Mon YYYY ("07 March 2025", "7-Jan-25")
 *   - "March 7, 2025" / "Mar 7 2025" (US long form)
 *
 * `hint` resolves DD/MM vs MM/DD ambiguity when both fields are ≤12. When omitted,
 * falls back to browser locale (en-US → MDY, else DMY).
 */
export const parseDate = (val: any, hint?: DateFormatHint): { date: string; time: string; year: number } | null => {
  if (isNA(val)) return null;
  const timeStr = '00:00';

  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    const y = val.getFullYear(), m = String(val.getMonth() + 1).padStart(2, '0'), d = String(val.getDate()).padStart(2, '0');
    return { date: `${y}-${m}-${d}`, time: timeStr, year: y };
  }

  const str = String(val).trim();

  // YYYYMMDD compact
  if (/^\d{8}$/.test(str)) {
    const y = str.slice(0, 4), m = str.slice(4, 6), d = str.slice(6, 8);
    const yy = parseInt(y), mm = parseInt(m), dd = parseInt(d);
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return { date: `${y}-${m}-${d}`, time: timeStr, year: yy };
    }
  }

  // ISO variants: YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD (with optional time suffix — time is stripped)
  const isoMatch = str.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:[T ]\d{2}:\d{2})?/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1]), m = parseInt(isoMatch[2]), d = parseInt(isoMatch[3]);
    if (y >= 1990 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return { date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, time: timeStr, year: y };
    }
  }

  // Named-month formats: "07 March 2025", "7-Jan-25", "March 7, 2025", "Mar 7 2025"
  const named1 = str.match(/^(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s,](\d{2,4})/);
  if (named1) {
    const mon = monthFromName(named1[2]);
    if (mon) {
      const d = parseInt(named1[1]);
      let y = parseInt(named1[3]);
      if (y < 100) y += y < 50 ? 2000 : 1900;
      return { date: `${y}-${mon}-${String(d).padStart(2, '0')}`, time: timeStr, year: y };
    }
  }
  const named2 = str.match(/^([A-Za-z]{3,9})\s+(\d{1,2})[,\s]+(\d{4})/);
  if (named2) {
    const mon = monthFromName(named2[1]);
    if (mon) {
      const d = parseInt(named2[2]), y = parseInt(named2[3]);
      return { date: `${y}-${mon}-${String(d).padStart(2, '0')}`, time: timeStr, year: y };
    }
  }

  // DD/MM/YYYY, MM/DD/YYYY, DD.MM.YYYY etc. — disambiguated by hint
  const numMatch = str.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/);
  if (numMatch) {
    let p1 = parseInt(numMatch[1]), p2 = parseInt(numMatch[2]);
    let y = parseInt(numMatch[3]);
    if (y < 100) y += y < 50 ? 2000 : 1900;
    let d: number, m: number;
    // Unambiguous: if one part exceeds 12 it can only be the day, not the month.
    if (p1 > 12 && p2 <= 12) { d = p1; m = p2; }        // e.g. 25/03/2025 → DMY
    else if (p2 > 12 && p1 <= 12) { m = p1; d = p2; }   // e.g. 03/25/2025 → MDY
    else {
      // Both ≤ 12 — ambiguous, use hint or locale.
      const effectiveHint = hint || localeFallback();
      if (effectiveHint === 'DMY') { d = p1; m = p2; }
      else { m = p1; d = p2; }
    }
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return { date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, time: timeStr, year: y };
    }
  }

  return null;
};