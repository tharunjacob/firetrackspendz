import React, { useState, useRef } from 'react';
import { Icon } from '@/components/common/Icons';
import { parseCSVImport, parseExcelToSheets, applyAssetMapping, type SheetData } from '@/services/assetStorage';
import { detectAssetFileStructure, isAIAvailable } from '@/services/gemini';
import type { AssetSnapshot, NetAssetConfig } from '@/types/assets';

interface Props {
  config: NetAssetConfig;
  currency: string;
  onImport: (snapshots: AssetSnapshot[]) => void;
}

const TEMPLATE_CSV = `Date,Owner,Category,Accessibility,Principal,Total
2025-01-01,Me,Savings,Liquid,50000,50000
2025-01-01,Me,Mutual Funds,Investment,100000,112000
2025-01-01,Me,Stocks,Investment,30000,42000
2025-01-01,Me,Gold,Investment,20000,25000
2025-01-01,Me,401k / Pension,Retirement,80000,95000
2025-02-01,Me,Savings,Liquid,55000,55000
2025-02-01,Me,Mutual Funds,Investment,110000,118000`;

const ACCEPTED_EXTENSIONS = ['.csv', '.tsv', '.xlsx', '.xls'];

export const AssetCSVImport: React.FC<Props> = ({ config: _config, currency, onImport }) => {
  const [preview, setPreview] = useState<Partial<AssetSnapshot>[]>([]);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [sheetOptions, setSheetOptions] = useState<SheetData[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const isAcceptedFile = (name: string) =>
    ACCEPTED_EXTENSIONS.some(ext => name.toLowerCase().endsWith(ext));

  const isExcelFile = (name: string) =>
    name.toLowerCase().endsWith('.xlsx') || name.toLowerCase().endsWith('.xls');

  // AI-powered detection for arbitrary file formats
  const detectAndPreview = async (rows: any[][]) => {
    if (!isAIAvailable()) {
      setError('AI detection requires a Gemini API key. Please use the CSV template format instead.');
      return;
    }

    setIsDetecting(true);
    setError('');
    try {
      const result = await detectAssetFileStructure(rows);
      if (!result) {
        setError('Could not detect file structure. Please use the CSV template format.');
        return;
      }
      const mapped = applyAssetMapping(rows, result.headerIndex, result.mapping);
      if (mapped.length === 0) {
        setError('No valid asset entries found after mapping. Check that the file has Date and Value columns.');
        return;
      }
      setPreview(mapped);
    } catch (e: any) {
      setError(e.message || 'Failed to analyze file structure.');
    } finally {
      setIsDetecting(false);
    }
  };

  const handleExcelFile = async (file: File) => {
    setError('');
    setSheetOptions([]);
    try {
      const buffer = await file.arrayBuffer();
      const sheets = parseExcelToSheets(buffer);

      if (sheets.length === 0) {
        setError('No data found in the Excel file.');
        return;
      }

      if (sheets.length === 1) {
        // Single sheet — go straight to AI detection
        await detectAndPreview(sheets[0].rows);
      } else {
        // Multiple sheets — let user pick
        setSheetOptions(sheets);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to read Excel file.');
    }
  };

  const handleCSVFile = (file: File) => {
    setError('');
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      // Try standard template parsing first
      const parsed = parseCSVImport(text);
      if (parsed.length > 0) {
        setPreview(parsed);
        return;
      }
      // Fallback: try AI detection on raw CSV rows
      const rows = text.trim().split('\n').map(line =>
        line.split(/[,\t]/).map(c => c.trim())
      );
      if (rows.length < 2) {
        setError('File appears to be empty or has only a header.');
        return;
      }
      await detectAndPreview(rows);
    };
    reader.readAsText(file);
  };

  const handleFile = (file: File) => {
    setPreview([]);
    setSheetOptions([]);
    if (isExcelFile(file.name)) {
      handleExcelFile(file);
    } else {
      handleCSVFile(file);
    }
  };

  const handleSheetSelect = async (sheet: SheetData) => {
    setSheetOptions([]);
    await detectAndPreview(sheet.rows);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && isAcceptedFile(file.name)) handleFile(file);
    else setError('Please upload a .csv, .xlsx, or .xls file');
  };

  const handleImport = () => {
    const now = new Date().toISOString();
    const snapshots: AssetSnapshot[] = preview.map((p, i) => ({
      id: `import_${p.date}_${p.owner}_${p.category}_${i}`.replace(/\s+/g, '-').toLowerCase(),
      user_id: '',
      date: p.date || '',
      owner: p.owner || 'Me',
      category: p.category || 'Other',
      accessibility_tier: p.accessibility_tier || 'Investment',
      principal: p.principal || 0,
      current_value: p.current_value || 0,
      currency: p.currency || currency,
      notes: 'Imported from file',
      created_at: now,
    }));
    onImport(snapshots);
    setPreview([]);
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trackspendz_asset_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const uniqueDates = [...new Set(preview.map(p => p.date))];
  const uniqueOwners = [...new Set(preview.map(p => p.owner))];

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h3 className="text-lg font-bold text-slate-700 mb-2">Import Historical Data</h3>
        <p className="text-sm text-slate-500 mb-4">
          Upload a CSV or Excel file with your asset history. Each row should represent one asset category for one owner on one date.
          {isAIAvailable() && (
            <span className="text-brand-600 ml-1">AI will automatically detect your file format.</span>
          )}
        </p>

        {/* Template download */}
        <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">CSV template format:</span>
            <button onClick={downloadTemplate} className="text-sm text-brand-600 hover:underline flex items-center gap-1">
              <Icon name="download" className="w-4 h-4" /> Download Template
            </button>
          </div>
          <code className="text-xs text-slate-500 block overflow-x-auto whitespace-pre">
            Date,Owner,Category,Accessibility,Principal,Total{'\n'}
            2025-01-01,Me,Savings,Liquid,50000,50000{'\n'}
            2025-01-01,Me,Stocks,Investment,30000,42000
          </code>
          {isAIAvailable() && (
            <p className="text-xs text-slate-400 mt-2">
              Or upload any Excel/CSV — AI will try to detect your columns automatically.
            </p>
          )}
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:border-brand-300'
          }`}
        >
          <Icon name="upload" className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Drop your file here or click to browse</p>
          <p className="text-xs text-slate-400 mt-1">Supports CSV, TSV, XLSX, XLS</p>
          <input ref={fileRef} type="file" accept=".csv,.tsv,.xlsx,.xls" className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>

        {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
      </div>

      {/* Sheet selector (for multi-sheet Excel workbooks) */}
      {sheetOptions.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-3">Multiple sheets detected. Select one:</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sheetOptions.map((sheet, i) => (
              <button
                key={i}
                onClick={() => handleSheetSelect(sheet)}
                className="text-left p-4 rounded-xl border border-slate-200 hover:border-brand-400 hover:bg-brand-50 transition-colors"
              >
                <p className="font-medium text-slate-700">{sheet.name}</p>
                <p className="text-xs text-slate-400 mt-1">{sheet.rows.length} rows</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* AI detection spinner */}
      {isDetecting && (
        <div className="card p-8 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">AI is analyzing your file structure...</p>
          <p className="text-xs text-slate-400 mt-1">Detecting columns, dates, and values</p>
        </div>
      )}

      {/* Preview */}
      {preview.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-700">Preview: {preview.length} entries</h3>
              <p className="text-xs text-slate-400">
                {uniqueDates.length} date(s), {uniqueOwners.length} owner(s)
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPreview([])} className="btn-secondary text-sm px-4 py-2">Cancel</button>
              <button onClick={handleImport} className="btn-primary text-sm px-6 py-2">
                Import {preview.length} Entries
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-700 text-xs text-slate-500 dark:text-slate-400 uppercase sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Owner</th>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-left">Tier</th>
                  <th className="px-3 py-2 text-right">Principal</th>
                  <th className="px-3 py-2 text-right">Current Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {preview.slice(0, 100).map((p, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-3 py-1.5">{p.date}</td>
                    <td className="px-3 py-1.5">{p.owner}</td>
                    <td className="px-3 py-1.5">{p.category}</td>
                    <td className="px-3 py-1.5 text-xs text-slate-400">{p.accessibility_tier}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs">{(p.principal || 0).toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs font-medium">{(p.current_value || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 100 && (
              <p className="text-xs text-slate-400 text-center py-2">Showing first 100 of {preview.length}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
