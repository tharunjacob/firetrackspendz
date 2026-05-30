import type { FileMapping } from '@/types';
import type { AssetFileMapping } from '@/types/assets';
import { callAIProxy, isAIProxyAvailable } from './aiProxy';
import type { GeminiContents } from './aiProxy';

// ============================================================
// Gemini AI Service
// All API calls route through aiProxy.ts — never calls Gemini
// directly from this file. See supabase/functions/ai-proxy/.
// ============================================================

const cleanJSON = (text: string | undefined): string => {
  if (!text) return '{}';
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```(json)?/, '').replace(/```$/, '');
  return cleaned.trim();
};

/** True when AI is accessible (via edge function or dev fallback key). */
export const isAIAvailable = () => isAIProxyAvailable();

/**
 * Sends a pre-built summary to Gemini and returns 3–5 personalized strategies as a
 * markdown-ish string. Returns a placeholder string (not throw) if AI is unavailable
 * or the call fails — caller just renders the returned text.
 */
export const generateFinancialInsights = async (summary: string): Promise<string> => {
  if (!isAIProxyAvailable()) return 'AI Insights unavailable. Configure the Gemini API key or deploy the AI proxy.';
  try {
    const prompt = `
      You are a world-class financial advisor AI. Based on this financial summary, provide 3-5 unique, personalized, and actionable strategies.
      Avoid generic advice like "spend less". Suggest specific actions, challenges, or mindset shifts.
      Frame positively, focusing on opportunities. Each insight should start with a relevant emoji.

      Financial Summary:
      ${summary}

      Provide expert, creative, and actionable insights:
    `;
    return await callAIProxy({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }) || 'No insights generated.';
  } catch (error) {
    console.error('Gemini API error:', error);
    return 'Unable to generate insights. Please try again later.';
  }
};

/**
 * Chat-style follow-up for the AI Advisor tab. `history` is the user-visible chat log;
 * only the last 10 messages are sent to keep prompts small. Never throws.
 */
export const getStrategicAdvice = async (
  context: string,
  question: string,
  history: { role: 'user' | 'bot'; text: string }[] = []
): Promise<string> => {
  if (!isAIProxyAvailable()) return 'AI Service Unavailable.';
  try {
    const recentHistory = history.slice(-10).map(m => `${m.role === 'user' ? 'USER' : 'AI CFO'}: ${m.text}`).join('\n');
    const prompt = `
      You are TrackSpendZ AI, a strategic CFO for personal finance.
      CONTEXT: ${context}
      PREVIOUS CONVERSATION: ${recentHistory}
      CURRENT QUESTION: "${question}"
      Answer specifically using the context. Be concise, encouraging, and professional.
    `;
    return await callAIProxy({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }) || 'Could not generate response.';
  } catch { return 'Error connecting to AI Advisor.'; }
};

/**
 * Asks Gemini to emit a JSON array of typed insights (warning/tip/achievement/anomaly).
 * Returns the raw JSON string so the caller can parse — returns '[]' on any failure.
 */
export const generateProactiveInsights = async (summary: string): Promise<string> => {
  if (!isAIProxyAvailable()) return '[]';
  try {
    const prompt = `
      Analyze this spending data and generate 3-5 proactive insights as JSON array.
      Each insight: { "type": "warning"|"tip"|"achievement"|"anomaly", "title": "short title", "message": "1-2 sentence insight", "severity": "low"|"medium"|"high" }

      Focus on:
      - Budget overruns (warning)
      - Savings opportunities (tip)
      - Positive streaks (achievement)
      - Unusual spending patterns (anomaly)

      Data: ${summary}

      Return ONLY valid JSON array, no markdown.
    `;
    const text = await callAIProxy({ contents: [{ role: 'user', parts: [{ text: prompt }] }], jsonMode: true });
    return cleanJSON(text);
  } catch { return '[]'; }
};

/**
 * Asks Gemini to map the given headers to our FileMapping shape. Used as a fallback
 * when heuristic column detection misses. Returns null on failure, never throws.
 */
