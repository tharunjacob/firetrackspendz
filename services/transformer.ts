
import { Transaction, TransactionType, FileMapping } from '../types';
import * as XLSX from 'xlsx';
import { getFileMappingFromAI, detectFileStructure, extractTransactionsFromPDF } from './geminiService';
import { getStoredMapping, saveMapping, getLearnedCategory } from './learningService';

// --- CONFIGURATION ---
const CONFIG = {
  field_synonyms: {
    amount: [
      "Amount", "Cost", "Value", "Price", "Total", "Sum", "Paid", "Spent", 
      "Expense", "Outflow", "Money Out", "Debit", "Withdrawal", "Charge", 
      "Credit Amount", "Inflow", "Money In", "Income", "Deposit", "Received", 
      "Transaction Amount", "Debits", "Credits", "Net Amount",
      "amount_inr", "amount_rs", "rs", "₹", "inr", "amt", "$", "£", "€",
      "Withdrawal Amt.", "Deposit Amt.", "Withdrawal Amt", "Deposit Amt"
    ],
    ignore_columns: [
        "Balance", "Running Balance", "Avail Bal", "Available Balance", "Total Balance", "Closing Balance"
    ],
    income: [
      "Income", "Earning", "Inflow", "Credit", "Money In", "Deposit", "Received",
      "Income(Transfer In)", "Income (Transfer In)", "Transfer In", "Transfer-In", "Transferin",
      "Credit Amount", "cr_amount", "Deposit Amount", "Deposit Amt.", "Deposit Amt"
    ],
    expense: [
      "Expense", "Spend", "Outflow", "Debit", "Cost", "Money Out", "Payment", "Withdrawal",
      "Expense(Transfer Out)", "Expense (Transfer Out)", "Transfer Out", "Transfer-Out", "Transferout",
      "Debit Amount", "dr_amount", "Withdrawal Amount", "Withdrawal Amt.", "Withdrawal Amt"
    ],
    credit: ["Credit", "Cr", "Deposit", "Incoming", "Credit Amount", "Inflow", "Deposit Amt.", "Deposit Amt"],
    debit: ["Debit", "Dr", "Withdrawal", "Outgoing", "Debit Amount", "Outflow", "Withdrawal Amt.", "Withdrawal Amt"],
    type: ["Type", "Transaction Type", "Nature", "Kind", "Flow", "Dr/Cr", "Direction", "Category"],
    category: [ "Category", "Main Category", "Group", "Classification", "Primary Category", "Class", "Tag" ],
    subcategory: [ 
      "Subcategory", "Sub-Category", "Sub Category", "subCategory", "sub_category", 
      "Secondary Category", "Subgroup", "Sub Group", "Sub-Group", "Envelope", 
      "Budget Group", "Secondary", "Minor Category", "Detail Category" 
    ],
    description: [ 
      "Notes", "Note", "Memo", "Description", "Detail", "Details", "Item", "Narrative", 
      "Reference", "Remarks", "Comment", "Comments", "Payee", "Merchant", "Vendor",
      "Transaction Details", "Purpose", "Reason", "What For", "Transaction Note",
      "particulars", "narration", "desc", "Party Name", "Description"
    ],
    date: [ 
      "Date", "Transaction Date", "Posting Date", "Booked Date", "Posted Date", 
      "Time", "Datetime", "Posted At", "Created At", "Timestamp", "Txn Date", "Value Date"
    ],
    project: ["Project", "Tag", "Reference", "Label"]
  },
  keywords: {
    expense: [
      'entertainment', 'food', 'dining', 'shopping', 'clothing', 'transport', 
      'travel', 'health', 'medical', 'education', 'learning', 'fuel', 'gas',
      'movie', 'restaurant', 'grocery', 'bills', 'utilities', 'rent', 
      'insurance', 'fee', 'charge', 'purchase', 'expense', 'withdraw',
      'accessories', 'gym', 'fitness', 'phone', 'mobile', 'debit', 'dr'
    ],
    income: [
      'salary', 'wage', 'income', 'bonus', 'dividend', 'interest', 
      'refund', 'cashback', 'deposit', 'earning', 'revenue', 'commission',
      'freelance', 'consulting', 'pension', 'benefit', 'gift received', 'credit', 'cr'
    ],
    transfer: [
      'transfer', 'internal', 'move', 'top up', 'adjustment', 'initial balance', 
      'opening', 'reconcile', 'balance adj', 'account transfer', 'wallet transfer',
      'self', 'own account'
    ]
  },
  // Richer Mapping for Local "Smart Classify"
  category_mapping: {
    // FOOD & DINING
    'swiggy': 'Food', 'zomato': 'Food', 'eat': 'Food', 'food': 'Food', 'doordash': 'Food', 'grubhub': 'Food', 'deliveroo': 'Food', 'just eat': 'Food',
    'restaurant': 'Food', 'cafe': 'Food', 'coffee': 'Food', 'starbucks': 'Food', 'dunkin': 'Food', 'costa': 'Food', 'pret': 'Food',
    'mcdonalds': 'Food', 'kfc': 'Food', 'burger': 'Food', 'pizza': 'Food', 'subway': 'Food', 'chipotle': 'Food', 'taco bell': 'Food',
    'dominos': 'Food', 'biryani': 'Food', 'freshmenu': 'Food', 'barbeque': 'Food',
    'baker': 'Food', 'cake': 'Food', 'sweet': 'Food', 'dairy': 'Food',
    
    // GROCERIES (Global + Local)
    'grofers': 'Groceries', 'bigbasket': 'Groceries', 'blinkit': 'Groceries', 'instacart': 'Groceries',
    'zepto': 'Groceries', 'instamart': 'Groceries', 'supermarket': 'Groceries', 'whole foods': 'Groceries', 'trader joe': 'Groceries',
    'mart': 'Groceries', 'kirana': 'Groceries', 'vegetable': 'Groceries', 'walmart': 'Groceries', 'tesco': 'Groceries', 'sainsbury': 'Groceries',
    'fruit': 'Groceries', 'milk': 'Groceries', 'licious': 'Groceries', 'aldi': 'Groceries', 'lidl': 'Groceries', 'carrefour': 'Groceries', 'costco': 'Groceries',
    'ratnadeep': 'Groceries', 'dmart': 'Groceries', 'reliance fresh': 'Groceries', 'kroger': 'Groceries', 'safeway': 'Groceries', 'target': 'Groceries',

    // TRANSPORT
    'uber': 'Transport', 'ola': 'Transport', 'rapido': 'Transport', 'lyft': 'Transport', 'grab': 'Transport', 'gojek': 'Transport',
    'fuel': 'Transport', 'petrol': 'Transport', 'diesel': 'Transport', 'gas station': 'Transport',
    'shell': 'Transport', 'hpcl': 'Transport', 'bpcl': 'Transport', 'iocl': 'Transport', 'exxon': 'Transport', 'chevron': 'Transport', 'bp ': 'Transport', 'texaco': 'Transport',
    'toll': 'Transport', 'fastag': 'Transport', 'ezpass': 'Transport', 'congestion': 'Transport',
    'metro': 'Transport', 'irctc': 'Transport', 'railway': 'Transport', 'train': 'Transport', 'tfl': 'Transport', 'mta': 'Transport', 'amtrak': 'Transport',
    'flight': 'Transport', 'indigo': 'Transport', 'air india': 'Transport', 'vistara': 'Transport', 'delta': 'Transport', 'united': 'Transport', 'ryanair': 'Transport', 'easyjet': 'Transport',
    'bus': 'Transport', 'redbus': 'Transport', 'auto': 'Transport', 'cab': 'Transport', 'taxi': 'Transport',
    'parking': 'Transport',

    // SHOPPING
    'amazon': 'Shopping', 'flipkart': 'Shopping', 'myntra': 'Shopping', 'ajio': 'Shopping', 'ebay': 'Shopping', 'shopify': 'Shopping',
    'tata': 'Shopping', 'reliance': 'Shopping', 'retail': 'Shopping', 'store': 'Shopping', 'etsy': 'Shopping',
    'shop': 'Shopping', 'decathlon': 'Shopping', 'nike': 'Shopping', 'adidas': 'Shopping',
    'zara': 'Shopping', 'h&m': 'Shopping', 'uniqlo': 'Shopping', 'ikea': 'Shopping',
    'lifestyle': 'Shopping', 'pantaloons': 'Shopping', 'westside': 'Shopping', 'cloth': 'Shopping',
    'shoe': 'Shopping', 'mall': 'Shopping', 'best buy': 'Shopping', 'apple': 'Shopping',

    // UTILITIES
    'bescom': 'Utilities', 'electricity': 'Utilities', 'water': 'Utilities', 'gas': 'Utilities', 'power': 'Utilities',
    'bill': 'Utilities', 'recharge': 'Utilities', 'jio': 'Utilities', 'airtel': 'Utilities', 'verizon': 'Utilities', 'at&t': 'Utilities', 't-mobile': 'Utilities',
    'vi ': 'Utilities', 'vodafone': 'Utilities', 'bsnl': 'Utilities', 'broadband': 'Utilities', 'bt group': 'Utilities', 'virgin media': 'Utilities',
    'act': 'Utilities', 'hathway': 'Utilities', 'spectranet': 'Utilities', 'tatasky': 'Utilities', 'comcast': 'Utilities', 'xfinity': 'Utilities',
    'dth': 'Utilities', 'mobile': 'Utilities', 'internet': 'Utilities', 'council tax': 'Utilities',

    // ENTERTAINMENT
    'netflix': 'Entertainment', 'prime': 'Entertainment', 'spotify': 'Entertainment', 'hulu': 'Entertainment', 'disney': 'Entertainment',
    'youtube': 'Entertainment', 'hotstar': 'Entertainment', 'bookmyshow': 'Entertainment', 'ticketmaster': 'Entertainment',
    'pvr': 'Entertainment', 'inox': 'Entertainment', 'cinema': 'Entertainment', 'movie': 'Entertainment', 'amc': 'Entertainment', 'odeon': 'Entertainment',
    'game': 'Entertainment', 'steam': 'Entertainment', 'playstation': 'Entertainment', 'club': 'Entertainment', 'xbox': 'Entertainment', 'nintendo': 'Entertainment',
    'party': 'Entertainment', 'event': 'Entertainment',

    // HEALTH
    'hospital': 'Health', 'pharmacy': 'Health', 'medplus': 'Health', 'apollo': 'Health', 'boots': 'Health', 'cvs': 'Health', 'walgreens': 'Health',
    '1mg': 'Health', 'practo': 'Health', 'doctor': 'Health', 'clinic': 'Health', 'nhs': 'Health',
    'lab': 'Health', 'gym': 'Health', 'cult': 'Health', 'fitness': 'Health', 'anytime fitness': 'Health', 'gold': 'Health',
    'medical': 'Health', 'medicine': 'Health', 'scan': 'Health', 'dentist': 'Health',

    // EDUCATION
    'course': 'Education', 'udemy': 'Education', 'coursera': 'Education', 'book': 'Education', 'pluralsight': 'Education', 'masterclass': 'Education',
    'kindle': 'Education', 'school': 'Education', 'college': 'Education', 'fee': 'Education', 'university': 'Education',
    'tuition': 'Education', 'learning': 'Education', 'stationery': 'Education',

    // INVESTMENT
    'zerodha': 'Investment', 'groww': 'Investment', 'upstox': 'Investment', 'kite': 'Investment', 'robinhood': 'Investment', 'coinbase': 'Investment', 'binance': 'Investment',
    'mutual fund': 'Investment', 'sip': 'Investment', 'ppf': 'Investment', 'nps': 'Investment', 'vanguard': 'Investment', 'fidelity': 'Investment',
    'lic': 'Investment', 'insurance': 'Investment', 'premium': 'Investment', 'policy': 'Investment', 'schwab': 'Investment', 'etrade': 'Investment',
    'stocks': 'Investment', 'equity': 'Investment', 'fd ': 'Investment', 'rd ': 'Investment', '401k': 'Investment', 'ira': 'Investment',
    
    // INCOME
    'salary': 'Salary', 'dividend': 'Income', 'interest': 'Income', 'refund': 'Income', 'payroll': 'Salary',
    'cashback': 'Income', 'bonus': 'Income',

    // OTHERS
    'rent': 'Housing', 'maintenance': 'Housing', 'loan': 'EMI', 'card': 'Bill Payment', 'mortgage': 'Housing'
  },
  
  // Regex patterns for smarter matching when simple inclusion fails
  smart_patterns: [
      { regex: /^(UPI|IMPS|NEFT|RTGS|ACH|ZELLE|VENMO)([-/ ])?.*(ZOMATO|SWIGGY|DOORDASH|GRUBHUB|UBER\s?EATS)/i, category: 'Food' },
      { regex: /^(UPI|IMPS|NEFT|RTGS|ACH|ZELLE|VENMO)([-/ ])?.*(UBER|OLA|LYFT)/i, category: 'Transport' },
      { regex: /^(UPI|IMPS|NEFT|RTGS|ACH|ZELLE|VENMO)([-/ ])?.*(AMAZON|FLIPKART|EBAY)/i, category: 'Shopping' },
      { regex: /^(UPI|IMPS|NEFT|RTGS|ACH|ZELLE|VENMO)([-/ ])?.*(ZERODHA|GROWW|UPSTOX|ROBINHOOD|VANGUARD)/i, category: 'Investment' },
      { regex: /^ATM\s?WDL/i, category: 'Cash' },
      { regex: /^ATM\s?CASH/i, category: 'Cash' },
      { regex: /^POS\s/i, category: 'Shopping' }, // POS usually means swiping at a store
      { regex: /^ACH\s?DR/i, category: 'Bill Payment' }, // Auto-debit
      { regex: /^ACH\s?C/i, category: 'Income' },
      { regex: /^INT\.?\s?PD/i, category: 'Income' }, // Interest Paid
      { regex: /^INT\.?\s?COLL/i, category: 'Income' }, // Interest Collected
      { regex: /^(DD|DIRECT DEBIT)/i, category: 'Bill Payment' }, // UK Direct Debit
      { regex: /^(SO|STANDING ORDER)/i, category: 'Transfer' }, // UK Standing Order
      // STRICT EMI/LOAN DETECTION (Must be a distinct word)
      { regex: /\b(loan|emi|mortgage)\b/i, category: 'EMI' },
      { regex: /^(UPI|IMPS|NEFT|RTGS|ZELLE|VENMO|WIRE|SEPA|FASTER PAY)/i, category: 'Transfer' } // Default for banking terms if no other match
  ]
};

