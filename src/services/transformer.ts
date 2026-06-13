import type { Transaction, TransactionType, FileMapping } from '@/types';
import { getFileMappingFromAI, detectFileStructure, extractTransactionsFromPDF } from './gemini';
import { getStoredMapping, saveMapping, getLearnedCategory, applyRules } from './learningRules';

// ============================================================
// File Transformer & Smart Categorization Engine
// ============================================================

import { CONFIG, hasKeyword } from './categorizer';
import { findBestColumn, cleanAmount, parseDate, detectDateFormat, type DateFormatHint } from './parser';
import { deduplicateTransactions, identifyInterAccountTransfers } from './deduplicator';
export { deduplicateTransactions, identifyInterAccountTransfers };

type SignConvention = 'negative-is-expense' | 'positive-is-expense' | 'unsigned';

// Hard upper bound on rows parsed from a single uploaded file. Files larger
// than this are parsed synchronously on the main thread and can lock the UI /
// exhaust memory and local storage. We reject early with a user-facing message
// rather than degrade silently. Applies to both Excel/CSV and PDF imports.
const MAX_ROWS = 50000;

const normalizeDateHint = (raw: string | undefined): DateFormatHint | undefined => {
  if (!raw) return undefined;
  const u = raw.toUpperCase().trim();
  if (u === 'DMY' || u === 'MDY' || u === 'YMD') return u;
  if (/^DD[-\/.]MM[-\/.]YYYY$/i.test(raw)) return 'DMY';
  if (/^MM[-\/.]DD[-\/.]YYYY$/i.test(raw)) return 'MDY';
  if (/^YYYY[-\/.]MM[-\/.]DD$/i.test(raw)) return 'YMD';
  return undefined;
};

/**
 * Returns true when at least half of the non-empty sample cells in `colName`
 * are parseable as numbers. Used to validate that a supposed credit/debit column
 * actually holds monetary amounts and not account names or other text.
 *
 * This guards against transfer-account formats (e.g. AndroMoney) where columns
 * like "Expense(Transfer Out)" / "Income(Transfer In)" hold account names.
 * If Gemini incorrectly flags those as isCreditDebitSeparate=true, the amount
 * column wins as creditColumn and every transaction becomes Income.
 */
const columnContainsNumbers = (header: string[], sampleRows: any[][], colName: string): boolean => {
  const idx = header.indexOf(colName);
  if (idx === -1) return false;
  const vals = sampleRows.map(r => r[idx]).filter(v => v !== '' && v != null);
  if (vals.length === 0) return false;
  const numericCount = vals.filter(v => {
    const cleaned = String(v).replace(/[,₹$€£\s+()]/g, '').replace(/^-/, '');
    return cleaned.length > 0 && !isNaN(parseFloat(cleaned)) && isFinite(Number(cleaned));
  }).length;
  return numericCount / vals.length >= 0.5;
};

/**
 * Returns true when at least 50% of non-empty values in `colName` parse to a
 * valid date via parseDate. Used by validateAndCorrectMapping to confirm the
 * proposed dateColumn actually contains dates (not amounts, IDs, etc.).
 */
const columnContainsDates = (header: string[], sampleRows: any[][], colName: string): boolean => {
  const idx = header.indexOf(colName);
  if (idx === -1) return false;
  const vals = sampleRows.map(r => r[idx]).filter(v => v !== '' && v != null);
  if (vals.length === 0) return false;
  const dateCount = vals.filter(v => parseDate(v) !== null).length;
  return dateCount / vals.length >= 0.5;
};

/**
 * Inspects the amount column on a sample of rows and returns the sign convention
 * used by the file:
 *   - 'negative-is-expense' — file has a meaningful presence of negative values
 *     (standard signed format, e.g. Chase, BofA, German banks: negative = spend)
 *   - 'positive-is-expense' — file uses the inverse convention (rare, but some
 *     budgeting exports record absolute spend as positive and refunds as negative)
 *   - 'unsigned' — all amounts are positive (separate credit/debit columns OR
 *     transfer-account format OR column-name-based classification)
 *
 * If the amount column NAME contains an explicit income/credit keyword AND all
 * sample values are positive, we treat that as unsigned (column meaning wins).
 */