export const getFileMappingFromAI = async (headers: string[], sampleRows: any[][]): Promise<FileMapping | null> => {
  if (!isAIProxyAvailable()) return null;
  try {
    const prompt = `
      You are a bank statement column mapper. Map the file's columns to standard fields.
      Return JSON with these fields:
        dateColumn, dateFormat, amountColumn, categoryColumn, subcategoryColumn, descriptionColumn,
        typeColumn, projectColumn, isCreditDebitSeparate (boolean), creditColumn, debitColumn,
        expenseTransferColumn, incomeTransferColumn,
        confidence (object: { dateColumn: 0-1, amountColumn: 0-1, creditDebitSplit: 0-1 }).

      Headers may be in any language (German "Buchungstag"/"Betrag", French "Date d'opération"/
      "Montant", Spanish "Fecha"/"Importe", Japanese "日付"/"金額", Hindi "तारीख"/"राशि", etc.).
      Map them to the standard English field names above. Use the EXACT original header
      text from the file as the value for each *Column field.

      dateFormat must be one of: "DMY" (e.g., 25/03/2025), "MDY" (e.g., 03/25/2025), or "YMD"
      (e.g., 2025-03-25). Infer it from the sample dates — if any date has the first part > 12
      it must be DMY; if the second part > 12 it must be MDY. When ambiguous, use the format
      most common in the file's apparent locale.

      ====== FORMAT PATTERNS — distinguish carefully ======

      FORMAT A — Credit/Debit split (BOTH columns hold MONETARY NUMBERS):
        Typical headers: "Debit Amount" / "Credit Amount", "Withdrawal" / "Deposit",
                         "Withdrawal Amt." / "Deposit Amt.", "Money Out" / "Money In",
                         "Dr Amount" / "Cr Amount", "Soll" / "Haben" (German).
        Each row has a number in ONE of the two columns, blank in the other.
        → Set isCreditDebitSeparate=true, creditColumn=<deposit/credit header>, debitColumn=<withdrawal/debit header>.
        → amountColumn should usually be EMPTY for this format.

      FORMAT B — Transfer-account / envelope format (columns hold ACCOUNT NAMES, NOT amounts):
        Typical headers: "Expense(Transfer Out)" / "Income(Transfer In)",
                         "From Account" / "To Account".
        Values look like: "HDFC Savings", "Cash", "Credit Card" — NOT numbers.
        There is ALWAYS a separate numeric "Amount" column with positive values only.
        → Set isCreditDebitSeparate=FALSE.
        → Set expenseTransferColumn=<expense/from header>, incomeTransferColumn=<income/to header>.
        → Set amountColumn=<the numeric amount header>.

      FORMAT C — Single signed-amount column (the most common bank export):
        One numeric column with both positive and negative values.
        Convention: NEGATIVE = expense (money out), POSITIVE = income (money in).
        Common in US (Chase, BofA), UK, and European banks (German "Betrag").
        → Set amountColumn=<header>, leave isCreditDebitSeparate=false, no creditColumn/debitColumn.

      FORMAT D — All-positive amount with a separate Type / Dr-Cr indicator column:
        Amount values are all positive; a separate column says "Dr"/"Cr" or "Debit"/"Credit".
        → Set amountColumn=<numeric header>, typeColumn=<Dr/Cr header>.

      ====== HARD RULES — do not violate ======
      - NEVER set isCreditDebitSeparate=true unless both candidate columns contain NUMBERS
        in the sample data. If the column contains account names or text, it is NOT credit/debit.
      - The "Balance" / "Running Balance" / "Available Balance" / "Saldo" / "Solde" column is
        NOT an amount. Leave it UNMAPPED (do not assign it to amountColumn).
      - A "Category" / "Sub-Category" column is NOT a typeColumn. typeColumn only applies to
        columns that explicitly indicate Debit vs Credit (e.g., "Dr/Cr", "Direction", "Type").
      - For Format B (transfer-account), creditColumn and debitColumn MUST be undefined/empty.

      Headers: ${JSON.stringify(headers)}
      Sample Data (${sampleRows.length} rows): ${JSON.stringify(sampleRows)}
    `;
    const text = await callAIProxy({ contents: [{ role: 'user', parts: [{ text: prompt }] }], jsonMode: true });
    if (!text) return null;
    const parsed = JSON.parse(cleanJSON(text)) as FileMapping & { confidence?: Record<string, number> };
    // Strip the confidence object — it's only used to hint Gemini and is not part of FileMapping.
    delete (parsed as any).confidence;
    return parsed as FileMapping;
  } catch (error) {
    console.warn('AI Mapping Error:', error);
    return null;
  }
};

/**
 * Last-resort file parser: given raw rows (including preamble), asks Gemini to pick
 * the header row and map its columns. Used when neither stored nor heuristic mapping
 * extracted any transactions. Returns null on failure.
 */
export const detectFileStructure = async (rawRows: any[][]): Promise<{ headerIndex: number; mapping: FileMapping } | null> => {
  if (!isAIProxyAvailable()) return null;
  try {
    const prompt = `
      I have a raw financial file. First 50 rows: ${JSON.stringify(rawRows)}
      1. Identify the 0-based header row index.
      2. Create a column mapping based on that header.
      Return JSON: { "headerIndex": number, "mapping": { dateColumn, amountColumn, categoryColumn, subcategoryColumn, descriptionColumn, typeColumn, projectColumn, isCreditDebitSeparate, creditColumn, debitColumn, expenseTransferColumn, incomeTransferColumn } }
    `;
    const text = await callAIProxy({ contents: [{ role: 'user', parts: [{ text: prompt }] }], jsonMode: true });
    if (!text) return null;
    return JSON.parse(cleanJSON(text));
  } catch (error) {
    console.warn('AI Structure Detection Error:', error);
    return null;
  }
};