// --- HELPER ALGORITHMS ---

const levenshtein = (a: string, b: string): number => {
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }
  return matrix[b.length][a.length];
};

const getSimilarity = (s1: string, s2: string): number => {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  if (longer.length === 0) return 1.0;
  return (longer.length - levenshtein(longer, shorter)) / longer.length;
};

const findBestColumn = (columns: string[], candidates: string[]): string | undefined => {
  let bestMatch: string | undefined = undefined;
  let bestScore = 0;

  for (const col of columns) {
    if (!col) continue;
    const colLower = String(col).toLowerCase().trim();
    if (CONFIG.field_synonyms.ignore_columns.some(ignore => colLower.includes(ignore.toLowerCase()))) {
        continue;
    }
    for (const cand of candidates) {
      const candLower = cand.toLowerCase().trim();
      if (colLower === candLower) return col;
      if (colLower.includes(candLower) || candLower.includes(colLower)) {
         const minLength = Math.min(colLower.length, candLower.length);
         if (minLength >= 3) {
             const score = 0.9;
             if (score > bestScore) { bestScore = score; bestMatch = col; }
         }
      }
      const score = getSimilarity(colLower, candLower);
      if (score > 0.7 && score > bestScore) {
        bestScore = score;
        bestMatch = col;
      }
    }
  }
  return bestMatch;
};