const detectSignConvention = (header: string[], sampleRows: any[][], amountColumn: string | undefined): SignConvention => {
  if (!amountColumn) return 'unsigned';
  const idx = header.indexOf(amountColumn);
  if (idx === -1) return 'unsigned';
  const vals = sampleRows
    .map(r => cleanAmount(r[idx]))
    .filter(v => v !== 0 && !isNaN(v) && isFinite(v));
  if (vals.length < 3) return 'unsigned';
  const negCount = vals.filter(v => v < 0).length;
  const posCount = vals.filter(v => v > 0).length;
  const negRatio = negCount / vals.length;
  const posRatio = posCount / vals.length;
  // If any meaningful share (>=20%) of values are negative, it's a signed column.
  // Within signed, ≥60% negative means most rows are expenses (standard convention:
  // negative=expense). ≥60% positive with a minority of negatives is the same
  // standard convention applied to a mostly-income file (e.g., payslip log).
  if (negRatio >= 0.6) return 'negative-is-expense';
  if (negRatio >= 0.2 && posRatio >= 0.2) return 'negative-is-expense';
  if (posRatio > 0.95) return 'unsigned';
  if (negRatio > 0 && negRatio < 0.2) return 'negative-is-expense';
  return 'unsigned';
};

// --- Core Mapping ---
const applyMapping = (dataRows: any[][], header: string[], mapping: FileMapping, owner: string): Transaction[] => {
  const transactions: Transaction[] = [];

  // Disambiguate DD/MM vs MM/DD once per file using a sample of date values.
  // Caller-supplied mapping.dateFormat (from AI or stored mapping) wins; otherwise
  // we scan up to 50 dates for unambiguous evidence. parseDate falls back to
  // browser locale if neither yields a hint.
  const dateColIdx = mapping.dateColumn ? header.indexOf(mapping.dateColumn) : -1;
  const sampledDates = dateColIdx !== -1
    ? dataRows.slice(0, 50).map(r => r[dateColIdx]).filter(v => v != null && v !== '')
    : [];
  const dateHint: DateFormatHint | undefined =
    normalizeDateHint(mapping.dateFormat) || detectDateFormat(sampledDates) || undefined;

  // Detect the sign convention once per file from the amount column sample.
  // We rely on this in the amountColumn branch instead of a per-row guess so
  // that mixed positive/negative files classify consistently.
  const signConvention = detectSignConvention(header, dataRows.slice(0, 50), mapping.amountColumn);

  dataRows.forEach((row, idx) => {
    const getVal = (colName: string | undefined) => {
      if (!colName) return null;
      const index = header.indexOf(colName);
      return index !== -1 ? row[index] : null;
    };

    const dateVal = parseDate(getVal(mapping.dateColumn), dateHint);
    if (!dateVal || dateVal.year < 1990 || dateVal.year > 2100) return;

    let amount = 0;
    let type: TransactionType = 'Expense';

    // Explicit type column
    const explicitTypeVal = getVal(mapping.typeColumn);
    let explicitType: TransactionType | null = null;
    if (explicitTypeVal) {
      const tStr = String(explicitTypeVal).toLowerCase().trim();
      if (['income', 'credit', 'deposit', 'cr'].some(k => tStr.includes(k))) explicitType = 'Income';
      else if (['expense', 'debit', 'payment', 'dr', 'withdrawal'].some(k => tStr.includes(k))) explicitType = 'Expense';
      else if (['transfer'].some(k => tStr.includes(k))) explicitType = 'Transfer';
    }

    // Amount logic.
    // Order: transfer-account format FIRST (e.g. AndroMoney where "Expense(Transfer Out)"
    // and "Income(Transfer In)" hold account names), THEN credit/debit split (separate
    // debit/credit amount columns), THEN single signed/unsigned amount column.
    //
    // Transfer-account MUST come first because some files (e.g. AndroMoney) have both
    // transfer columns AND an Amount column. If a stored/AI mapping incorrectly also sets
    // isCreditDebitSeparate=true (with creditColumn=amountColumn), putting credit/debit first
    // would cause every row to be classified as Income since the numeric Amount is always >0.
    if (mapping.expenseTransferColumn && mapping.incomeTransferColumn && mapping.amountColumn) {
      amount = Math.abs(cleanAmount(getVal(mapping.amountColumn)));
      const expAcc = String(getVal(mapping.expenseTransferColumn) || '').trim();
      const incAcc = String(getVal(mapping.incomeTransferColumn) || '').trim();
      if (expAcc && incAcc) type = 'Transfer';
      else if (incAcc) type = 'Income';
      else type = 'Expense';
    } else if (mapping.isCreditDebitSeparate && mapping.creditColumn && mapping.debitColumn && mapping.creditColumn !== mapping.debitColumn) {
      const cr = cleanAmount(getVal(mapping.creditColumn));
      const dr = cleanAmount(getVal(mapping.debitColumn));
      if (cr > 0) { amount = cr; type = 'Income'; }
      else if (dr > 0) { amount = dr; type = 'Expense'; }
    } else if (mapping.amountColumn) {
      const rawVal = getVal(mapping.amountColumn);
      const hasPlusSign = String(rawVal).trim().startsWith('+');
      const val = cleanAmount(rawVal);
      amount = Math.abs(val);

      const strVal = String(rawVal).toLowerCase();
      if (/\b(dr|debit)\b/i.test(strVal)) type = 'Expense';
      else if (/\b(cr|credit)\b/i.test(strVal) || hasPlusSign) type = 'Income';
      else if (signConvention === 'negative-is-expense') {
        // File uses signed amounts: negative = expense, positive = income.
        // This is the universal bank convention (Chase, BofA, German banks, etc.)
        type = val < 0 ? 'Expense' : 'Income';
      } else if (signConvention === 'positive-is-expense') {
        type = val > 0 ? 'Expense' : 'Income';
      } else {
        // All-positive amounts: column name is the only signal. Income/Deposit
        // headers → Income; everything else (Amount, Withdrawal, Debit) → Expense.
        const colName = mapping.amountColumn.toLowerCase();
        const incKeys = ['income', 'credit', 'deposit', 'inflow', 'received', 'cr_amount', 'deposit amt'];
        type = incKeys.some(k => colName.includes(k)) ? 'Income' : 'Expense';
      }
    }

    if (explicitType) type = explicitType;
    if (amount === 0) return;

    let category = String(getVal(mapping.categoryColumn) || 'Unclassified').trim();
    let subCategory = String(getVal(mapping.subcategoryColumn) || '').trim();
    let notes = String(getVal(mapping.descriptionColumn) || '').trim();
    const project = String(getVal(mapping.projectColumn) || 'None').trim() || 'None';
    const combinedText = (category + ' ' + subCategory + ' ' + notes).toLowerCase();

    // Smart Categorization Cascade
    const learnedType = applyRules(notes, 'type');
    if (learnedType && ['Income', 'Expense', 'Transfer'].includes(learnedType)) type = learnedType as TransactionType;

    const learnedProject = applyRules(notes, 'project');
    const learnedCat = getLearnedCategory(notes);

    if (learnedCat) {
      category = learnedCat;
      // Also check for a learned subcategory from user edits
      const learnedSubCat = applyRules(notes, 'subCategory');
      if (learnedSubCat) subCategory = learnedSubCat;
    } else if (!category || category === 'Unclassified' || category === 'General' || category === 'SYSTEM') {
      for (const [key, mappedCat] of Object.entries(CONFIG.category_mapping)) {
        if (combinedText.includes(key)) { category = mappedCat; if (!subCategory && notes) subCategory = notes; break; }
      }
      if (!category || category === 'Unclassified') {
        for (const pattern of CONFIG.smart_patterns) {
          if (pattern.regex.test(combinedText)) { category = pattern.category; break; }
        }
      }
    }

    category = category.charAt(0).toUpperCase() + category.slice(1);
    if (!subCategory) subCategory = 'General';
    if (category.toLowerCase() === 'nan' || category === '') category = 'Unclassified';

    if (!explicitType && !learnedType) {
      // Only re-classify based on the description/notes — not the category.
      // Categories like "Credit Card" or "Credit Card Bills" legitimately contain
      // the word "credit" but are spending categories, not income signals.
      if (type === 'Expense' && (hasKeyword(notes, CONFIG.keywords.income) || category === 'Salary' || category === 'Income')) type = 'Income';
      if (category === 'Transfer' || category === 'Credit Card Payment') type = 'Transfer';
    }

    const safeOwner = owner.replace(/[^a-z0-9]/gi, '');
    const safeDesc = notes.substring(0, 10).replace(/[^a-z0-9]/gi, '');
    const id = `${safeOwner}-${dateVal.date}-${amount}-${safeDesc}-${idx}`;

    transactions.push({
      id, owner, type,
      date: dateVal.date, time: dateVal.time,
      category, subCategory, notes, amount,
      original_description: notes,
      project: learnedProject || project,
    });
  });

  return transactions;
};

