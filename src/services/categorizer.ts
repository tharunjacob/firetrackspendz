/**
 * Static rules used by `transformer.ts` to categorize transactions when no
 * user-trained rule matches. Three layers: field synonyms (map arbitrary bank
 * headers to our fields), keywords (type detection), category_mapping (merchant→
 * category), and smart_patterns (regexes for transfer wire prefixes).
 * Edit with care — changes shift categorization for every existing user.
 */
export const CONFIG = {
  field_synonyms: {
    amount: ['Amount', 'Cost', 'Value', 'Price', 'Total', 'Sum', 'Paid', 'Spent', 'Expense', 'Outflow', 'Money Out', 'Debit', 'Withdrawal', 'Charge', 'Credit Amount', 'Inflow', 'Money In', 'Income', 'Deposit', 'Received', 'Transaction Amount', 'Debits', 'Credits', 'Net Amount', 'amount_inr', 'amount_rs', 'rs', '\u20B9', 'inr', 'amt', '$', '\u00A3', '\u20AC', 'Withdrawal Amt.', 'Deposit Amt.', 'Withdrawal Amt', 'Deposit Amt',
      'Gross', 'Net',                                      // PayPal exports
      // International
      'Betrag', 'Umsatz',                                  // German
      'Montant', 'Somme',                                  // French
      'Importe', 'Monto', 'Cantidad',                      // Spanish / LatAm
      'Importo',                                           // Italian
      'Valor',                                             // Portuguese
      'Bedrag',                                            // Dutch
      'Belopp',                                            // Swedish
    ],
    ignore_columns: ['Balance', 'Running Balance', 'Avail Bal', 'Available Balance', 'Total Balance', 'Closing Balance', 'Saldo', 'Solde'],
    income: ['Income', 'Earning', 'Inflow', 'Credit', 'Money In', 'Deposit', 'Received', 'Income(Transfer In)', 'Income (Transfer In)', 'Transfer In', 'Credit Amount', 'cr_amount', 'Deposit Amount', 'Deposit Amt.', 'Deposit Amt',
      'Paid in', 'Paid In',                                // HSBC / Natwest UK style
      'Haben', 'Eingang',                                  // German
      'Cr\u00E9dit', 'Credit',                                  // French
      'Cr\u00E9dito', 'Abono',                                  // Spanish
    ],
    expense: ['Expense', 'Spend', 'Outflow', 'Debit', 'Cost', 'Money Out', 'Payment', 'Withdrawal', 'Expense(Transfer Out)', 'Expense (Transfer Out)', 'Transfer Out', 'Debit Amount', 'dr_amount', 'Withdrawal Amount', 'Withdrawal Amt.', 'Withdrawal Amt',
      'Paid out', 'Paid Out',                              // HSBC / Natwest UK style
      'Soll', 'Ausgang',                                   // German
      'D\u00E9bit',                                             // French
      'D\u00E9bito', 'Cargo',                                   // Spanish
    ],
    credit: ['Credit', 'Cr', 'Deposit', 'Incoming', 'Credit Amount', 'Inflow', 'Deposit Amt.', 'Deposit Amt',
      'Paid in', 'Paid In',                                // HSBC / Natwest UK style
      'Haben', 'Cr\u00E9dit', 'Cr\u00E9dito', 'Abono'],
    debit: ['Debit', 'Dr', 'Withdrawal', 'Outgoing', 'Debit Amount', 'Outflow', 'Withdrawal Amt.', 'Withdrawal Amt',
      'Paid out', 'Paid Out',                              // HSBC / Natwest UK style
      'Soll', 'D\u00E9bit', 'D\u00E9bito', 'Cargo'],
    type: ['Type', 'Transaction Type', 'Nature', 'Kind', 'Flow', 'Dr/Cr', 'Direction',
      'Umsatzart', 'Buchungsart',                          // German
      'Type d\'op\u00E9ration', 'Nature op\u00E9ration',             // French
      'Tipo', 'Tipo de operaci\u00F3n',                         // Spanish
    ],
    category: ['Category', 'Main Category', 'Group', 'Classification', 'Primary Category', 'Class', 'Tag',
      'Kategorie', 'Cat\u00E9gorie', 'Categor\u00EDa', 'Categoria'],
    subcategory: ['Subcategory', 'Sub-Category', 'Sub Category', 'subCategory', 'sub_category', 'Secondary Category', 'Subgroup', 'Envelope', 'Budget Group',
      'Unterkategorie', 'Sous-cat\u00E9gorie', 'Subcategor\u00EDa'],
    description: ['Notes', 'Note', 'Memo', 'Description', 'Detail', 'Details', 'Item', 'Narrative', 'Reference', 'Remarks', 'Comment', 'Payee', 'Merchant', 'Vendor', 'Transaction Details', 'Transaction Description', 'Transaction', 'Name', 'Purpose', 'particulars', 'narration', 'desc', 'Party Name',
      'Verwendungszweck', 'Buchungstext', 'Beschreibung',  // German
      'Libell\u00E9', 'Libelle', 'Description op\u00E9ration',       // French
      'Concepto', 'Descripci\u00F3n', 'Detalle',                // Spanish
      'Descrizione', 'Causale',                            // Italian
      'Descri\u00E7\u00E3o', 'Hist\u00F3rico',                            // Portuguese
      'Omschrijving',                                      // Dutch
    ],
    date: ['Date', 'Transaction Date', 'Posting Date', 'Booked Date', 'Posted Date', 'Time', 'Datetime', 'Posted At', 'Created At', 'Timestamp', 'Txn Date', 'Value Date',
      'Buchungstag', 'Wertstellung', 'Datum',              // German
      'Date d\'op\u00E9ration', 'Date op\u00E9ration', 'Date valeur', // French
      'Fecha', 'Fecha operaci\u00F3n', 'Fecha valor',           // Spanish
      'Data',                                              // Italian / Portuguese
      'Datum',                                             // Dutch / Swedish
    ],
    project: ['Project', 'Tag', 'Reference', 'Label',
      'Projekt', 'Projet', 'Proyecto'],
  },
  keywords: {
    expense: ['entertainment', 'food', 'dining', 'shopping', 'transport', 'travel', 'health', 'medical', 'education', 'fuel', 'restaurant', 'grocery', 'bills', 'utilities', 'rent', 'insurance', 'purchase', 'expense', 'withdraw', 'debit', 'dr'],
    income: ['salary', 'wage', 'income', 'bonus', 'dividend', 'interest', 'refund', 'cashback', 'deposit', 'earning', 'revenue', 'freelance', 'pension', 'credit', 'cr'],
    transfer: ['transfer', 'internal', 'move', 'top up', 'adjustment', 'initial balance', 'reconcile', 'self', 'own account'],
  },
  category_mapping: {
    'swiggy': 'Food', 'zomato': 'Food', 'eat': 'Food', 'food': 'Food', 'doordash': 'Food', 'grubhub': 'Food', 'deliveroo': 'Food',
    'restaurant': 'Food', 'cafe': 'Food', 'coffee': 'Food', 'starbucks': 'Food', 'dunkin': 'Food',
    'mcdonalds': 'Food', 'kfc': 'Food', 'burger': 'Food', 'pizza': 'Food', 'subway': 'Food', 'chipotle': 'Food',
    'dominos': 'Food', 'biryani': 'Food', 'baker': 'Food', 'cake': 'Food',
    'grofers': 'Groceries', 'bigbasket': 'Groceries', 'blinkit': 'Groceries', 'instacart': 'Groceries',
    'zepto': 'Groceries', 'supermarket': 'Groceries', 'whole foods': 'Groceries', 'walmart': 'Groceries',
    'mart': 'Groceries', 'vegetable': 'Groceries', 'tesco': 'Groceries', 'aldi': 'Groceries',
    'kroger': 'Groceries', 'costco': 'Groceries', 'dmart': 'Groceries', 'target': 'Groceries',
    'uber': 'Transport', 'ola': 'Transport', 'rapido': 'Transport', 'lyft': 'Transport',
    'fuel': 'Transport', 'petrol': 'Transport', 'diesel': 'Transport', 'shell': 'Transport',
    'toll': 'Transport', 'fastag': 'Transport', 'ezpass': 'Transport', 'metro': 'Transport',
    'irctc': 'Transport', 'railway': 'Transport', 'flight': 'Transport', 'parking': 'Transport',
    'bus': 'Transport', 'taxi': 'Transport', 'cab': 'Transport',
    'amazon': 'Shopping', 'flipkart': 'Shopping', 'myntra': 'Shopping', 'ebay': 'Shopping',
    'retail': 'Shopping', 'store': 'Shopping', 'etsy': 'Shopping', 'nike': 'Shopping',
    'zara': 'Shopping', 'h&m': 'Shopping', 'ikea': 'Shopping', 'best buy': 'Shopping', 'apple': 'Shopping',
    'bescom': 'Utilities', 'electricity': 'Utilities', 'water': 'Utilities', 'power': 'Utilities',
    'bill': 'Utilities', 'recharge': 'Utilities', 'jio': 'Utilities', 'airtel': 'Utilities',
    'verizon': 'Utilities', 'at&t': 'Utilities', 'broadband': 'Utilities', 'internet': 'Utilities',
    'netflix': 'Entertainment', 'prime': 'Entertainment', 'spotify': 'Entertainment', 'hulu': 'Entertainment', 'disney': 'Entertainment',
    'youtube': 'Entertainment', 'hotstar': 'Entertainment', 'bookmyshow': 'Entertainment',
    'cinema': 'Entertainment', 'movie': 'Entertainment', 'game': 'Entertainment', 'steam': 'Entertainment',
    'hospital': 'Health', 'pharmacy': 'Health', 'apollo': 'Health', 'cvs': 'Health',
    '1mg': 'Health', 'doctor': 'Health', 'clinic': 'Health', 'gym': 'Health', 'fitness': 'Health',
    'medical': 'Health', 'medicine': 'Health', 'dentist': 'Health',
    'course': 'Education', 'udemy': 'Education', 'coursera': 'Education', 'book': 'Education',
    'school': 'Education', 'college': 'Education', 'tuition': 'Education', 'university': 'Education',
    'zerodha': 'Investment', 'groww': 'Investment', 'upstox': 'Investment', 'robinhood': 'Investment',
    'mutual fund': 'Investment', 'sip': 'Investment', 'ppf': 'Investment', 'vanguard': 'Investment',
    'lic': 'Investment', 'insurance': 'Investment', 'premium': 'Investment', '401k': 'Investment',
    'salary': 'Salary', 'dividend': 'Income', 'interest': 'Income', 'refund': 'Income', 'payroll': 'Salary',
    'cashback': 'Income', 'bonus': 'Income',
    'rent': 'Housing', 'maintenance': 'Housing', 'loan': 'EMI', 'mortgage': 'Housing',
  } as Record<string, string>,
  smart_patterns: [
    { regex: /^(UPI|IMPS|NEFT|RTGS|ACH|ZELLE|VENMO)([-/ ])?.*(ZOMATO|SWIGGY|DOORDASH|UBER\s?EATS)/i, category: 'Food' },
    { regex: /^(UPI|IMPS|NEFT|RTGS|ACH|ZELLE|VENMO)([-/ ])?.*(UBER|OLA|LYFT)/i, category: 'Transport' },
    { regex: /^(UPI|IMPS|NEFT|RTGS|ACH|ZELLE|VENMO)([-/ ])?.*(AMAZON|FLIPKART|EBAY)/i, category: 'Shopping' },
    { regex: /^(UPI|IMPS|NEFT|RTGS|ACH|ZELLE|VENMO)([-/ ])?.*(ZERODHA|GROWW|ROBINHOOD|VANGUARD)/i, category: 'Investment' },
    { regex: /^ATM\s?WDL/i, category: 'Cash' },
    { regex: /^ATM\s?CASH/i, category: 'Cash' },
    { regex: /^POS\s/i, category: 'Shopping' },
    { regex: /^ACH\s?DR/i, category: 'Bill Payment' },
    { regex: /^ACH\s?C/i, category: 'Income' },
    { regex: /^INT\.?\s?PD/i, category: 'Income' },
    { regex: /^(DD|DIRECT DEBIT)/i, category: 'Bill Payment' },
    { regex: /^(SO|STANDING ORDER)/i, category: 'Transfer' },
    { regex: /\b(loan|emi|mortgage)\b/i, category: 'EMI' },
    { regex: /^(UPI|IMPS|NEFT|RTGS|ZELLE|VENMO|WIRE|SEPA|FASTER PAY)/i, category: 'Transfer' },
  ],
};

/** Case-insensitive, whole-word match of any keyword in `text`. Escapes regex metachars. */
export const hasKeyword = (text: string, keywords: string[]): boolean => {
  for (const k of keywords) {
    const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b`, 'i').test(text)) return true;
  }
  return false;
};