const isNA = (val: any) => val === null || val === undefined || String(val).trim() === '' || String(val).toLowerCase() === 'nan';

const cleanAmount = (val: any): number => {
  if (isNA(val)) return 0;
  let str = String(val).trim();
  let multiplier = 1;
  const isNegative = (str.startsWith('(') && str.endsWith(')')) || str.startsWith('-');
  str = str.replace(/[^0-9.-]/g, ''); 
  if (!str) return 0;
  const num = parseFloat(str);
  if (isNaN(num)) return 0;
  return (isNegative ? -Math.abs(num) : Math.abs(num)) * multiplier;
};

const parseDate = (val: any): { date: string, time: string, year: number } | null => {
  if (isNA(val)) return null;
  let timeStr = '00:00';

  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    const year = val.getFullYear();
    const month = String(val.getMonth() + 1).padStart(2, '0');
    const day = String(val.getDate()).padStart(2, '0');
    return { date: `${year}-${month}-${day}`, time: timeStr, year };
  }

  const str = String(val).trim();
  
  if (/^\d{8}$/.test(str)) {
      const year = parseInt(str.substring(0, 4));
      const month = str.substring(4, 6);
      const day = str.substring(6, 8);
      if (parseInt(month) > 12 || parseInt(day) > 31) return null;
      return { date: `${year}-${month}-${day}`, time: timeStr, year };
  }

  const monthMap: {[key: string]: string} = {
      'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
      'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
  };
  
  // DD-MMM-YY or DD-MMM-YYYY (Common in India/UK) -> 01-Apr-25 or 01-Apr-2025
  let match = str.match(/^(\d{1,2})[-/ ]([a-zA-Z]{3})[-/ ](\d{2,4})/);
  if (match) {
      let day = match[1].padStart(2, '0');
      let month = monthMap[match[2].toLowerCase()];
      let yearStr = match[3];
      if (yearStr.length === 2) yearStr = '20' + yearStr;
      const year = parseInt(yearStr);
      if (month) return { date: `${year}-${month}-${day}`, time: timeStr, year };
  }

  // YYYY-MM-DD (ISO)
  match = str.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if (match) {
      return { date: `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`, time: timeStr, year: parseInt(match[1]) };
  }

  // DD-MM-YYYY (or DD-MM-YY) - Priority for non-US
  match = str.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/);
  if (match) {
    let yearStr = match[3];
    if (yearStr.length === 2) yearStr = '20' + yearStr;
    const year = parseInt(yearStr);
    // Simple heuristic: if first number > 12, it must be DD-MM-YYYY
    // If not, we assume standard international format DD-MM first for this app context, unless it's clearly US.
    return { date: `${yearStr}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`, time: timeStr, year };
  }

  // MM/DD/YYYY - US Format (Fallback)
  match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
     return { date: `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`, time: timeStr, year: parseInt(match[3]) };
  }

  return null;
};