/**
 * Validates a proposed FileMapping against the actual file sample and either
 * returns a (possibly corrected) mapping or null when the mapping can't produce
 * usable transactions. Runs after BOTH AI and rule-based mapping, before any
 * applyMapping call.
 *
 * Checks:
 *   - dateColumn must reference a column with date-looking values
 *   - amountColumn (when set) must reference a column with numeric values
 *   - if isCreditDebitSeparate, BOTH credit & debit columns must hold numbers
 *     (downgrades isCreditDebitSeparate=false otherwise)
 *   - if expenseTransferColumn/incomeTransferColumn are set but amountColumn is
 *     missing, attempt to infer it via rule-based field synonyms
 *
 * Returns null when the mapping is unsalvageable so the cascade falls through
 * to the next step (e.g., Gemini structure detection).
 */
const validateAndCorrectMapping = (
  mapping: FileMapping | null | undefined,
  header: string[],
  sampleRows: any[][],
): FileMapping | null => {
  if (!mapping || !mapping.dateColumn) return null;

  // 1. Date column must actually contain dates.
  if (!columnContainsDates(header, sampleRows, mapping.dateColumn)) {
    console.info('[transformer] mapping rejected: dateColumn does not contain dates', {
      dateColumn: mapping.dateColumn,
    });
    return null;
  }

  const corrected: FileMapping = { ...mapping };

  // 2a. If expense/income transfer columns collapsed onto the same column (e.g., the
  // rule-based mapper picked the Amount column for both because the substring-match
  // matched "Debit Amount" / "Credit Amount" synonyms), drop them — that's not a real
  // transfer-account format.
  if (
    corrected.expenseTransferColumn &&
    corrected.incomeTransferColumn &&
    corrected.expenseTransferColumn === corrected.incomeTransferColumn
  ) {
    corrected.expenseTransferColumn = undefined;
    corrected.incomeTransferColumn = undefined;
  }

  // 2b. If expense/income "transfer" columns actually contain NUMERIC values (not
  // account names), they're credit/debit amount columns mislabelled by the
  // synonym matcher. "Money Out" / "Money In" / "Withdrawal Amt" / "Deposit Amt"
  // legitimately appear in BOTH expense/income synonym lists AND should be treated
  // as credit/debit. Promote them.
  if (
    !corrected.isCreditDebitSeparate &&
    corrected.expenseTransferColumn &&
    corrected.incomeTransferColumn &&
    corrected.expenseTransferColumn !== corrected.incomeTransferColumn &&
    columnContainsNumbers(header, sampleRows, corrected.expenseTransferColumn) &&
    columnContainsNumbers(header, sampleRows, corrected.incomeTransferColumn)
  ) {
    corrected.debitColumn = corrected.expenseTransferColumn;
    corrected.creditColumn = corrected.incomeTransferColumn;
    corrected.isCreditDebitSeparate = true;
    corrected.expenseTransferColumn = undefined;
    corrected.incomeTransferColumn = undefined;
    if (corrected.amountColumn === corrected.creditColumn || corrected.amountColumn === corrected.debitColumn) {
      corrected.amountColumn = undefined;
    }
  }

  // 3. Credit/Debit split must have BOTH columns numeric. Otherwise demote.
  if (corrected.isCreditDebitSeparate && corrected.creditColumn && corrected.debitColumn) {
    if (corrected.creditColumn === corrected.debitColumn) {
      corrected.isCreditDebitSeparate = false;
    } else {
      const crNumeric = columnContainsNumbers(header, sampleRows, corrected.creditColumn);
      const drNumeric = columnContainsNumbers(header, sampleRows, corrected.debitColumn);
      if (!crNumeric || !drNumeric) {
        console.info('[transformer] credit/debit columns are not both numeric — falling back', {
          creditColumn: corrected.creditColumn,
          debitColumn: corrected.debitColumn,
        });
        corrected.isCreditDebitSeparate = false;
      }
    }
  } else {
    corrected.isCreditDebitSeparate = false;
  }

  // When credit/debit split is confirmed, the transfer-account columns (expenseTransferColumn /
  // incomeTransferColumn) are redundant and would shadow the credit/debit branch in applyMapping
  // because applyMapping checks the transfer-account branch first. Clear them so the correct
  // branch fires. (They were set by getRuleBasedMapping because 'Debit'/'Credit'/'Money Out' etc.
  // appear in both the debit/credit AND the expense/income synonym lists.)
  if (corrected.isCreditDebitSeparate) {
    corrected.expenseTransferColumn = undefined;
    corrected.incomeTransferColumn = undefined;
  }

  // 3. Transfer-account branch needs an amountColumn. Try to recover one.
  if (
    corrected.expenseTransferColumn &&
    corrected.incomeTransferColumn &&
    !corrected.amountColumn &&
    !corrected.isCreditDebitSeparate
  ) {
    const inferred = findBestColumn(header, CONFIG.field_synonyms.amount);
    if (inferred && columnContainsNumbers(header, sampleRows, inferred)) {
      corrected.amountColumn = inferred;
    }
  }

  // 4. amountColumn (when used) must hold numeric values.
  if (
    !corrected.isCreditDebitSeparate &&
    corrected.amountColumn &&
    !columnContainsNumbers(header, sampleRows, corrected.amountColumn)
  ) {
    console.info('[transformer] amountColumn is not numeric — mapping rejected', {
      amountColumn: corrected.amountColumn,
    });
    return null;
  }

  // 5. Reject mappings that lack any way to extract an amount.
  if (
    !corrected.isCreditDebitSeparate &&
    !corrected.amountColumn &&
    !(corrected.expenseTransferColumn && corrected.incomeTransferColumn)
  ) {
    return null;
  }

  return corrected;
};

