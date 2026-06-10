import { vi, describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist';
import { extractTransactionsFromPDF } from '../gemini';

// Mock supabase to force direct Gemini API dev fallback
vi.mock('../supabase', () => ({
  supabase: null,
  isCloudEnabled: () => false,
  getSupabase: () => {
    throw new Error('Supabase disabled for direct Gemini test mode');
  },
}));

// Set worker to empty string for synchronous Node execution
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = '';

async function extractTextFromPdf(filePath: string, password?: string): Promise<string> {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const loadingTask = pdfjsLib.getDocument({ data, password });
  const pdf = await loadingTask.promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join('  ');
    fullText += pageText + '\n';
  }
  return fullText;
}

describe('Gemini Live API & Prompt Tests', () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

  it('checks if Gemini API key is available', () => {
    console.log('Detected VITE_GEMINI_API_KEY:', apiKey ? 'FOUND (starts with ' + apiKey.substring(0, 7) + '...)' : 'MISSING');
    expect(apiKey).toBeDefined();
    expect(apiKey.length).toBeGreaterThan(10);
  });

  if (!apiKey) {
    console.warn('Skipping live Gemini tests because VITE_GEMINI_API_KEY is not defined in .env.');
    return;
  }

  describe('Synthetic Edge Cases', () => {
    it('correctly processes Indian UPI narrations and categories', async () => {
      const mockStatement = `
        15/03/2025  UPI/SWIGGY/9876543210/SWIG00  450.00  Dr  5000.00
        16/03/2025  UPI-ACME CORP INC-SAL  85000.00  Cr  90000.00
        17/03/2025  ATM CASH WDL 001 SBI ATM  5000.00  Dr  85000.00
        18/03/2025  NETFLIX ENTERTAINMENT  649.00  Dr  84351.00
        19/03/2025  TRANSFER TO SAVINGS A/C  10000.00  Dr  74351.00
      `;

      console.log('Sending synthetic Indian statement to Gemini...');
      const transactions = await extractTransactionsFromPDF(mockStatement, true);
      console.log('Parsed synthetic transactions:', JSON.stringify(transactions, null, 2));

      expect(transactions).toBeDefined();
      expect(transactions.length).toBeGreaterThan(0);

      // Check fields of first transaction
      const swiggyTx = transactions.find(t => t.description.toLowerCase().includes('swiggy'));
      expect(swiggyTx).toBeDefined();
      expect(swiggyTx.amount).toBe(450);
      expect(swiggyTx.type).toBe('Expense');
      expect(swiggyTx.category).toBe('Food');
      expect(swiggyTx.date).toBe('2025-03-15');

      // Check salary transaction
      const salaryTx = transactions.find(t => t.description.toLowerCase().includes('salary') || t.description.toLowerCase().includes('acme'));
      expect(salaryTx).toBeDefined();
      expect(salaryTx.type).toBe('Income');
      expect(salaryTx.category).toBe('Salary');

      // Check transfer transaction
      const transferTx = transactions.find(t => t.description.toLowerCase().includes('savings') || t.description.toLowerCase().includes('transfer'));
      expect(transferTx).toBeDefined();
      expect(transferTx.type).toBe('Transfer');
      expect(transferTx.category).toBe('Transfer');
    }, 45000);

    it('correctly processes US signed amount column format', async () => {
      const mockStatement = `
        Date,Description,Amount,Balance
        03/15/2025,CHASE CREDIT CARD PMT,1500.00,2500.00
        03/16/2025,STARBUCKS COFFEE -4.50,2495.50
        03/17/2025,WAL-MART SUPERCENTER -120.45,2375.05
        03/18/2025,INTEREST PAYMENT 1.25,2376.30
      `;

      console.log('Sending US signed-amount statement to Gemini...');
      const transactions = await extractTransactionsFromPDF(mockStatement, true);
      console.log('Parsed US transactions:', JSON.stringify(transactions, null, 2));

      expect(transactions).toBeDefined();
      expect(transactions.length).toBeGreaterThan(0);

      const starbucks = transactions.find(t => t.description.toLowerCase().includes('starbucks'));
      expect(starbucks).toBeDefined();
      expect(starbucks.amount).toBe(4.5);
      expect(starbucks.type).toBe('Expense');
      expect(starbucks.category).toBe('Food');

      const interest = transactions.find(t => t.description.toLowerCase().includes('interest'));
      expect(interest).toBeDefined();
      expect(interest.amount).toBe(1.25);
      expect(interest.type).toBe('Income');
    }, 45000);
  });

  describe('Real PDF Statement Tests', () => {
    const archiveDir = 'C:\\Users\\tharunj\\Downloads\\ClaudeCoWork\\Personal Projects\\TrackSpendZ\\Archive';

    it('parses Testfile2_Password_170719929736.pdf successfully', async () => {
      const pdfPath = path.join(archiveDir, 'Testfile2_Password_170719929736.pdf');
      if (!fs.existsSync(pdfPath)) {
        console.warn(`PDF file not found at ${pdfPath}, skipping test.`);
        return;
      }

      console.log('Extracting text from Testfile2...');
      const text = await extractTextFromPdf(pdfPath, '170719929736');
      console.log('Sending Testfile2 text to Gemini (length:', text.length, ')...');
      
      const transactions = await extractTransactionsFromPDF(text, true);
      console.log(`Parsed ${transactions.length} transactions from Testfile2:`);
      console.log(JSON.stringify(transactions.slice(0, 10), null, 2)); // show first 10

      expect(transactions).toBeDefined();
      expect(transactions.length).toBeGreaterThan(0);

      // Verify a few merchants we saw in the pdf dump: Zepto, Bigtree, Swiggy
      const zepto = transactions.find(t => t.description.toLowerCase().includes('zepto') && t.amount === 253);
      expect(zepto).toBeDefined();

      const bigtree = transactions.find(t => (t.description.toLowerCase().includes('bigtree') || t.description.toLowerCase().includes('entertainment')) && t.amount === 181.86);
      expect(bigtree).toBeDefined();

      const swiggy = transactions.find(t => t.description.toLowerCase().includes('swiggy') && t.amount === 812);
      expect(swiggy).toBeDefined();
    }, 90000);

    it('parses Testfile3_Password_THAR1707.pdf successfully', async () => {
      const pdfPath = path.join(archiveDir, 'Testfile3_Password_THAR1707.pdf');
      if (!fs.existsSync(pdfPath)) {
        console.warn(`PDF file not found at ${pdfPath}, skipping test.`);
        return;
      }

      console.log('Extracting text from Testfile3...');
      const text = await extractTextFromPdf(pdfPath, 'THAR1707');
      console.log('Sending Testfile3 text to Gemini (length:', text.length, ')...');

      const transactions = await extractTransactionsFromPDF(text, true);
      console.log(`Parsed ${transactions.length} transactions from Testfile3:`);
      console.log(JSON.stringify(transactions.slice(0, 10), null, 2)); // show first 10

      expect(transactions).toBeDefined();
      expect(transactions.length).toBeGreaterThan(0);

      // Let's check some values we saw in page 2 text dump
      const kumarAutomobile = transactions.find(t => t.description.toLowerCase().includes('kumar') && t.amount === 600);
      expect(kumarAutomobile).toBeDefined();

      const irctc = transactions.find(t => t.description.toLowerCase().includes('irctc') && t.amount === 2464.13);
      expect(irctc).toBeDefined();
    }, 90000);
  });
});