const hasKeyword = (text: string, keywords: string[]): boolean => {
  for (const k of keywords) {
      const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (regex.test(text)) return true;
  }
  return false;
};

// --- CORE MAPPING LOGIC ---
const applyMapping = (dataRows: any[][], header: string[], mapping: FileMapping, owner: string): Transaction[] => {
     const transactions: Transaction[] = [];

     dataRows.forEach((row, idx) => {
         const getVal = (colName: string | undefined) => {
             if (!colName) return null;
             const index = header.indexOf(colName);
             return index !== -1 ? row[index] : null;
         };

         const dateVal = parseDate(getVal(mapping.dateColumn));
         if (!dateVal || dateVal.year < 1990 || dateVal.year > 2100) return;

         let amount = 0;
         let type: TransactionType = 'Expense';

         // 1. Priority: Explicit Type Column
         const explicitTypeVal = getVal(mapping.typeColumn);
         let explicitType: TransactionType | null = null;
         if (explicitTypeVal) {
             const tStr = String(explicitTypeVal).toLowerCase().trim();
             if (['income', 'credit', 'deposit', 'cr'].some(k => tStr.includes(k))) explicitType = 'Income';
             else if (['expense', 'debit', 'payment', 'dr', 'withdrawal'].some(k => tStr.includes(k))) explicitType = 'Expense';
             else if (['transfer'].some(k => tStr.includes(k))) explicitType = 'Transfer';
         }

         // 2. Determine Amount & Inferred Type
         if (mapping.expenseTransferColumn && mapping.incomeTransferColumn && mapping.amountColumn) {
             const rawAmt = cleanAmount(getVal(mapping.amountColumn));
             amount = Math.abs(rawAmt);
             const expenseAcc = String(getVal(mapping.expenseTransferColumn) || '').trim();
             const incomeAcc = String(getVal(mapping.incomeTransferColumn) || '').trim();
             
             if (expenseAcc && incomeAcc) type = 'Transfer';
             else if (incomeAcc) type = 'Income';
             else type = 'Expense';
         } else if (mapping.isCreditDebitSeparate && mapping.creditColumn && mapping.debitColumn) {
             const cr = cleanAmount(getVal(mapping.creditColumn));
             const dr = cleanAmount(getVal(mapping.debitColumn));
             if (cr > 0) { amount = cr; type = 'Income'; }
             else if (dr > 0) { amount = dr; type = 'Expense'; }
         } else if (mapping.amountColumn) {
             const rawVal = getVal(mapping.amountColumn);
             
             // Detect explicit '+' sign (common in CSV exports for Income/Credit)
             // Must check rawVal before cleanAmount strips it
             const hasPlusSign = String(rawVal).trim().startsWith('+');
             
             const val = cleanAmount(rawVal);
             amount = Math.abs(val);

             const strVal = String(rawVal).toLowerCase();
             const hasDr = /\b(dr|debit)\b/i.test(strVal);
             const hasCr = /\b(cr|credit)\b/i.test(strVal);

             if (hasDr) {
                 type = 'Expense';
             } else if (hasCr || hasPlusSign) { // Explicit + means Income
                 type = 'Income';
             } else {
                 const colName = mapping.amountColumn.toLowerCase();
                 const incomeKeywords = ['income', 'credit', 'deposit', 'inflow', 'received', 'cr'];
                 
                 if (incomeKeywords.some(k => colName.includes(k))) {
                     type = val >= 0 ? 'Income' : 'Expense';
                 } else {
                     type = val >= 0 ? 'Expense' : 'Income';
                 }
             }
         }

         if (explicitType) type = explicitType;
         if (amount === 0) return;

         let category = String(getVal(mapping.categoryColumn) || 'Unclassified').trim();
         let subCategory = String(getVal(mapping.subcategoryColumn) || '').trim();
         let notes = String(getVal(mapping.descriptionColumn) || '').trim();
         const project = String(getVal(mapping.projectColumn) || 'None').trim() || 'None';

         const combinedText = (category + ' ' + subCategory + ' ' + notes).toLowerCase();
         
         // 3. SMART CATEGORIZATION (Local)
         
         // Priority 0: CHECK USER LEARNED RULES FIRST (The Brain)
         const learnedCat = getLearnedCategory(notes); // Check notes (description) primarily
         
         if (learnedCat) {
             category = learnedCat;
         }
         // Priority 1: Default Logic (only if not already well-defined)
         else if (category === 'Unclassified' || category === 'General' || category === '' || category === 'SYSTEM') {
             
             // A. Exact Keyword Match from Dictionary
             for (const [key, mappedCat] of Object.entries(CONFIG.category_mapping)) {
                 if (combinedText.includes(key)) {
                     category = mappedCat;
                     if (!subCategory && notes) subCategory = notes; 
                     break; // Stop after first match for efficiency
                 }
             }

             // B. Regex Pattern Match (Higher Precision)
             if (category === 'Unclassified' || category === '') {
                 for (const pattern of CONFIG.smart_patterns) {
                     if (pattern.regex.test(combinedText)) {
                         category = pattern.category;
                         break;
                     }
                 }
             }
         }
         
         category = category.charAt(0).toUpperCase() + category.slice(1);
         if (!subCategory) subCategory = 'General';
         if (category.toLowerCase() === 'nan' || category === '') category = 'Unclassified';

         // 4. Type Correction based on content
         if (!explicitType) {
            if (type === 'Expense' && (hasKeyword(combinedText, CONFIG.keywords.income) || category === 'Salary' || category === 'Income')) {
                type = 'Income';
            }
            if (category === 'Transfer' || category === 'Credit Card Payment') {
                type = 'Transfer';
            }
         }

         // GENERATE DETERMINISTIC ID
         const safeOwner = owner.replace(/[^a-z0-9]/gi, '');
         const safeDesc = notes.substring(0, 10).replace(/[^a-z0-9]/gi, '');
         const id = `${safeOwner}-${dateVal.date}-${amount}-${safeDesc}-${idx}`;

         transactions.push({
             id: id,
             owner,
             type,
             date: dateVal.date,
             time: dateVal.time,
             category,
             subCategory,
             notes,
             amount,
             project: project
         });
     });

     return transactions;
}