/**
 * Inspects the extracted transactions for sanity. Logs diagnostic warnings but
 * does NOT silently mutate or filter. The cascade in transformData decides
 * whether to accept the result based on length only — these warnings exist so
 * developers can detect classification bugs from console output.
 */
const auditExtractedTransactions = (transactions: Transaction[], stage: string): void => {
  if (transactions.length === 0) return;
  const total = transactions.length;
  const incomeCount = transactions.filter(t => t.type === 'Income').length;
  const expenseCount = transactions.filter(t => t.type === 'Expense').length;
  const transferCount = transactions.filter(t => t.type === 'Transfer').length;

  if (incomeCount / total > 0.99 && total >= 10) {
    console.warn(
      `[transformer] ${stage}: ${incomeCount}/${total} transactions classified as Income.` +
      ' This is highly suspicious — check the amount/credit/debit column mapping.'
    );
  }
  if (expenseCount / total > 0.99 && total >= 10 && transactions.some(t => t.category === 'Salary')) {
    console.warn(
      `[transformer] ${stage}: ${expenseCount}/${total} are Expense but a "Salary" category appears.` +
      ' Likely a sign-convention misdetection.'
    );
  }
  if (transferCount === total && total >= 5) {
    console.warn(`[transformer] ${stage}: every transaction is a Transfer — verify column mapping.`);
  }
};

