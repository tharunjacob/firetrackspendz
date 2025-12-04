import { GoogleGenAI } from "@google/genai/web";
import { FileMapping } from '../types';

// The API key must be obtained exclusively from the environment variable VITE_API_KEY.
// In Vite, client-side code uses import.meta.env instead of process.env
const API_KEY = import.meta.env.VITE_API_KEY;

if (!API_KEY) {
  console.warn("Gemini API key not found. AI features will be disabled. Please set VITE_API_KEY in your .env file.");
}

// Initialize AI only if key exists to prevent immediate crash
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

// HELPER: Cleans AI response to ensure valid JSON parsing
// This prevents "brittleness" if the AI adds markdown backticks (```json ... ```)
const cleanJSON = (text: string | undefined): string => {
    if (!text) return "{}";
    let cleaned = text.trim();
    // Remove markdown code blocks if present
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(json)?/, '').replace(/```$/, '');
    }
    return cleaned.trim();
};

export const generateFinancialInsights = async (summary: string): Promise<string> => {
  if (!ai || !API_KEY) {
    return "AI Insights unavailable. Please configure the API Key in your environment variables.";
  }
  
  try {
    const prompt = `
      You are a world-class financial advisor AI known for creative, non-obvious, and highly actionable advice.
      Based on the following financial summary, provide 3-5 unique and personalized financial strategies.
      Avoid generic advice like "spend less". Instead, suggest specific actions, challenges, or mindset shifts.
      Frame your advice positively, focusing on opportunities and building good habits.
      Present each insight as a bullet point starting with a relevant emoji.

      Financial Summary:
      ${summary}

      Example of the high-quality insights I expect:
      * 💡 Your freelance income is impressive! Instead of just saving the extra, consider 'paying yourself' a fixed salary and treating the rest as a business profit to be reinvested in skills or equipment to grow even faster.
      * Challenge: Your spending on 'Subscriptions' has crept up. Try a 'subscription audit' this weekend: cancel everything you haven't used in a month. You might be surprised how much you save.
      * 🌱 'Groceries' is a big category. A great way to optimize this is to try 'meal prepping' for 3 days a week. It not only saves money but also time during busy weekdays.

      Now, provide your expert, creative, and actionable insights for the summary above:
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    if (!response.text) {
        throw new Error("Received an empty response from the AI.");
    }
    
    return response.text;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return "Unable to generate insights at this time. Please try again later.";
  }
};

export const getStrategicAdvice = async (context: string, question: string): Promise<string> => {
  if (!ai || !API_KEY) return "AI Service Unavailable. Please check API Key configuration.";

  try {
    const prompt = `
    You are TrackSpendz AI, a strategic CFO for personal finance. 
    
    CONTEXT (Health Score & Patterns):
    ${context}

    USER QUESTION: "${question}"

    Task: Answer the user's question specifically using the context provided. 
    If they ask for advice, be specific based on their 'Health Score' and 'Anomalies'.
    Keep it concise, encouraging, and professional yet friendly.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "I couldn't generate a response.";
  } catch (e) {
    return "Error connecting to AI Advisor.";
  }
};

export const getFileMappingFromAI = async (headers: string[], sampleRows: any[][]): Promise<FileMapping | null> => {
  if (!ai || !API_KEY) return null;

  try {
    const prompt = `
    I have a CSV/Excel file with financial transactions. I need to map its columns to a standard format so I can process it.
    
    Headers found in file: ${JSON.stringify(headers)}
    
    Sample Data (${sampleRows.length} rows): 
    ${JSON.stringify(sampleRows)}

    Your task is to analyze the headers and the data content to identify which column corresponds to standard fields.
    
    Return a JSON object STRICTLY matching this structure:
    {
      "dateColumn": "Name of the column containing the transaction date",
      "dateFormat": "Format of the date if discernable (e.g., 'YYYYMMDD', 'DD/MM/YYYY', 'ExcelSerial')",
      "amountColumn": "Name of the column containing the transaction amount (if single column)",
      "categoryColumn": "Name of the column for category (or null)",
      "subcategoryColumn": "Name of the column for subcategory (or null)",
      "descriptionColumn": "Name of the column for notes/description (or null)",
      "typeColumn": "Name of the column explicitly specifying Income/Expense type (or null)",
      "projectColumn": "Name of column for Project/Tag (or null)",
      "isCreditDebitSeparate": boolean, // True if file has separate Debit and Credit columns
      "creditColumn": "Name of Credit/Deposit column if separate (or null)",
      "debitColumn": "Name of Debit/Withdrawal column if separate (or null)",
      "expenseTransferColumn": "Specific to AndroMoney: 'Expense(Transfer Out)' column name (or null)",
      "incomeTransferColumn": "Specific to AndroMoney: 'Income(Transfer In)' column name (or null)"
    }

    Logic Guidelines:
    1. If you see columns like "Expense(Transfer Out)" and "Income(Transfer In)", map them to expenseTransferColumn/incomeTransferColumn.
    2. If you see separate "Debit" and "Credit" columns (or Withdrawal/Deposit), set isCreditDebitSeparate to true and map them.
    3. If only one amount column exists, map it to amountColumn.
    4. Check if there is an explicit "Type" column (often values like "Income", "Expense", "Transfer").
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    if (!response.text) return null;
    return JSON.parse(cleanJSON(response.text)) as FileMapping;
  } catch (error) {
    console.warn("AI Mapping Error:", error);
    return null;
  }
};