const getRuleBasedMapping = (header: string[]): FileMapping => {
    const creditCol = findBestColumn(header, CONFIG.field_synonyms.credit);
    const debitCol = findBestColumn(header, CONFIG.field_synonyms.debit);
    const incomeCol = findBestColumn(header, CONFIG.field_synonyms.income);
    const expenseCol = findBestColumn(header, CONFIG.field_synonyms.expense);
    const amountCol = findBestColumn(header, CONFIG.field_synonyms.amount);

    return {
        dateColumn: findBestColumn(header, CONFIG.field_synonyms.date) || '',
        amountColumn: amountCol,
        categoryColumn: findBestColumn(header, CONFIG.field_synonyms.category),
        subcategoryColumn: findBestColumn(header, CONFIG.field_synonyms.subcategory),
        descriptionColumn: findBestColumn(header, CONFIG.field_synonyms.description),
        typeColumn: findBestColumn(header, CONFIG.field_synonyms.type),
        projectColumn: findBestColumn(header, CONFIG.field_synonyms.project),
        isCreditDebitSeparate: !!(creditCol && debitCol),
        creditColumn: creditCol,
        debitColumn: debitCol,
        expenseTransferColumn: expenseCol,
        incomeTransferColumn: incomeCol
    };
}

// --- NEW FUNCTION: DETECT INTER-ACCOUNT TRANSFERS ---
// Updated to be more strict: Different Owner + (Keywords OR Similarity) + Same Date + Exact Amount
export const identifyInterAccountTransfers = (transactions: Transaction[]): { transactions: Transaction[], transferCount: number } => {
    let transferCount = 0;
    
    // Explicit keywords to look for in descriptions
    // Added Global Keywords: Zelle, Venmo, Wire, SEPA, Faster Payment, Cash App
    const TRANSFER_KEYWORDS = [
        'transfer', 'upi', 'neft', 'imps', 'rtgs', 'payment', 'trf', 'self', 'funds', 'p2a', 'a2a', 'sent to', 'received from',
        'zelle', 'venmo', 'wire', 'sepa', 'faster payment', 'cash app'
    ];

    const hasTransferKeyword = (str: string) => {
        const lower = str.toLowerCase();
        return TRANSFER_KEYWORDS.some(k => lower.includes(k));
    };

    // Helper to extract tokens for similarity check
    const getTokens = (str: string) => {
        return str.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(x => x.length > 2);
    };

    const areDescriptionsSimilar = (d1: string, d2: string) => {
        // If both have explicit banking transfer keywords, that's a good enough signal when combined with exact amount + date match
        if (hasTransferKeyword(d1) && hasTransferKeyword(d2)) return true;

        // Otherwise check for shared meaningful words (like a person's name or merchant)
        const t1 = getTokens(d1);
        const t2 = getTokens(d2);
        const common = t1.filter(token => t2.includes(token));
        
        return common.length > 0; 
    };

    // Group by Date
    const groups = new Map<string, Transaction[]>();
    transactions.forEach(t => {
        if (!groups.has(t.date)) groups.set(t.date, []);
        groups.get(t.date)!.push(t);
    });

    groups.forEach(group => {
        // Optimization: Skip if only 1 transaction or all same type
        if (group.length < 2) return;
        
        // We need pairs of Income/Expense with matching absolute amounts
        const incomes = group.filter(t => t.type === 'Income');
        const expenses = group.filter(t => t.type === 'Expense');
        
        if (incomes.length === 0 || expenses.length === 0) return;

        // Iterate incomes and try to match with an expense
        incomes.forEach(inc => {
            const incAmt = Math.abs(inc.amount);
            
            // Find a matching expense
            // Criteria: 
            // 1. Same Amount
            // 2. Different Owner (File)
            // 3. Similar Description OR Shared Keywords
            const matchIndex = expenses.findIndex(exp => {
                const expAmt = Math.abs(exp.amount);
                
                if (Math.abs(incAmt - expAmt) > 0.01) return false; // Strict amount check
                if (inc.owner === exp.owner) return false; // Must be different files

                const incDesc = inc.notes || inc.category;
                const expDesc = exp.notes || exp.category;
                
                return areDescriptionsSimilar(incDesc, expDesc);
            });

            if (matchIndex !== -1) {
                // We found a match!
                const exp = expenses[matchIndex];
                
                // Convert both to Transfer
                inc.type = 'Transfer';
                inc.category = 'Transfer';
                inc.subCategory = 'Inter-Account';

                exp.type = 'Transfer';
                exp.category = 'Transfer';
                exp.subCategory = 'Inter-Account';
                
                transferCount++;
                
                // Remove the matched expense so it isn't matched again
                expenses.splice(matchIndex, 1);
            }
        });
    });

    return { transactions, transferCount };
};

