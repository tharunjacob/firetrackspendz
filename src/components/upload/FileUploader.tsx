import React, { useState, useRef } from 'react';
import { Icon } from '@/components/common/Icons';
import { isPdfEncrypted } from '@/services/transformer';
import type { FileJob } from '@/types';
import { logEvent, EVENTS } from '@/services/logger';
import { LIMITS } from '@/config/storage';
import { useAuth } from '@/contexts/AuthContext';
import { isPlanAtLeast } from '@/config/plans';

interface FileRow {
  id: string;
  file: File | null;
  owner: string;
  password: string;
  needsPassword: boolean;
  status: 'idle' | 'checking' | 'ready' | 'error';
  error?: string;
}

interface FileUploaderProps {
  onStartAnalysis: (jobs: FileJob[]) => Promise<void>;
  isProcessing: boolean;
  progress: number;
}

export const FileUploader = ({ onStartAnalysis, isProcessing, progress }: FileUploaderProps) => {
  const { plan } = useAuth();
  const maxFileSize = isPlanAtLeast(plan, 'pro') ? LIMITS.MAX_FILE_SIZE_PRO : LIMITS.MAX_FILE_SIZE_FREE;

  const [rows, setRows] = useState<FileRow[]>([
    { id: '1', file: null, owner: '', password: '', needsPassword: false, status: 'idle' },
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);

  const updateRow = (id: string, updates: Partial<FileRow>) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const addRow = () => {
    setRows(prev => [...prev, { id: Date.now().toString(), file: null, owner: '', password: '', needsPassword: false, status: 'idle' }]);
  };

  const removeRow = (id: string) => {
    if (rows.length <= 1) return;
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const triggerFilePick = (rowId: string) => {
    setActiveRowId(rowId);
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (rowId: string, file: File) => {
    updateRow(rowId, { file, status: 'checking', error: undefined });
    logEvent(EVENTS.UPLOAD_FILE_SELECTED, {
      fileName: file.name,
      fileSizeKb: Math.round(file.size / 1024),
      fileType: file.name.split('.').pop()?.toLowerCase(),
    });

    if (file.size > maxFileSize) {
      updateRow(rowId, {
        status: 'error',
        error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${maxFileSize / 1024 / 1024} MB.`,
      });
      return;
    }

    // Auto-fill owner from filename
    const baseName = file.name.replace(/\.(xlsx?|csv|pdf|tsv)$/i, '').replace(/[_-]/g, ' ');
    const currentRow = rows.find(r => r.id === rowId);
    if (!currentRow?.owner) updateRow(rowId, { owner: baseName });

    if (file.name.toLowerCase().endsWith('.pdf')) {
      try {
        const encrypted = await isPdfEncrypted(file);
        updateRow(rowId, { needsPassword: encrypted, status: encrypted ? 'idle' : 'ready' });
      } catch {
        updateRow(rowId, { status: 'ready' });
      }
    } else {
      updateRow(rowId, { status: 'ready' });
    }
  };

  const handleDrop = (rowId: string, e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      logEvent(EVENTS.UPLOAD_FILE_DROPPED, {
        fileName: file.name,
        fileSizeKb: Math.round(file.size / 1024),
        fileType: file.name.split('.').pop()?.toLowerCase(),
      });
      handleFileSelect(rowId, file);
    }
  };

  const handleAnalyze = () => {
    const jobs: FileJob[] = rows
      .filter(r => r.file && r.owner.trim() && (r.status === 'ready' || (r.needsPassword && r.password)))
      .map(r => ({ file: r.file!, owner: r.owner.trim(), password: r.needsPassword ? r.password : undefined }));

    if (jobs.length === 0) return;
    logEvent(EVENTS.UPLOAD_ANALYSIS_STARTED, {
      fileCount: jobs.length,
      fileNames: jobs.map(j => j.file.name),
    });
    onStartAnalysis(jobs);
  };

  const readyCount = rows.filter(r => r.file && r.owner.trim() && (r.status === 'ready' || (r.needsPassword && r.password))).length;

  // ── Encrypted PDF password block (shared between layouts) ──
  const PasswordPrompt = ({ row }: { row: FileRow }) => row.needsPassword ? (
    <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-xl px-3 py-2 w-full">
      <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
      <div className="flex flex-col gap-1 flex-1">
        <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">This PDF is password-protected</span>
        <input
          type="password"
          placeholder="Enter PDF password"
          value={row.password}
          onChange={e => updateRow(row.id, { password: e.target.value })}
          className="text-sm bg-white dark:bg-slate-700 border border-amber-300 dark:border-amber-700 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent w-full dark:text-slate-100"
          autoFocus
        />
      </div>
      {row.password && (
        <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shrink-0">
          <Icon name="check" className="w-3 h-3 text-white" />
        </div>
      )}
    </div>
  ) : null;

  return (
    <div id="upload-section" className="w-full max-w-4xl mx-auto px-4">
      <div className="card p-5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-1">Upload Your Statements</h2>
        <p className="text-sm text-slate-500 mb-5 sm:mb-6">Bank statements, credit card bills, or expense exports in Excel, CSV, or PDF format.</p>

        {/* ── Mobile layout (below sm) ─────────────────────────── */}
        <div className="sm:hidden space-y-4">
          {rows.map((row, index) => (
            <div key={row.id} className="bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">

              {/* Step 1: Large tap-to-select area */}
              <button
                type="button"
                onClick={() => triggerFilePick(row.id)}
                className={`w-full flex flex-col items-center justify-center gap-3 py-8 px-4 transition-colors active:opacity-80 ${
                  row.file ? 'bg-green-50 dark:bg-green-950/30' : 'bg-white dark:bg-slate-800'
                }`}
              >
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${row.file ? 'bg-green-100' : 'bg-brand-50'}`}>
                  {row.status === 'checking' ? (
                    <div className="w-7 h-7 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin" />
                  ) : row.file ? (
                    <Icon name="check" className="w-8 h-8 text-green-600" />
                  ) : (
                    <Icon name="upload" className="w-8 h-8 text-brand-600" />
                  )}
                </div>
                <div className="text-center">
                  {row.file ? (
                    <>
                      <p className="font-semibold text-green-700 text-sm leading-snug">{row.file.name}</p>
                      <p className="text-xs text-green-500 mt-1">{(row.file.size / 1024).toFixed(0)} KB · Tap to change</p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-slate-700 text-base">
                        {index === 0 ? 'Select your file' : `Add file ${index + 1}`}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">Excel, CSV, or PDF</p>
                    </>
                  )}
                </div>
              </button>

              {/* Error message */}
              {row.status === 'error' && row.error && (
                <div className="px-4 py-2 bg-red-50 border-t border-red-100">
                  <p className="text-xs text-red-600">{row.error}</p>
                </div>
              )}

              {/* Step 2: Account name – shows after file selected */}
              {row.file && row.status !== 'error' && (
                <div className="px-4 pb-4 pt-3 border-t border-slate-100">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    Account name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. HDFC Savings, SBI Credit"
                    value={row.owner}
                    onChange={e => updateRow(row.id, { owner: e.target.value })}
                    className="input-field w-full"
                  />
                </div>
              )}

              {/* Password for encrypted PDFs */}
              {row.needsPassword && (
                <div className="px-4 pb-4">
                  <PasswordPrompt row={row} />
                </div>
              )}

              {/* Remove button (multi-file) */}
              {rows.length > 1 && (
                <div className="flex justify-end px-4 pb-3 border-t border-slate-100 pt-2">
                  <button
                    onClick={() => removeRow(row.id)}
                    className="text-slate-400 text-xs flex items-center gap-1 min-h-[44px] py-2 active:text-red-500"
                  >
                    <Icon name="trash" className="w-4 h-4" /> Remove
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Add another file */}
          <button
            onClick={addRow}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm text-brand-600 font-medium border border-dashed border-brand-300 rounded-xl min-h-[44px] active:bg-brand-50 transition-colors"
          >
            <Icon name="plus" className="w-4 h-4" /> Add Another File
          </button>

          {/* Step 3: Analyze */}
          <button
            onClick={handleAnalyze}
            disabled={readyCount === 0 || isProcessing}
            className="btn-primary w-full min-h-[52px] text-base disabled:opacity-50"
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing ({progress}%)
              </span>
            ) : readyCount === 0 ? (
              'Select a file above to continue'
            ) : (
              `Analyze ${readyCount} File${readyCount !== 1 ? 's' : ''}`
            )}
          </button>

          {isProcessing && (
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div className="bg-brand-600 h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>

        {/* ── Desktop layout (sm and above) ───────────────────── */}
        <div className="hidden sm:block">
          <div className="space-y-4">
            {rows.map((row) => (
              <div key={row.id} className="flex flex-col gap-1">
                <div className="flex flex-col sm:flex-row gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                  {/* Owner Name */}
                  <input
                    type="text"
                    placeholder="Account name"
                    value={row.owner}
                    onChange={e => updateRow(row.id, { owner: e.target.value })}
                    className="input-field sm:w-40"
                  />

                  {/* File Drop Zone */}
                  <div
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => handleDrop(row.id, e)}
                    onClick={() => triggerFilePick(row.id)}
                    className={`flex-1 border-2 border-dashed rounded-xl px-4 py-3 text-center cursor-pointer transition-colors
                      ${row.file ? 'border-green-300 bg-green-50' : 'border-slate-200 hover:border-brand-300 hover:bg-brand-50'}`}
                  >
                    {row.file ? (
                      <span className="text-sm text-green-700 font-medium">{row.file.name} ({(row.file.size / 1024).toFixed(0)} KB)</span>
                    ) : (
                      <span className="text-sm text-slate-400">Drop file or click to browse</span>
                    )}
                  </div>

                  {/* Password prompt for encrypted PDF */}
                  {row.needsPassword && (
                    <div className="sm:w-auto w-full">
                      <PasswordPrompt row={row} />
                    </div>
                  )}

                  {/* Status */}
                  <div className="flex items-center gap-2">
                    {row.status === 'checking' && <div className="w-5 h-5 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin" />}
                    {row.status === 'ready' && <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center"><Icon name="check" className="w-3 h-3 text-white" /></div>}
                    {row.status === 'error' && <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shrink-0" title={row.error}><Icon name="close" className="w-3 h-3 text-white" /></div>}
                    {rows.length > 1 && (
                      <button onClick={() => removeRow(row.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                        <Icon name="trash" className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
                {row.status === 'error' && row.error && (
                  <p className="text-xs text-red-600 px-1">{row.error}</p>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-6">
            <button onClick={addRow} className="text-sm text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
              <Icon name="plus" className="w-4 h-4" /> Add Another File
            </button>

            <button
              onClick={handleAnalyze}
              disabled={readyCount === 0 || isProcessing}
              className="btn-primary"
            >
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing ({progress}%)
                </span>
              ) : (
                `Analyze ${readyCount} File${readyCount !== 1 ? 's' : ''}`
              )}
            </button>
          </div>

          {isProcessing && (
            <div className="mt-4 w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div className="bg-brand-600 h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>

        {/* Shared hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.tsv,.pdf"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file && activeRowId) handleFileSelect(activeRowId, file);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
};