export const detectFileStructure = async (rawRows: any[][]): Promise<{ headerIndex: number, mapping: FileMapping } | null> => {
    if (!ai || !API_KEY) return null;

    try {
        const prompt = `
        I have a raw dataset extracted from a financial file (CSV/Excel). The file might contain metadata rows at the top (like address, account info) before the actual header row.
        
        Here are the first 50 rows of the data:
        ${JSON.stringify(rawRows)}

        TASK:
        1. Identify the 0-based index of the row that serves as the HEADER for the transaction table. It usually contains columns like "Date", "Description", "Narration", "Amount", "Debit", "Credit", "Balance".
        2. Create a mapping for the columns based on that header row.

        Return a JSON object STRICTLY matching this structure:
        {
            "headerIndex": number, // The 0-based index of the header row. Return -1 if not found.
            "mapping": {
                "dateColumn": "Exact name of date column",
                "dateFormat": "Format if known",
                "amountColumn": "Exact name of amount column (or null if using debit/credit)",
                "categoryColumn": "Exact name of category column (or null)",
                "subcategoryColumn": "Exact name of subcategory column (or null)",
                "descriptionColumn": "Exact name of description/narration column",
                "typeColumn": "Exact name of type column (or null)",
                "projectColumn": "Exact name of project column (or null)",
                "isCreditDebitSeparate": boolean,
                "creditColumn": "Exact name of Credit/Deposit column (or null)",
                "debitColumn": "Exact name of Debit/Withdrawal column (or null)",
                "expenseTransferColumn": null,
                "incomeTransferColumn": null
            }
        }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });

        if (!response.text) return null;
        return JSON.parse(cleanJSON(response.text));
    } catch (error) {
        console.warn("AI Structure Detection Error:", error);
        return null;
    }
};

export const suggestCategories = async (descriptions: string[]): Promise<Record<string, string>> => {
    if (!ai || !API_KEY) return {};

    try {
        const prompt = `
        I have a list of transaction descriptions/narrations. Please categorize them into standard personal finance categories (e.g., Food, Transport, Utilities, Shopping, Entertainment, Health, Salary, Transfer, Rent, Groceries, Travel).

        Descriptions:
        ${JSON.stringify(descriptions)}

        STRICT CONSTRAINT: Categories must be concise (MAXIMUM 2 WORDS). 

        Return a JSON object where keys are the EXACT descriptions provided and values are the suggested Category.
        Example: { "UBER *TRIP": "Transport", "NETFLIX": "Entertainment" }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });

        if (!response.text) return {};
        return JSON.parse(cleanJSON(response.text));
    } catch (error) {
        console.error("AI Categorization Error:", error);
        return {};
    }
};

export const extractTransactionsFromPDF = async (base64Data: string): Promise<any[]> => {
  if (!ai || !API_KEY) return [];
  
  const prompt = `
    Analyze this bank statement PDF. Extract all financial transactions into a minified JSON array of arrays.
    
    Output Format: [[date, description, raw_amount_string, type, category], ...]
    
    Columns:
    0. Date (STRICTLY YYYY-MM-DD format, e.g. 2024-05-25. Convert from DD/MM/YYYY if needed.)
    1. Description (String)
    2. Raw Amount (String, exactly as shown in PDF, e.g. "+70.00", "1,200.00", "50.00 Dr")
    3. Type ("Income" or "Expense")
    4. Category (Suggested category, MAX 2 WORDS, e.g. "Food", "Transport", "Dining Out")

    Rules:
    - Keep the amount exactly as shown (do not strip signs).
    - Ignore opening/closing balances.
    - If the amount is a Credit, Refund, or has a '+' sign, mark type as 'Income'.
    
    Return ONLY the raw JSON array of arrays. No markdown.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: 'application/pdf', data: base64Data } }] }
      ]
    });
    
    // Clean response
    const rawText = cleanJSON(response.text);
    const rawData = JSON.parse(rawText);

    if (!Array.isArray(rawData)) return [];

    // Map minified array back to objects for the app
    return rawData.map((row: any[]) => {
        const rawAmountStr = String(row[2]);
        const description = String(row[1]);
        
        // Clean numeric amount
        let amount = parseFloat(rawAmountStr.replace(/[^0-9.]/g, ''));
        
        // --- DETERMINISTIC POST-PROCESSING ---
        // AI can be stubborn with credit card positive/negative logic.
        // 1. Check for explicit signs in the amount string
        let type = row[3];
        
        if (rawAmountStr.includes('+') || rawAmountStr.toLowerCase().includes('cr') || rawAmountStr.toLowerCase().includes('credit')) {
            type = 'Income';
        } else if (rawAmountStr.toLowerCase().includes('dr') || rawAmountStr.toLowerCase().includes('debit')) {
            type = 'Expense';
        }

        // 2. Fallback: Check description for clear refund keywords if it's not already Income
        if (type !== 'Income') {
            const descLower = description.toLowerCase();
            if (descLower.includes('refund') || descLower.includes('cashback') || descLower.includes('reversal') || descLower.includes('money back')) {
                type = 'Income';
            }
        }
        
        return {
            date: row[0],
            description: description,
            amount: isNaN(amount) ? 0 : amount,
            type: type,
            category: row[4] || 'Unclassified'
        };
    });
  } catch (e) {
    console.error("PDF Extraction Error", e);
    return [];
  }
};