/**
 * Returns true when a result set looks pathologically wrong and the cascade should
 * continue trying other mappings. Currently flags two cases:
 *
 *   1. >99% Income on a large file (≥10 tx) — almost never legitimate; the most
 *      common failure mode is Gemini/stored mapping assigning the Amount column as
 *      creditColumn so every positive amount → Income.
 *
 *   2. >99% of a single type when the file demonstrably has mixed-type rows.
 *      (We only trigger case 2 when the file is clearly multi-type, i.e., it has
 *      transfer-account columns present in the header.)
 *
 * Intentionally permissive: a salary-only import that is 100% Income is fine.
 * We only reject when the Income ratio is ≥99% AND the total is large (≥10).
 * Files with < 10 transactions are too small to judge this way.
 */
const isSuspiciousResult = (transactions: Transaction[], header: string[]): boolean => {
  if (transactions.length < 10) return false;
  const total = transactions.length;
  const incomeCount = transactions.filter(t => t.type === 'Income').length;
  // >99% Income is the pathological case we've seen (Amount always > 0 → always Income)
  if (incomeCount / total > 0.99) return true;
  // If the file has transfer-account columns and all results are Expense, that's also wrong
  const hasTransferCols = header.some(h => /expense.*transfer.*out/i.test(h)) &&
                          header.some(h => /income.*transfer.*in/i.test(h));
  if (hasTransferCols) {
    const expenseCount = transactions.filter(t => t.type === 'Expense').length;
    if (expenseCount / total > 0.99) return true;
  }
  return false;
};

const getRuleBasedMapping = (header: string[]): FileMapping => {
  const creditCol = findBestColumn(header, CONFIG.field_synonyms.credit);
  const debitCol = findBestColumn(header, CONFIG.field_synonyms.debit);
  return {
    dateColumn: findBestColumn(header, CONFIG.field_synonyms.date) || '',
    amountColumn: findBestColumn(header, CONFIG.field_synonyms.amount),
    categoryColumn: findBestColumn(header, CONFIG.field_synonyms.category),
    subcategoryColumn: findBestColumn(header, CONFIG.field_synonyms.subcategory),
    descriptionColumn: findBestColumn(header, CONFIG.field_synonyms.description),
    typeColumn: findBestColumn(header, CONFIG.field_synonyms.type),
    projectColumn: findBestColumn(header, CONFIG.field_synonyms.project),
    isCreditDebitSeparate: !!(creditCol && debitCol && creditCol !== debitCol),
    creditColumn: creditCol,
    debitColumn: debitCol,
    expenseTransferColumn: findBestColumn(header, CONFIG.field_synonyms.expense),
    incomeTransferColumn: findBestColumn(header, CONFIG.field_synonyms.income),
  };
};

