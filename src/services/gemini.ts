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

      Return a SINGLE valid JSON object with EXACTLY these top-level fields:
        dateColumn, dateFormat, amountColumn, categoryColumn, subcategoryColumn, descriptionColumn,
        typeColumn, projectColumn, isCreditDebitSeparate, creditColumn, debitColumn,
        expenseTransferColumn, incomeTransferColumn,
        confidence (object with numeric fields: { dateColumn: 0-1, amountColumn: 0-1, creditDebitSplit: 0-1 }).

      IMPORTANT OUTPUT RULES:
      - Output ONLY raw JSON, with no surrounding text, comments, or markdown.
      - For every *Column field:
        - Use either EXACTLY one of the provided header strings, OR
        - null (or empty string) if that semantic field does not exist.
      - Do NOT invent new column names that are not present in the headers.
      - Use boolean true/false for isCreditDebitSeparate.

      Headers may be in any language (German "Buchungstag"/"Betrag", French "Date d'opération"/"Montant",
      Spanish "Fecha"/"Importe", Japanese "日付"/"金額", Hindi "तारीख"/"राशि", etc.).
      Map them to the standard English field names above.

      dateFormat must be one of: "DMY" (25/03/2025), "MDY" (03/25/2025), or "YMD" (2025-03-25).
      Infer it from the sample dates:
      - If any date has the first part > 12 → "DMY".
      - Else if the second part > 12 → "MDY".
      - Else, use the format that is most common for the apparent locale in the sample.
      - If some dates are already ISO (YYYY-MM-DD), and others are ambiguous, prefer the majority format.

      ====== FORMAT PATTERNS — distinguish carefully ======

      FORMAT A — Credit/Debit split (BOTH columns hold MONETARY NUMBERS):
        Typical headers: "Debit Amount" / "Credit Amount", "Withdrawal" / "Deposit",
                         "Withdrawal Amt." / "Deposit Amt.", "Money Out" / "Money In",
                         "Dr Amount" / "Cr Amount", "Soll" / "Haben" (German).
        Each row has a number in ONE of the two columns, blank in the other.
        → Set isCreditDebitSeparate = true.
        → creditColumn = <deposit/credit header>, debitColumn = <withdrawal/debit header>.
        → amountColumn should usually be null/empty for this format.

      FORMAT B — Transfer-account / envelope format (columns hold ACCOUNT NAMES, NOT amounts):
        Typical headers: "Expense(Transfer Out)" / "Income(Transfer In)",
                         "From Account" / "To Account".
        Values look like: "HDFC Savings", "Cash", "Credit Card" — NOT numbers.
        There is ALWAYS a separate numeric "Amount" column with positive values only.
        → Set isCreditDebitSeparate = false.
        → expenseTransferColumn = <expense/from header>, incomeTransferColumn = <income/to header>.
        → amountColumn = <the numeric amount header>.
        → creditColumn and debitColumn MUST be null/empty.

      FORMAT C — Single signed-amount column (the most common bank export):
        One numeric column with both positive and negative values.
        Convention: NEGATIVE = expense (money out), POSITIVE = income (money in).
        Common in US, UK, and European banks (e.g., German "Betrag").
        → amountColumn = <header>.
        → isCreditDebitSeparate = false.
        → creditColumn and debitColumn MUST be null/empty.

      FORMAT D — All-positive amount with a separate Type / Dr-Cr indicator column:
        Amount values are all positive; a separate column says "Dr"/"Cr" or "Debit"/"Credit".
        → amountColumn = <numeric header>.
        → typeColumn = <Dr/Cr or Debit/Credit header>.
        → isCreditDebitSeparate = false.

      ====== HARD RULES — do not violate ======
      - NEVER set isCreditDebitSeparate = true unless BOTH candidate columns contain NUMBERS
        in the sample data. If the column contains account names or text, it is NOT credit/debit.
      - The "Balance" / "Running Balance" / "Available Balance" / "Saldo" / "Solde" column is
        NOT an amount. Leave it UNMAPPED (do not assign it to amountColumn).
      - Any column that looks like a running balance or limit must remain unmapped.
      - Columns that have the same value in every row (e.g., account number, IBAN, currency)
        should remain unmapped.
      - A "Category" / "Sub-Category" column is NOT a typeColumn.
        typeColumn only applies to columns that explicitly indicate Debit vs Credit
        (e.g., "Dr/Cr", "Direction", "Debit/Credit", "Type" when it clearly means direction).
      - If there is no match for a semantic field (e.g., no category in the file),
        set that *Column to null/empty rather than guessing.

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
      You are a bank statement structure detector for CSV/Excel-like files.

      I will give you the FIRST 50 RAW ROWS of the file, as arrays of cell values.
      Some of the initial rows may be bank logos, addresses, metadata, or blank lines
      before the actual transaction table begins.

      Your tasks:
      1. Identify which row index (0-based) is the header row for the main transaction table.
      2. Create a column mapping based on that header row, using the same schema and logic
         as the column-mapper prompt (Formats A–D and hard rules).

      Return a SINGLE valid JSON object of the form:
      {
        "headerIndex": number,
        "mapping": {
          "dateColumn": string or null,
          "amountColumn": string or null,
          "categoryColumn": string or null,
          "subcategoryColumn": string or null,
          "descriptionColumn": string or null,
          "typeColumn": string or null,
          "projectColumn": string or null,
          "isCreditDebitSeparate": boolean,
          "creditColumn": string or null,
          "debitColumn": string or null,
          "expenseTransferColumn": string or null,
          "incomeTransferColumn": string or null
        }
      }

      IMPORTANT OUTPUT RULES:
      - Output ONLY raw JSON, with no surrounding text, comments, or markdown.
      - headerIndex MUST be a non-negative integer (0, 1, 2, ...).
      - For each *Column field in mapping:
        - Use EXACTLY one of the header strings from the detected header row, OR
        - null/empty if that semantic field does not exist.
      - Do NOT invent column names that are not present in the header row.

      HEADER ROW DETECTION GUIDELINES:
      - A true header row typically has:
        - Multiple non-empty cells, each short and label-like (e.g., "Date", "Amount", "Description").
        - Different values across columns.
      - Rows that are likely NOT headers:
        - Rows with only one long free-text cell (e.g., bank address, marketing text).
        - Rows with account holder name, address, IFSC, IBAN, or statement period.
        - Rows with page numbers, footers, or terms and conditions.
      - If more than one row could be a header, choose the one whose cells best look like column labels
        for a transaction table (Date, Amount, Description, etc.).
      - If there is no perfect header row, choose the best candidate and still return a headerIndex.

      COLUMN MAPPING GUIDELINES (apply the same logic as in the column-mapper prompt):

      - Detect whether the file uses:
        - FORMAT A: separate numeric Debit and Credit columns (isCreditDebitSeparate = true).
        - FORMAT B: transfer-account style (Expense/Income account names + separate numeric Amount).
        - FORMAT C: single signed-amount column.
        - FORMAT D: all-positive Amount column plus a Dr/Cr or Debit/Credit direction column.

      - Follow these rules:
        - Never mark isCreditDebitSeparate = true unless both candidate columns contain numeric
          monetary values in the sample data.
        - Balance / Running Balance / Available Balance / Saldo / Solde columns are NOT amountColumn.
        - Columns holding constant metadata (account numbers, IBAN, currency) should remain unmapped.
        - typeColumn is only for explicit direction columns ("Dr/Cr", "Debit/Credit", "Direction"),
          not for category or text labels.

      Use the provided first 50 rows to:
      - Choose headerIndex.
      - Read the header row to get the exact header strings.
      - Build the mapping object according to these rules.

      First 50 rows:
      ${JSON.stringify(rawRows)}
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
export const extractTransactionsFromPDF = async (dataInput: string, isRawText: boolean = false, signal?: AbortSignal): Promise<any[]> => {
  if (!isAIProxyAvailable()) return [];

  const prompt = `You are a bank statement parser. Extract every financial transaction from the statement and output them in strict pipe-delimited format.

OUTPUT FORMAT — one transaction per line, exactly 5 fields:
YYYY-MM-DD|Description|Amount|Type|Category

No extra text.
No headers.
No markdown fences.
No explanations.

If you cannot confidently identify BOTH a date and an amount for a row, SKIP that row.

FIELD RULES

Date — always output in format YYYY-MM-DD, regardless of how it appears:
  - DD/MM/YYYY: 15/03/2025 → 2025-03-15
  - MM/DD/YYYY: 03/15/2025 → 2025-03-15
  - DD-Mon-YYYY: 15-Mar-2025 → 2025-03-15
  - ISO already correct: 2025-03-15 → 2025-03-15

Additional date rules:
  - If there is both a Transaction Date and a Posting/Value Date, prefer the Transaction Date.
  - If only one date appears for the row, use that date.
  - If the date is shown once at the start of a group of continuation lines, apply that same date to all continuation lines merged into that transaction.

Description — short, human-readable transaction text:
  - Focus on the merchant / counterparty / main purpose.
  - Strip transaction IDs, long reference numbers, cheque numbers, and technical codes where possible.
  - UPI narration "UPI/SWIGGY/9876543210/SWIG00" → "Swiggy"
  - UPI narration "UPI-ACME CORP INC-SAL" → "ACME Corp Salary"
  - "NEFT/HDFC/SALARY ACME" → "Salary ACME"
  - "ATM CASH WDL 001 SBI ATM" → "ATM Cash Withdrawal"
  - If you cannot infer a clean merchant or purpose, fall back to a trimmed version of the original narration, removing only obvious noise (IDs, excessive codes).
  - Keep descriptions concise and readable (around 40 characters where possible).
  - Include “Self Transfer”, “Credit Card Payment”, “FD Creation”, etc. where that is clearly the purpose.

Multi-line / wrapped rows:
  - If a single transaction is split across multiple lines (only the first line has the date and amount, later lines are continuation text), merge all lines into one description and output a single transaction line.

Amount — positive number only, no signs, no currency symbols, no commas:
  - ₹1,234.56 → 1234.56
  - -45.99 → 45.99 (the sign goes in Type)
  - Always use the account’s posting amount (not points, units, etc.).

When statement has separate Debit and Credit / Withdrawal and Deposit columns:
  - Use whichever column has a non-empty value for that row.
  - Take the absolute value (no plus/minus sign in the Amount field).
  - The direction (inflow vs outflow) is captured in Type.

When statement has a single Amount column:
  - If there is a sign, ignore the sign in Amount and use it only to decide Type.
  - If there is no sign, infer direction from column headings and description:
    * Bank statements:
      Words like DEBIT, DR, Withdrawal, Payment, POS, Purchase, ATM, Fee, Interest Charged, EMI → treat as outflow.
      Words like CREDIT, CR, Deposit, Salary, Refund, Reversal, Cashback, Interest Income → treat as inflow.
    * Credit card statements:
      Under headings like “Purchases”, “Debits”, “Charges” → outflow (you are being charged).
      Under headings like “Payments & Credits”, “Credits”, “Payment Received”, “Refund”, “Reversal”, “Cashback” → inflow to the card (reduces what you owe).
  - Again, Amount is always positive. Direction is handled in the Type field.

Type — exactly one of: Income | Expense | Transfer
Interpret Type from the account holder’s point of view:
  - Income — money coming in:
    * Salary/wage, bonus, incentives.
    * Interest income, dividends, cashbacks, rewards credited.
    * Refunds or reversals that increase your bank balance or reduce your credit card due.
    * Inward NEFT/RTGS/IMPS/UPI, deposits, government benefits, tax refunds.
  - Expense — money going out (spending or cost):
    * Purchases and POS transactions (online or offline).
    * Bills, utilities, subscriptions (Netflix, Spotify, electricity, mobile, etc.).
    * EMI charges, loan payments, insurance premiums.
    * ATM cash withdrawals.
    * Bank and card charges, penalties, yearly fees, interest charged on loans/credit cards.
    * Any merchant purchase in a credit card statement under “Purchases” / “Charges” / “Debits”.
  - Transfer — movement between your own accounts or into investments:
    * UPI/NEFT/RTGS/IMPS to your own accounts or own credit cards.
    * Internal transfers between accounts in the same bank.
    * FD/RD creation, mutual fund or brokerage funding, wallet loads (Paytm, PhonePe, etc.).
    * “Self transfer”, “Own account transfer”, “Savings top-up”.
    * Credit card bill payments (from bank account to card).
  - If unsure between Expense and Transfer:
    * Merchant / brand / service name → Expense.
    * Clear account number, “self”, “own account”, “credit card payment”, “FD”, “MF”, “wallet load” → Transfer.

Category — use ONLY these values (pick the single best match):
  Food | Groceries | Transport | Shopping | Utilities | Entertainment |
  Health | Education | Investment | Salary | Other Income | Housing | EMI |
  Transfer | Cash | Unclassified

Guidelines:
  - Salary / regular monthly pay: Category = Salary, Type = Income.
  - Other inflows (interest, cashback, tax refund, generic credits): Category = Other Income, Type = Income.
  - Mutual fund, stock, FD/RD, brokerage funding: Category = Investment.
    * If it’s a move to your own investment account, Type = Transfer.
  - Wallet loads and internal transfers: Category = Transfer, Type = Transfer.
  - ATM cash withdrawal: Category = Cash, Type = Expense.
  - Loan EMIs and BNPL EMIs: Category = EMI, usually Type = Expense (or Transfer if clearly to your own loan account).
  - Rent, home loan EMI, society maintenance: Category = Housing.
  - Mobile, electricity, gas, water, DTH, broadband: Category = Utilities.
  - Restaurants, food delivery, cafes: Category = Food.
  - Supermarkets, kirana, general groceries: Category = Groceries.
  - Cabs, fuel, metro, tolls, parking: Category = Transport.
  - Clothing, electronics, general e-commerce, other shopping: Category = Shopping.
  - OTT subscriptions, movies, events: Category = Entertainment.
  - Medical, pharmacy, hospital, insurance premium for health: Category = Health.
  - Tuition, school, college, courses, exams: Category = Education.
  - If you are not reasonably sure of the category, use Unclassified.

ROWS TO SKIP ENTIRELY
Do not output lines for:
  - Opening balance, closing balance, running balance rows.
  - Account / card details, IFSC, branch, statement period, customer info.
  - Column headers (Date, Particulars, Debit, Credit, Charges, Payments, Balance, etc.).
  - Section totals or subtotals, e.g. “Total Purchases”, “Total Payments & Credits”, “Interest this period”, “Fees this period”.
  - Lines with only page numbers, marketing messages, offers, footers, or disclaimers.
  - Any row where you cannot confidently identify BOTH a date and an amount.

SPECIAL NOTES FOR CREDIT CARD STATEMENTS
  - Treat purchases, fees, cash advances, interest charges as Expense.
  - Treat payments made to the card, credits, refunds, reversals, cashbacks as Income (if it is truly money gained) or Transfer (typical for card bill payments from your bank account).
    * Example: “NEFT PAYMENT RECEIVED” or “AutoPay from HDFC Bank” → Type = Transfer, Category = Transfer.
    * “AMAZON REFUND” → Type = Income, Category = Other Income or Shopping (choose best).

EXAMPLES (format only)
2025-03-15|Swiggy|450.00|Expense|Food
2025-03-16|ACME Corp Salary|85000.00|Income|Salary
2025-03-17|ATM Cash Withdrawal|5000.00|Expense|Cash
2025-03-18|Netflix|649.00|Expense|Entertainment
2025-03-19|Transfer to Savings|10000.00|Transfer|Transfer
2025-03-20|HDFC Credit Card Payment|15000.00|Transfer|Transfer
2025-03-21|Income Tax Refund|12500.00|Income|Other Income
2025-03-22|Zerodha MF Purchase|5000.00|Transfer|Investment

Remember:
Output only the pipe-delimited transaction lines, one per transaction.
No headers. No extra text. No markdown.`;


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

    const rawText = (await callAIProxy({ contents, signal }) || '')
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
    console.error('PDF Extraction Error:', e);
    throw e;
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