export const transformData = async (file: File, owner: string): Promise<{ transactions: Transaction[], error?: string }> => {
  // PDF HANDLER
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      // PRE-CHECK: Check if PDF is encrypted before doing anything expensive
      try {
          const rawText = await file.text();
          // This checks the raw PDF bytes for standard encryption markers.
          // Note: file.text() treats binary as text, but keywords are ASCII, so this works for detection.
          if (rawText.includes('/Encrypt') && !rawText.includes('/Encrypt null')) {
             throw new Error("This PDF appears to be password protected. Please remove the password and try again.");
          }
      } catch (err: any) {
          // If the error is our own password error, rethrow it.
          if (err.message && err.message.includes("password protected")) throw err;
          // Otherwise ignore read errors and proceed to let Gemini try
          console.warn("Could not pre-scan PDF for encryption:", err);
      }

      return new Promise(async (resolve, reject) => {
          try {
              const reader = new FileReader();
              reader.onload = async (e) => {
                  const result = e.target?.result as string;
                  // Get Base64 part only
                  const base64 = result.split(',')[1];
                  const rawData = await extractTransactionsFromPDF(base64);
                  
                  if (!Array.isArray(rawData) || rawData.length === 0) {
                      reject(new Error("AI could not extract transactions. Ensure the PDF contains a readable bank statement, not just images."));
                      return;
                  }

                  const transactions: Transaction[] = rawData.reduce((acc: Transaction[], item: any, idx: number) => {
                        const safeOwner = owner.replace(/[^a-z0-9]/gi, '');
                        const desc = item.description || '';
                        const safeDesc = desc.substring(0, 10).replace(/[^a-z0-9]/gi, '');
                        
                        // Strict Date Parsing - normalize any date format from AI to YYYY-MM-DD
                        const parsedDate = parseDate(item.date);
                        if (!parsedDate) return acc; // Skip invalid dates
                        
                        // Strict Category Length - force 2 words max
                        let category = item.category || 'Unclassified';
                        if (category.split(' ').length > 2) {
                            category = category.split(' ').slice(0, 2).join(' ');
                        }

                        // Check User Rules (PDF logic also needs to check memory)
                        const learnedCat = getLearnedCategory(desc);
                        if (learnedCat) {
                            category = learnedCat;
                        }

                        // Clean numeric amount
                        const amount = typeof item.amount === 'number' ? Math.abs(item.amount) : parseFloat(item.amount);
                        const id = `${safeOwner}-${parsedDate.date}-${amount}-${safeDesc}-${idx}`;
                        
                        acc.push({
                            id,
                            owner,
                            type: (item.type === 'Income' || item.type === 'Expense') ? item.type : 'Expense',
                            date: parsedDate.date, // Use standard YYYY-MM-DD from parseDate
                            time: '00:00',
                            category: category,
                            subCategory: 'General',
                            notes: desc,
                            amount: isNaN(amount) ? 0 : amount,
                            project: 'None'
                        });
                        return acc;
                  }, []);
                  
                  resolve({ transactions });
              }
              reader.onerror = () => reject(new Error("Failed to read PDF file"));
              reader.readAsDataURL(file);
          } catch(e) { reject(e); }
      });
  }

  return new Promise(async (resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        let rows: any[][] = [];
        const workbook = XLSX.read(data, { type: 'array', cellDates: true, dateNF: 'yyyy-mm-dd' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });

        if (rows.length < 2) throw new Error("File appears empty or unreadable");

        let headerIdx = 0;
        let maxScore = -Infinity;
        const allKeywords = [...CONFIG.field_synonyms.date, ...CONFIG.field_synonyms.amount, ...CONFIG.field_synonyms.description];
        const scanLimit = Math.min(rows.length, 100);
        
        for(let i=0; i < scanLimit; i++) {
           const row = rows[i];
           if (row.length < 3) continue;
           let score = 0;
           let nonEmptyCells = 0;
           row.forEach((cell: any) => {
               if (cell !== null && cell !== undefined && String(cell).trim() !== '') {
                   nonEmptyCells++;
                   const cellStr = String(cell).toLowerCase().trim();
                   const isNumeric = /^\d+$/.test(cellStr.replace(/[.,-\/]/g, ''));
                   if (isNumeric) score -= 3; 
                   else if (allKeywords.some(k => cellStr.includes(k.toLowerCase()))) score += 3;
                   else if (cellStr.length > 2) score += 0.5;
               }
           });
           if (nonEmptyCells >= 3) score += nonEmptyCells;
           if (score > maxScore) { maxScore = score; headerIdx = i; }
        }

        const header = rows[headerIdx].map(String);
        const dataRows = rows.slice(headerIdx + 1);

        let transactions: Transaction[] = [];
        let mapping: FileMapping | null = null;

        // 1. Try Memory (Stored Mappings)
        mapping = getStoredMapping(header);
        if (mapping) {
            transactions = applyMapping(dataRows, header, mapping, owner);
        }

        // 2. Try Standard AI Mapping (Header-Based)
        if (transactions.length === 0) {
            if (mapping) console.log("Stored mapping yielded 0 results. Retrying with AI.");
            try {
                const sampleRows = dataRows.slice(0, 50);
                mapping = await getFileMappingFromAI(header, sampleRows);
                
                if (mapping && mapping.dateColumn) {
                    console.log("AI provided mapping:", mapping);
                    transactions = applyMapping(dataRows, header, mapping, owner);
                    if (transactions.length > 0) saveMapping(header, mapping);
                }
            } catch (err) {
                console.warn("AI Mapping failed or skipped:", err);
            }
        }

        // 3. Try Rule-Based Fallback
        if (transactions.length === 0) {
            console.log("Falling back to Rule-Based logic.");
            mapping = getRuleBasedMapping(header);
            
            if (mapping.dateColumn) {
                 transactions = applyMapping(dataRows, header, mapping, owner);
                 if (transactions.length > 0) saveMapping(header, mapping);
            }
        }

        // 4. SMART RECOVERY: Try AI Structure Detection on RAW rows
        if (transactions.length === 0) {
            console.log("Standard parsing failed. Attempting Smart AI Structure Recovery...");
            try {
                const rawPreview = rows.slice(0, 50);
                const structure = await detectFileStructure(rawPreview);
                
                if (structure && structure.headerIndex !== -1 && structure.mapping && structure.mapping.dateColumn) {
                    console.log("AI Detected Structure:", structure);
                    
                    const newHeader = rows[structure.headerIndex].map(String);
                    const newDataRows = rows.slice(structure.headerIndex + 1);
                    
                    transactions = applyMapping(newDataRows, newHeader, structure.mapping, owner);
                    
                    if (transactions.length > 0) {
                        saveMapping(newHeader, structure.mapping);
                    }
                }
            } catch (recoveryErr) {
                console.error("AI Smart Recovery Failed:", recoveryErr);
            }
        }

        if (transactions.length === 0) {
             throw new Error("Could not extract valid transactions. Please check if the file has 'Date' and 'Amount' columns, or if it's password protected.");
        }

        resolve({ transactions });

      } catch (err: any) {
        console.error("Transform Error:", err);
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("File reading failed"));
    reader.readAsArrayBuffer(file);
  });
};