// --- PDF Support ---
const getPdfJs = async () => {
  try {
    const pdfjsModule = await import('pdfjs-dist');
    const pdfjs = pdfjsModule.default || pdfjsModule;
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;
    }
    return pdfjs;
  } catch (e) {
    throw new Error('PDF Library failed to load. Please try reloading or use CSV/Excel.');
  }
};

export const isPdfEncrypted = async (file: File): Promise<boolean> => {
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') return false;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfjs = await getPdfJs();
    await pdfjs.getDocument({ data: arrayBuffer, disableFontFace: true }).promise;
    return false;
  } catch (err: any) {
    if (err.name === 'PasswordException' || err.code === 1 || err.message?.toLowerCase().includes('password')) return true;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const text = new TextDecoder('iso-8859-1').decode(bytes.subarray(0, Math.min(bytes.length, 50000)));
      return text.includes('/Encrypt') && !text.includes('/Encrypt null');
    } catch { return false; }
  }
};

export const validatePdfPassword = async (file: File, password?: string): Promise<boolean> => {
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') return true;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfjs = await getPdfJs();
    await pdfjs.getDocument({ data: arrayBuffer, password, disableFontFace: true }).promise;
    return true;
  } catch (err: any) {
    return false;
  }
};

export const isExcelEncrypted = async (file: File): Promise<boolean> => {
  const name = file.name.toLowerCase();
  if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) return false;
  try {
    const XLSX = await import('xlsx');
    const arrayBuffer = await file.arrayBuffer();
    XLSX.read(arrayBuffer, { type: 'array' });
    return false;
  } catch (err: any) {
    const errMsg = err.message?.toLowerCase() || '';
    if (errMsg.includes('password') || errMsg.includes('decrypt') || errMsg.includes('encrypt') || errMsg.includes('protected')) {
      return true;
    }
    return false;
  }
};


const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

const promiseWithTimeout = <T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(errorMsg));
    }, ms);
    promise
      .then(res => {
        clearTimeout(timeout);
        resolve(res);
      })
      .catch(err => {
        clearTimeout(timeout);
        reject(err);
      });
  });
};

const extractTextFromEncryptedPDF = async (arrayBuffer: ArrayBuffer, password?: string): Promise<string> => {
  const pdfjs = await getPdfJs();
  const run = async () => {
    try {
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer, password, disableFontFace: true });
      const pdf = await loadingTask.promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map((item: any) => item.str).join('  ') + '\n';
      }
      return fullText;
    } catch (error: any) {
      if (error.name === 'PasswordException' || error.message?.includes('Password') || error.code === 1) {
        throw new Error(password ? 'Incorrect Password. Please try again.' : 'PASSWORD_REQUIRED');
      }
      throw error;
    }
  };

  return promiseWithTimeout(run(), 20000, 'PDF text extraction timed out after 20 seconds');
};

/**
 * Main entry point for file parsing. Returns a list of categorized transactions.
 *
 * Pipeline, in order:
 *   PDF: decrypt → Gemini OCR → transaction list
 *   Excel/CSV: auto-detect header row → try mapping cascade:
 *     1. Cached mapping for this header signature (localStorage)
 *     2. Community format library (shared Supabase presets)
 *     3. Heuristic mapping via field synonyms (validated)
 *     4. Gemini mapping from sample rows (validated)
 *     5. Gemini full-structure detection (last resort)
 *
 * lastHeaders is set for Excel/CSV imports that used a non-cached mapping so
 * the UI can ask the user to confirm the result (driving the community library quality).
 */
