import { vi, describe, it, expect, beforeAll } from 'vitest';
import { jsPDF } from 'jspdf';
import * as pdfjsLib from 'pdfjs-dist';
import { createRequire } from 'node:module';

// In the browser the worker is served from /pdf.worker.min.js (public/). In this
// test environment there is no server, so point pdfjs at the real worker file in
// node_modules. This is truthy, so production's getPdfJs leaves it untouched —
// production behavior is not altered by this.
const nodeRequire = createRequire(import.meta.url);
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = nodeRequire.resolve(
  'pdfjs-dist/build/pdf.worker.min.js',
);

// These tests guard the PDF password-detection flow (the upload "green tick"
// experience) WITHOUT touching the network or Gemini. They generate synthetic
// encrypted/plain PDFs at runtime with jsPDF — no real bank data is committed —
// and exercise the real production functions from transformer.ts.
//
// This is the deterministic coverage that was missing when the PDF flow broke:
// the only prior PDF tests lived in gemini-live.test.ts, which is network-gated
// and excluded from the normal test run.

// Mock gemini so importing transformer never reaches the network.
vi.mock('../gemini', () => ({
  getFileMappingFromAI: vi.fn().mockResolvedValue(null),
  detectFileStructure: vi.fn().mockResolvedValue(null),
  extractTransactionsFromPDF: vi.fn().mockResolvedValue([]),
}));

// Avoid Supabase initialization side-effects.
vi.mock('../supabase', () => ({
  supabase: null,
  isCloudEnabled: () => false,
  getSupabase: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(),
    },
  }),
}));

import { isPdfEncrypted, validatePdfPassword } from '../transformer';

const USER_PASSWORD = 'secret123';
const OWNER_PASSWORD = 'owner999';

/** Build a tiny PDF (optionally encrypted) and wrap it in a File. */
const makePdfFile = (name: string, encrypted: boolean): File => {
  const opts: any = { unit: 'pt', format: 'a4' };
  if (encrypted) {
    opts.encryption = { userPassword: USER_PASSWORD, ownerPassword: OWNER_PASSWORD };
  }
  const doc = new jsPDF(opts);
  doc.text('15/03/2025 SWIGGY 450.00 Dr', 40, 60);
  doc.text('16/03/2025 SALARY 85000.00 Cr', 40, 80);
  const bytes = new Uint8Array(doc.output('arraybuffer'));
  return new File([bytes], name, { type: 'application/pdf' });
};

describe('PDF password detection (offline, deterministic)', () => {
  let encryptedPdf: File;
  let plainPdf: File;

  beforeAll(() => {
    // pdfjs runs on the main thread in the test environment (no worker server).
    encryptedPdf = makePdfFile('encrypted.pdf', true);
    plainPdf = makePdfFile('plain.pdf', false);
  });

  describe('isPdfEncrypted', () => {
    it('detects a password-protected PDF as encrypted', async () => {
      await expect(isPdfEncrypted(encryptedPdf)).resolves.toBe(true);
    });

    it('detects a normal PDF as not encrypted', async () => {
      await expect(isPdfEncrypted(plainPdf)).resolves.toBe(false);
    });

    it('returns false for non-PDF files without reading them', async () => {
      const csv = new File(['Date,Amount\n2025-01-01,10'], 'data.csv', { type: 'text/csv' });
      await expect(isPdfEncrypted(csv)).resolves.toBe(false);
    });
  });

  describe('validatePdfPassword', () => {
    it('rejects an incorrect password', async () => {
      await expect(validatePdfPassword(encryptedPdf, 'WRONG_PASSWORD')).resolves.toBe(false);
    });

    it('accepts the correct password', async () => {
      await expect(validatePdfPassword(encryptedPdf, USER_PASSWORD)).resolves.toBe(true);
    });

    it('accepts an unencrypted PDF (no password needed)', async () => {
      await expect(validatePdfPassword(plainPdf)).resolves.toBe(true);
    });

    it('treats non-PDF files as valid (nothing to unlock)', async () => {
      const csv = new File(['Date,Amount\n2025-01-01,10'], 'data.csv', { type: 'text/csv' });
      await expect(validatePdfPassword(csv, 'anything')).resolves.toBe(true);
    });
  });
});
