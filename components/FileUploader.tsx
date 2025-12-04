import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Transaction } from '../types';
import { transformData } from '../services/transformer';
import { saveToStorage } from '../services/storageService';
import { Icon } from '../constants';

interface UploadRow {
    id: number;
    owner: string;
    file: File | null;
}

export const FileUploaderSection = ({ onUploadSuccess }: { onUploadSuccess: (data: Transaction[]) => void }) => {
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  
  const [rows, setRows] = useState<UploadRow[]>([
      { id: Date.now(), owner: 'Entity 1', file: null }
  ]);
  
  const [isDragging, setIsDragging] = useState<number | null>(null); 
  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  const progressInterval = useRef<any>(null);

  useEffect(() => {
    let timer: any;
    if (status === 'error' || (status === 'success' && message)) {
      timer = setTimeout(() => {
        // Safe to reset to idle because if status became 'processing', 
        // the effect cleanup would have cleared this timeout.
        setStatus('idle');
        setMessage('');
        setProgress(0);
      }, 5000);
    }
    return () => clearTimeout(timer);
  }, [status, message]);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
        if (progressInterval.current) clearInterval(progressInterval.current);
    }
  }, []);

  // --- ACTIONS ---
  const addRow = () => {
      const nextNum = rows.length + 1;
      setRows([...rows, { id: Date.now(), owner: `Entity ${nextNum}`, file: null }]);
  };

  const removeRow = (id: number) => {
      if (rows.length > 1) {
          setRows(rows.filter(r => r.id !== id));
      } else {
          setRows([{ id: Date.now(), owner: 'Entity 1', file: null }]);
      }
  };

  const updateRowOwner = (id: number, owner: string) => {
      setRows(rows.map(r => r.id === id ? { ...r, owner } : r));
  };

  const updateRowFile = (id: number, file: File | null) => {
      setRows(rows.map(r => r.id === id ? { ...r, file } : r));
  };

  const checkPdfPassword = async (file: File): Promise<boolean> => {
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        try {
            // Read first 10KB usually contains header, but /Encrypt can be in trailer.
            // For robustness, reading text() handles average bank statements well.
            const content = await file.text();
            if (content.includes('/Encrypt') && !content.includes('/Encrypt null')) {
                return true;
            }
        } catch (e) {
            console.warn("Failed to check PDF security", e);
        }
    }
    return false;
  };

  const handleFileSelection = async (id: number, file: File | null) => {
    if (file) {
        // 1. Check for Password Protection immediately
        const isLocked = await checkPdfPassword(file);
        if (isLocked) {
            alert("🔒 This PDF is password protected.\n\nPlease remove the password (print to PDF or use a removal tool) and try again.");
            // Reset the file input value so user can select same file again if they unlock it
            if (fileInputRefs.current[id]) {
                fileInputRefs.current[id]!.value = '';
            }
            return; 
        }
    }
    updateRowFile(id, file);
  };

  // --- DRAG & DROP ---
  const handleDragEvents = (e: React.DragEvent, id: number | null) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.type === 'dragenter' || e.type === 'dragover') setIsDragging(id);
      else if (e.type === 'dragleave' || e.type === 'drop') setIsDragging(null);
  };

  const handleDrop = useCallback(async (e: React.DragEvent, id: number) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(null);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const file = e.dataTransfer.files[0];
          // We need to call the async handler but we can't await it easily inside this callback 
          // without making handleDrop async, which is fine.
          
          // 1. Check Password
          if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
              try {
                  const content = await file.text();
                  if (content.includes('/Encrypt') && !content.includes('/Encrypt null')) {
                       alert("🔒 This PDF is password protected.\n\nPlease remove the password and try again.");
                       return;
                  }
              } catch(err) { console.warn(err); }
          }
          
          updateRowFile(id, file);
      }
  }, [rows]);
  
  const handleProcess = async () => {
    const validRows = rows.filter(r => r.file !== null);
    if (validRows.length === 0) {
        setStatus('error');
        setMessage('Please upload at least one file.');
        return;
    }
    const emptyNames = validRows.filter(r => !r.owner.trim());
    if (emptyNames.length > 0) {
        setStatus('error');
        setMessage('Please ensure all active files have an owner name.');
        return;
    }

    setStatus('processing');
    setMessage('Initializing analysis engine...');
    setProgress(5);
    
    try {
        let allTransactions: Transaction[] = [];
        let processedCount = 0;

        for (const row of validRows) {
            if (!row.file) continue;
            
            setMessage(`Processing ${row.owner}'s file: ${row.file.name}...`);
            
            // --- SMART PROGRESS SIMULATOR (HEARTBEAT) ---
            const targetForFile = 5 + ((processedCount + 1) / validRows.length) * 90;
            
            // Clear any existing heartbeat
            if (progressInterval.current) clearInterval(progressInterval.current);

            // Zeno's Paradox Approach
            progressInterval.current = setInterval(() => {
                setProgress(prev => {
                    const limit = targetForFile - 1; 
                    if (prev >= limit) return prev;
                    
                    const distance = limit - prev;
                    const step = Math.max(0.2, distance * 0.05);
                    return prev + step;
                });
            }, 100);

            try {
                // Perform actual work
                const result = await transformData(row.file, row.owner);
                allTransactions = [...allTransactions, ...result.transactions];
            } finally {
                // Stop heartbeat
                if (progressInterval.current) clearInterval(progressInterval.current);
            }
            
            processedCount++;
            setProgress(targetForFile);
        }

        setProgress(100);

        if (allTransactions.length === 0) {
            setStatus('error');
            setMessage(`Analysis complete, but no valid transactions were found. Please check file format.`);
            return;
        }

        setMessage(`Success! Processed ${allTransactions.length} transactions.`);
        setStatus('success');
        
        onUploadSuccess(allTransactions);

        saveToStorage(allTransactions).catch(err => {
            console.error("Background save error:", err);
        });

    } catch (error: any) {
        if (progressInterval.current) clearInterval(progressInterval.current);
        console.error(error);
        const errorMsg = error.message || 'An error occurred during processing.';
        
        // Provide friendly hint for PDF password errors (Fall back in case check was bypassed)
        if (errorMsg.includes("password protected")) {
            setMessage("🔒 Error: PDF is password protected. Please unlock it and try again.");
        } else {
            setMessage(errorMsg);
        }
        setStatus('error');
    }
  };

  const getButtonContent = () => {
    switch(status) {
        case 'processing': return 'Analyzing...';
        case 'success': return 'Complete!';
        default: return 'Analyze & Calculate FIRE';
    }
  }

  return (
    <div id="upload-section" className="w-full max-w-4xl bg-white/80 backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-2xl border border-white/50 mb-20 transform transition-all hover:scale-[1.01] duration-500">
        <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-800">Upload Financial Data</h2>
            <p className="text-sm text-slate-500 mt-1">Combine expense details from different accounts or family members. Supports CSV, Excel, and PDF Statements.</p>
        </div>
        
        <div className="space-y-4 mb-8">
            {rows.map((row) => (
                <div key={row.id} className="flex flex-col md:flex-row items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow group">
                    {/* Owner Input */}
                    <div className="w-full md:w-1/3">
                        <label htmlFor={`entity-${row.id}`} className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Entity</label>
                        <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                            <div className="pl-3 text-slate-400">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16" className="w-4 h-4 icon-safe">
                                    <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <input 
                                id={`entity-${row.id}`}
                                type="text" 
                                value={row.owner}
                                onChange={(e) => updateRowOwner(row.id, e.target.value)}
                                className="w-full bg-transparent border-none focus:ring-0 text-sm font-semibold text-slate-700 py-3 px-2 placeholder-slate-400"
                                placeholder="Entity (e.g. Me)"
                            />
                        </div>
                    </div>

                    {/* File Drop Zone */}
                    <div className="w-full md:flex-1">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Upload Expense Details</label>
                        <div 
                            className={`relative border-2 border-dashed rounded-lg transition-all duration-200 cursor-pointer flex items-center justify-center py-2.5 px-4 ${isDragging === row.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'}`}
                            onDragEnter={(e) => handleDragEvents(e, row.id)} 
                            onDragOver={(e) => handleDragEvents(e, row.id)} 
                            onDragLeave={(e) => handleDragEvents(e, null)} 
                            onDrop={(e) => handleDrop(e, row.id)}
                            onClick={() => fileInputRefs.current[row.id]?.click()}
                            role="button"
                            aria-label="Upload File Drop Zone"
                        >
                            <input
                                type="file"
                                accept=".csv,.xlsx,.xls,.pdf"
                                ref={(el) => { if(el) fileInputRefs.current[row.id] = el }}
                                className="hidden"
                                onChange={(e) => handleFileSelection(row.id, e.target.files ? e.target.files[0] : null)}
                            />
                            
                            {row.file ? (
                                <div className="flex items-center gap-2 text-sm text-slate-700 w-full">
                                    <div className="w-6 h-6 rounded bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="16" height="16" className="w-4 h-4 icon-safe">
                                            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <span className="truncate font-medium flex-1">{row.file.name}</span>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); updateRowFile(row.id, null); }}
                                        className="p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-500 transition-colors"
                                        aria-label="Remove File"
                                    >
                                        <Icon name="close" className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-slate-400 text-sm">
                                    <Icon name="upload" className={`w-4 h-4 ${isDragging === row.id ? 'text-blue-500' : ''}`} />
                                    <span>{isDragging === row.id ? 'Drop File Here' : 'Drop file or click to upload'}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Delete Row Button */}
                    <div className="w-full md:w-auto flex justify-end md:pt-0">
                         <button 
                            onClick={() => removeRow(row.id)}
                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove Row"
                            aria-label="Remove Entity Row"
                         >
                             <Icon name="trash" className="w-5 h-5" />
                         </button>
                    </div>
                </div>
            ))}
            
            <button onClick={addRow} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 font-bold hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 text-sm">
                <span>+ Add Family Member / New File</span>
            </button>
        </div>

        <div className="flex flex-col items-center gap-6">
            <button 
                onClick={handleProcess} 
                disabled={status === 'processing' || rows.every(r => !r.file)}
                className="w-full sm:w-auto min-w-[280px] px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-lg shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-3"
            >
                {status === 'processing' && <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {getButtonContent()}
                {status !== 'processing' && <span className="text-xl">→</span>}
            </button>

            {(status === 'processing' || status === 'success' || status === 'error') && (
                <div className="w-full max-w-md animate-fade-in">
                    <div className="flex justify-between text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">
                        <span>Processing</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div 
                        className={`h-full rounded-full ${status === 'error' ? 'bg-red-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'}`} 
                        style={{ width: `${progress}%`, transition: 'width 0.1s linear' }}
                        ></div>
                    </div>
                    <p className={`text-center text-sm mt-3 font-medium ${status === 'error' ? 'text-red-600' : 'text-slate-600'}`}>{message}</p>
                </div>
            )}
        </div>
    </div>
  );
};