export const transformData = async (
  file: File,
  owner: string,
  password?: string,
  signal?: AbortSignal
): Promise<{ transactions: Transaction[]; error?: string; lastHeaders?: string[] }> => {
  // PDF path
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    if (signal?.aborted) throw new Error('CANCELED');
    const arrayBuffer = await file.arrayBuffer();
    if (signal?.aborted) throw new Error('CANCELED');
    let extractionPayload: { base64?: string; text?: string } = {};

    try {
      const base64 = await fileToBase64(file);
      extractionPayload.base64 = base64;
      if (signal?.aborted) throw new Error('CANCELED');

      if (password) {
        try {
          extractionPayload.text = await extractTextFromEncryptedPDF(arrayBuffer, password);
        } catch (e: any) {
          throw new Error(e.message || 'Failed to decrypt PDF');
        }
      } else {
        try {
          extractionPayload.text = await extractTextFromEncryptedPDF(arrayBuffer);
        } catch (e: any) {
          if (e.message === 'PASSWORD_REQUIRED') throw e;
          console.warn('extractTextFromEncryptedPDF failed, falling back to base64:', e);
        }
      }
    } catch (err: any) {
      if (err.message === 'CANCELED' || signal?.aborted) throw new Error('CANCELED');
      if (err.message === 'PASSWORD_REQUIRED' || err.message?.includes('Incorrect Password')) throw err;
      if (password) throw err;
    }

    if (signal?.aborted) throw new Error('CANCELED');

    const rawData = extractionPayload.text
      ? await extractTransactionsFromPDF(extractionPayload.text, true, signal)
      : await extractTransactionsFromPDF(extractionPayload.base64 || '', false, signal);

    if (signal?.aborted) throw new Error('CANCELED');

    if (!rawData?.length) {
      throw new Error(
        'No transactions found in PDF. If you removed this statement\'s password via "Print to PDF" or flattening, the text layer might have been stripped. Try uploading the original password-protected PDF, or convert to CSV/Excel.'
      );
    }

    if (rawData.length > MAX_ROWS) {
      throw new Error(`This file has over ${MAX_ROWS.toLocaleString()} rows. Please split it into smaller files.`);
    }

    const transactions = rawData.map((t: any, i: number) => ({
      id: `${owner.replace(/[^a-z0-9]/gi, '')}-${t.date}-${t.amount}-${(t.description || '').substring(0, 10).replace(/[^a-z0-9]/gi, '')}-${i}`,
      owner, type: t.type as TransactionType, date: t.date, time: null,
      category: t.category, subCategory: '', notes: t.description, amount: t.amount, project: null,
    }));

    return { transactions };
  }

  // Excel/CSV path
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(data, { type: 'array', cellDates: true, dateNF: 'yyyy-mm-dd' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });

        if (rows.length < 2) throw new Error('File appears empty or unreadable');

        if (rows.length > MAX_ROWS) {
          throw new Error(`This file has over ${MAX_ROWS.toLocaleString()} rows. Please split it into smaller files.`);
        }

        // Find header row
        let headerIdx = 0, maxScore = -Infinity;
        const allKeywords = [...CONFIG.field_synonyms.date, ...CONFIG.field_synonyms.amount, ...CONFIG.field_synonyms.description];
        for (let i = 0; i < Math.min(rows.length, 100); i++) {
          const row = rows[i];
          if (row.length < 3) continue;
          let score = 0, nonEmpty = 0;
          row.forEach((cell: any) => {
            if (cell !== null && cell !== undefined && String(cell).trim() !== '') {
              nonEmpty++;
              const cellStr = String(cell).toLowerCase().trim();
              const isNumeric = /^\d+$/.test(cellStr.replace(/[.,-\/]/g, ''));
              if (isNumeric) score -= 3;
              else if (allKeywords.some(k => cellStr.includes(k.toLowerCase()))) score += 3;
              else if (cellStr.length > 2) score += 0.5;
            }
          });
          if (nonEmpty >= 3) score += nonEmpty;
          if (score > maxScore) { maxScore = score; headerIdx = i; }
        }

        const header = rows[headerIdx].map(String);
        const dataRows = rows.slice(headerIdx + 1);
        const sample = dataRows.slice(0, 50);
        let transactions: Transaction[] = [];
        // Tracks the headers used for a non-cached mapping so the UI can ask for
        // confirmation (feeding the community format library quality signal).
        // Only set for community/heuristic/AI steps — not for localStorage cache hits.
        let usedHeaders: string[] | undefined;

        // Helper: validate, apply, audit, and return transactions for a mapping.
        // Returns [] (not null) when validation fails OR the result is suspicious
        // (e.g. >99% Income), so the cascade falls through to the next strategy.
        const tryMapping = (rawMapping: FileMapping | null | undefined, stage: string): Transaction[] => {
          const validated = validateAndCorrectMapping(rawMapping, header, sample);
          if (!validated) return [];
          const result = applyMapping(dataRows, header, validated, owner);
          auditExtractedTransactions(result, stage);
          if (result.length > 0 && isSuspiciousResult(result, header)) {
            console.warn(`[transformer] ${stage}: result flagged as suspicious — trying next mapping strategy`);
            return [];
          }
          return result;
        };

        // 1. Try stored mapping (localStorage cache — user's own prior upload, already confirmed)
        const stored = getStoredMapping(header);
        if (stored) {
          transactions = tryMapping(stored, 'stored-mapping');
          if (transactions.length > 0) {
            resolve({ transactions }); // No confirmation prompt for cached formats
            return;
          }
        }

        // 2. Community format library (shared Supabase presets — async, never blocks)
        if (transactions.length === 0) {
          try {
            const { getSharedMapping } = await import('./formatLibrary');
            const sharedMapping = await getSharedMapping(header);
            if (sharedMapping) {
              transactions = tryMapping(sharedMapping, 'community-mapping');
              if (transactions.length > 0) {
                saveMapping(header, sharedMapping); // Cache locally for next time
                usedHeaders = header;
              }
            }
          } catch { /* silent — never block the import */ }
        }

        // 3. Try rule-based heuristics
        if (transactions.length === 0) {
          const rbMapping = getRuleBasedMapping(header);
          transactions = tryMapping(rbMapping, 'rule-based-mapping');
          if (transactions.length > 0) {
            saveMapping(header, rbMapping);
            usedHeaders = header;
          }
        }

        // 4. Try AI mapping (Gemini column assignment)
        if (transactions.length === 0) {
          try {
            const aiMapping = await getFileMappingFromAI(header, sample);
            if (aiMapping?.dateColumn) {
              transactions = tryMapping(aiMapping, 'ai-mapping');
              if (transactions.length > 0) {
                saveMapping(header, aiMapping);
                usedHeaders = header;
                // Submit to community library in background — don't await
                import('./formatLibrary').then(({ submitFormatPreset }) => {
                  submitFormatPreset(header, aiMapping);
                }).catch(() => {});
              }
            }
          } catch (err) { console.warn('AI Mapping failed:', err); }
        }

        // 5. Try AI structure detection (last resort — Gemini re-finds the header row)
        if (transactions.length === 0) {
          try {
            const structure = await detectFileStructure(rows.slice(0, 50));
            if (structure && structure.headerIndex !== -1 && structure.mapping?.dateColumn) {
              const newHeader = rows[structure.headerIndex].map(String);
              const newDataRows = rows.slice(structure.headerIndex + 1);
              const newSample = newDataRows.slice(0, 50);
              const validated = validateAndCorrectMapping(structure.mapping, newHeader, newSample);
              if (validated) {
                transactions = applyMapping(newDataRows, newHeader, validated, owner);
                auditExtractedTransactions(transactions, 'ai-structure-detect');
                if (transactions.length > 0 && !isSuspiciousResult(transactions, newHeader)) {
                  saveMapping(newHeader, validated);
                  usedHeaders = newHeader;
                  // Submit to community library in background — don't await
                  import('./formatLibrary').then(({ submitFormatPreset }) => {
                    submitFormatPreset(newHeader, validated);
                  }).catch(() => {});
                } else if (isSuspiciousResult(transactions, newHeader)) {
                  transactions = [];
                }
              }
            }
          } catch (err) { console.error('AI Recovery Failed:', err); }
        }

        // 6. Absolute worst-case: treat CSV/Excel as raw text and pass it to Gemini's direct statement parser
        if (transactions.length === 0) {
          try {
            if (signal?.aborted) throw new Error('CANCELED');
            console.log('Layout mapping failed. Serializing CSV/Excel to raw text for direct AI extraction fallback...');
            const rawTextContent = rows
              .map(row => row.map(cell => String(cell ?? '')).join(','))
              .join('\n');
            const trimmedText = rawTextContent.length > 80000 ? rawTextContent.slice(0, 80000) : rawTextContent;
            if (signal?.aborted) throw new Error('CANCELED');
            const rawParsed = await extractTransactionsFromPDF(trimmedText, true, signal);
            if (rawParsed && rawParsed.length > 0) {
              transactions = rawParsed.map((t: any, i: number) => ({
                id: `${owner.replace(/[^a-z0-9]/gi, '')}-${t.date}-${t.amount}-${(t.description || '').substring(0, 10).replace(/[^a-z0-9]/gi, '')}-${i}`,
                owner, type: t.type as TransactionType, date: t.date, time: null,
                category: t.category, subCategory: '', notes: t.description, amount: t.amount, project: null,
              }));
              auditExtractedTransactions(transactions, 'ai-raw-text-fallback');
            }
          } catch (err) {
            console.warn('AI Raw Text Fallback Failed:', err);
          }
        }

        if (transactions.length === 0) throw new Error('Could not extract transactions. Check if file has Date and Amount columns.');
        resolve({ transactions, lastHeaders: usedHeaders });
      } catch (err: any) { reject(err); }
    };
    reader.onerror = () => reject(new Error('File reading failed'));
    reader.readAsArrayBuffer(file);
  });
};