/**
 * Extracts transactions from a PDF. `dataInput` is either raw text (when the PDF
 * was decrypted locally) or a base64-encoded PDF (Gemini extracts text itself).
 * Returns [] on failure — the caller throws a user-friendly error instead.
 */
export const extractTransactionsFromPDF = async (dataInput: string, isRawText: boolean = false): Promise<any[]> => {
  if (!isAIProxyAvailable()) return [];

  const prompt = `You are a bank statement parser. Extract every financial transaction from the statement and output them in strict pipe-delimited format.

OUTPUT FORMAT — one transaction per line, exactly 5 fields:
YYYY-MM-DD|Description|Amount|Type|Category

FIELD RULES:

Date — always output YYYY-MM-DD regardless of the input format:
  - DD/MM/YYYY (India, UK, Australia): 15/03/2025 → 2025-03-15
  - MM/DD/YYYY (US): 03/15/2025 → 2025-03-15
  - DD-Mon-YYYY: 15-Mar-2025 → 2025-03-15
  - ISO already correct: 2025-03-15 → 2025-03-15

Description — use the readable merchant or payee name only:
  - Strip transaction IDs, reference numbers, cheque numbers, long numeric codes
  - UPI narration "UPI/SWIGGY/9876543210/SWIG00" → "Swiggy"
  - UPI narration "UPI-ACME CORP INC-SAL" → "ACME Corp Salary"
  - "NEFT/HDFC/SALARY ACME" → "Salary ACME"
  - "ATM CASH WDL 001 SBI ATM" → "ATM Cash Withdrawal"
  - Keep names short and readable (max ~40 chars)

Amount — positive number, no currency symbols, no commas, no signs:
  - ₹1,234.56 → 1234.56
  - -45.99 → 45.99 (sign goes in Type field)
  - For split Debit/Credit columns: use whichever column has a value

Type — exactly one of: Income | Expense | Transfer
  Income: salary, wage, interest, refund, cashback, dividend, bonus, credit entry (Cr),
          inward NEFT/IMPS/UPI, deposit, government benefit, tax refund
  Expense: purchase, bill, EMI, loan payment, insurance premium, ATM withdrawal,
           debit entry (Dr), outward payment to merchant
  Transfer: UPI/NEFT/IMPS/RTGS to own account, internal fund move, FD creation,
            savings account top-up, wallet load, "self transfer", credit card bill payment
  When unsure between Expense and Transfer: use the description — merchant name = Expense,
  account number or "self" = Transfer.

Category — use ONLY these values (pick the best match):
  Food | Groceries | Transport | Shopping | Utilities | Entertainment |
  Health | Education | Investment | Salary | Income | Housing | EMI |
  Transfer | Cash | Unclassified

SKIP these rows entirely (do not output a line for them):
  - Opening balance, closing balance, running balance rows
  - Account number, IFSC, branch, statement period rows
  - Column header rows (Date, Particulars, Debit, Credit, Balance, etc.)
  - Sub-total or total rows
  - Any row with no recognisable amount

EXAMPLES (one per bank style):
2025-03-15|Swiggy|450.00|Expense|Food
2025-03-16|ACME Corp Salary|85000.00|Income|Salary
2025-03-17|ATM Cash Withdrawal|5000.00|Expense|Cash
2025-03-18|Netflix|649.00|Expense|Entertainment
2025-03-19|Transfer to Savings|10000.00|Transfer|Transfer
2025-03-20|HDFC Credit Card Payment|15000.00|Transfer|Transfer
2025-03-21|Income Tax Refund|12500.00|Income|Income
2025-03-22|Zerodha MF Purchase|5000.00|Expense|Investment

No markdown fences. No column headers in output. Only the pipe-delimited transaction lines.`;


  try {
    let contents: GeminiContents;
    if (isRawText) {
      // Trim to 80K chars max — keeps token count manageable while preserving
      // all relevant transaction rows (typical multi-page statement is 5–40K chars).
      const trimmedText = dataInput.length > 80000 ? dataInput.slice(0, 80000) : dataInput;
      contents = [{ role: 'user', parts: [{ text: prompt + '\n\nBANK STATEMENT TEXT:\n' + trimmedText }] }];
    } else {
      contents = [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: 'application/pdf', data: dataInput } }] }];
    }

    const rawText = (await callAIProxy({ contents }) || '')
      .replace(/^```[a-z]*/m, '').replace(/```$/m, '').trim();
    if (!rawText) return [];

    const VALID_TYPES = new Set(['Income', 'Expense', 'Transfer']);
    const INCOME_SIGNALS = /\b(salary|wage|interest|refund|cashback|dividend|bonus|credit|deposit|inward|received|cr\b)/i;
    const TRANSFER_SIGNALS = /\b(transfer|internal|own account|self|fd |wallet|top.?up|cc payment|credit card payment|cc pay|bppy cc|cc bill|payment to credit card)\b/i;

    return rawText.split('\n').filter((line: string) => line.trim() && !line.startsWith('#')).map((line: string) => {
      const parts = line.split('|').map((p: string) => p.trim());
      if (parts.length < 3) return null;

      const rawAmt = parts[2] ?? '';
      const amount = parseFloat(rawAmt.replace(/[^0-9.]/g, ''));
      if (isNaN(amount) || amount === 0) return null;

      let type: string = VALID_TYPES.has(parts[3]) ? parts[3] : 'Expense';
      let category: string = parts[4] || 'Unclassified';

      const desc = (parts[1] || '').toLowerCase();

      // Clear Transfer signals override (LLM corrective logic)
      if (TRANSFER_SIGNALS.test(desc)) {
        type = 'Transfer';
        category = 'Transfer';
      } else if (!VALID_TYPES.has(parts[3])) {
        // Sign-based override when Gemini didn't set a type
        if (rawAmt.includes('+') || /\bcr\b/i.test(rawAmt) || INCOME_SIGNALS.test(desc)) type = 'Income';
        else if (['refund', 'cashback', 'reversal', 'credit'].some(k => desc.includes(k))) type = 'Income';
      }


      const rawDate = (parts[0] ?? '').trim();
      // Normalise common non-ISO date formats → YYYY-MM-DD
      let date = rawDate;
      const slashParts = rawDate.split('/');
      if (slashParts.length === 3) {
        const [a, b, yr] = slashParts;
        // DD/MM/YYYY when first part > 12 (unambiguous), otherwise assume DD/MM for non-US context
        date = `${yr}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
      } else {
        const dashParts = rawDate.split('-');
        if (dashParts.length === 3 && dashParts[0].length <= 2) {
          // DD-MM-YYYY or DD-Mon-YYYY
          const monthMap: Record<string, string> = {
            jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
            jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12',
          };
          const [d, m, y] = dashParts;
          const mm = monthMap[m.toLowerCase()] ?? m.padStart(2, '0');
          date = `${y}-${mm}-${d.padStart(2, '0')}`;
        }
      }

      return {
        date,
        description: parts[1] || 'Unknown',
        amount,
        type,
        category,
      };
    }).filter(Boolean);
  } catch (e: any) {
    // Re-throw auth/account errors so the user sees a clear message
    if (e?.message?.includes('Sign in') || e?.message?.includes('account')) throw e;
    console.error('PDF Extraction Error', e);
    return [];
  }
};

/**
 * Detects the header row and column mapping in a net-asset spreadsheet.
 * `currentValueColumn` and `dateColumn` are required; others are optional.
 * Returns null on failure so the UI can fall back to manual mapping.
 */
export const detectAssetFileStructure = async (
  rawRows: any[][]
): Promise<{ headerIndex: number; mapping: AssetFileMapping } | null> => {
  if (!isAIProxyAvailable()) return null;
  try {
    const sample = rawRows.slice(0, 30);
    const prompt = `
      I have a spreadsheet containing asset/investment/net-worth data. Here are the first rows:
      ${JSON.stringify(sample)}

      Analyze this data and:
      1. Identify the 0-based row index that contains column headers (skip title rows, blank rows, etc.)
      2. Map the header columns to these asset fields. Use the EXACT header text from the file for each mapping:
         - dateColumn: the column with dates (required)
         - ownerColumn: column identifying whose asset it is (optional)
         - categoryColumn: the asset type/category like "Stocks", "Mutual Funds", "Savings" (optional)
         - tierColumn: accessibility tier like "Liquid", "Investment", "Retirement" (optional)
         - principalColumn: invested amount / cost basis / principal (optional)
         - currentValueColumn: current market value / total value (required)
         - currencyColumn: currency of the values (optional)
         - notesColumn: any notes or description column (optional)

      Return JSON: { "headerIndex": number, "mapping": { "dateColumn": "exact header text", "currentValueColumn": "exact header text", ... } }
      Only include mapping fields where a matching column exists. dateColumn and currentValueColumn are required.
    `;
    const text = await callAIProxy({ contents: [{ role: 'user', parts: [{ text: prompt }] }], jsonMode: true });
    if (!text) return null;
    return JSON.parse(cleanJSON(text));
  } catch (error) {
    console.warn('AI Asset Structure Detection Error:', error);
    return null;
  }
};
