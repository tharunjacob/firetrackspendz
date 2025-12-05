import React, { useState, useRef, useCallback } from 'react';
import { Transaction, FileJob } from '../types';
import { Icon } from '../constants';

interface UploadRow {
    id: number;
    owner: string;
    file: File | null;
}

interface FileUploaderProps {
    onStartAnalysis: (jobs: FileJob[]) => void;
    isProcessing: boolean;
    progress: number;
}

export const FileUploaderSection = ({ onStartAnalysis, isProcessing, progress }: FileUploaderProps) => {
  const [rows, setRows] = useState<UploadRow[]>([
      { id: Date.now(), owner: '', file: null }
  ]);
  
  const [isDragging, setIsDragging] = useState<number | null>(null); 
  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

  // --- HELPER: Generate Name from File ---
  const generateEntityName = (fileName: string): string => {
      // Remove extension
      const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
      // Take first 15 chars, replace underscores/hyphens with spaces for readability
      let cleanName = nameWithoutExt.substring(0, 15).replace(/[-_]/g, ' ');
      // Capitalize first letter
      return cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
  };

  const getUniqueName = (baseName: string, usedNames: Set<string>): string => {
      let name = baseName;
      let counter = 2;
      while (usedNames.has(name)) {
          name = `${baseName}_${counter}`;
          counter++;
      }
      return name;
  };

  // --- ACTIONS ---
  const addRow = () => {
      setRows([...rows, { id: Date.now(), owner: '', file: null }]);
  };

  const removeRow = (id: number) => {
      if (rows.length > 1) {
          setRows(rows.filter(r => r.id !== id));
      } else {
          setRows([{ id: Date.now(), owner: '', file: null }]);
      }
  };

  const updateRowOwner = (id: number, owner: string) => {
      setRows(rows.map(r => r.id === id ? { ...r, owner } : r));
  };

  const updateRowFile = (id: number, file: File | null) => {
      setRows(currentRows => {
          const usedNames = new Set<string>();
          currentRows.forEach(r => {
              if (r.id !== id && r.owner) usedNames.add(r.owner);
          });

          return currentRows.map(r => {
              if (r.id !== id) return r;
              
              let newOwner = r.owner;
              if (file && !r.owner) {
                  const base = generateEntityName(file.name);
                  newOwner = getUniqueName(base, usedNames);
              }
              return { ...r, file, owner: newOwner };
          });
      });
  };

  // --- BULK FILE HANDLING ---
  const handleBulkFiles = async (targetRowId: number, fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;

      const files = Array.from(fileList);
      
      // Check for passwords in PDFs (Basic check)
      for (const file of files) {
          if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
              try {
                  const content = await file.text();
                  if (content.includes('/Encrypt') && !content.includes('/Encrypt null')) {
                      alert(`🔒 Skipped "${file.name}": Password protected.`);
                      continue; // Skip this file but process others
                  }
              } catch(e) { console.warn(e); }
          }
      }

      setRows(prevRows => {
          const newRows = [...prevRows];
          const targetIndex = newRows.findIndex(r => r.id === targetRowId);
          
          if (targetIndex === -1) return prevRows;

          const usedNames = new Set<string>();
          newRows.forEach((r, idx) => {
              if (idx !== targetIndex && r.owner) usedNames.add(r.owner);
          });

          // 1. Assign the first file to the targeted row
          const firstFile = files[0];
          let targetOwner = newRows[targetIndex].owner;
          
          if (!targetOwner) {
              const base = generateEntityName(firstFile.name);
              targetOwner = getUniqueName(base, usedNames);
          }
          usedNames.add(targetOwner);

          newRows[targetIndex] = {
              ...newRows[targetIndex],
              file: firstFile,
              owner: targetOwner
          };

          // 2. Insert new rows for remaining files immediately after the target row
          const additionalRows = files.slice(1).map(f => {
              const base = generateEntityName(f.name);
              const uniqueName = getUniqueName(base, usedNames);
              usedNames.add(uniqueName);
              
              return {
                  id: Date.now() + Math.random(), // Ensure unique ID
                  owner: uniqueName,
                  file: f
              };
          });

          newRows.splice(targetIndex + 1, 0, ...additionalRows);
          return newRows;
      });

      // Clear input value to allow re-selection of same files if needed
      if (fileInputRefs.current[targetRowId]) {
          fileInputRefs.current[targetRowId]!.value = '';
      }
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
          handleBulkFiles(id, e.dataTransfer.files);
      }
  }, []);
  
  const handleStart = async () => {
    if (isProcessing) return;
    const validRows = rows.filter(r => r.file !== null);
    if (validRows.length === 0) {
        alert('Please upload at least one file.');
        return;
    }

    // Auto-fill names if user deleted them but left file
    const jobs: FileJob[] = validRows.map(r => ({
        owner: r.owner.trim() || generateEntityName(r.file!.name),
        file: r.file!
    }));

    // Hand off to Parent (App.tsx)
    onStartAnalysis(jobs);
  };

  return (
    <div id="upload-section" className="w-full max-w-4xl bg-white/80 backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-2xl border border-white/50 mb-20 transform transition-all hover:scale-[1.01] duration-500">
        <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-800">Upload Financial Data</h2>
            <p className="text-sm text-slate-500 mt-1">Combine expense details from different accounts. <strong>Select multiple files at once.</strong></p>
        </div>
        
        <div className="space-y-4 mb-8">
            {rows.map((row) => (
                <div key={row.id} className="flex flex-col md:flex-row items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow group">
                    {/* Owner Input */}
                    <div className="w-full md:w-1/3">
                        <label htmlFor={`entity-${row.id}`} className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Entity or File Name</label>
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
                                placeholder={row.file ? generateEntityName(row.file.name) : "Jacob's Expense File 1"}
                                disabled={isProcessing}
                            />
                        </div>
                    </div>

                    {/* File Drop Zone */}
                    <div className="w-full md:flex-1">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Upload File (PDF, CSV, Excel)</label>
                        <div 
                            className={`relative border-2 border-dashed rounded-lg transition-all duration-200 flex items-center justify-center py-2.5 px-4 ${isDragging === row.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'} ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            onDragEnter={(e) => !isProcessing && handleDragEvents(e, row.id)} 
                            onDragOver={(e) => !isProcessing && handleDragEvents(e, row.id)} 
                            onDragLeave={(e) => !isProcessing && handleDragEvents(e, null)} 
                            onDrop={(e) => !isProcessing && handleDrop(e, row.id)}
                            onClick={() => !isProcessing && fileInputRefs.current[row.id]?.click()}
                            role="button"
                            aria-label="Upload File Drop Zone"
                        >
                            <input
                                type="file"
                                accept=".csv,.xlsx,.xls,.pdf"
                                multiple
                                ref={(el) => { if(el) fileInputRefs.current[row.id] = el }}
                                className="hidden"
                                onChange={(e) => handleBulkFiles(row.id, e.target.files)}
                                disabled={isProcessing}
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
                                        onClick={(e) => { e.stopPropagation(); if(!isProcessing) updateRowFile(row.id, null); }}
                                        className="p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-500 transition-colors disabled:opacity-0"
                                        aria-label="Remove File"
                                        disabled={isProcessing}
                                    >
                                        <Icon name="close" className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-slate-400 text-sm">
                                    <Icon name="upload" className={`w-4 h-4 ${isDragging === row.id ? 'text-blue-500' : ''}`} />
                                    <span>{isDragging === row.id ? 'Drop Files Here' : 'Drop files (PDF/Excel) here'}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Delete Row Button */}
                    <div className="w-full md:w-auto flex justify-end md:pt-0">
                         <button 
                            onClick={() => removeRow(row.id)}
                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Remove Row"
                            aria-label="Remove Entity Row"
                            disabled={isProcessing}
                         >
                             <Icon name="trash" className="w-5 h-5" />
                         </button>
                    </div>
                </div>
            ))}
            
            <button 
                onClick={addRow} 
                disabled={isProcessing}
                className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 font-bold hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <span>+ Add Row manually</span>
            </button>
        </div>

        <div className="flex flex-col items-center gap-6">
            {isProcessing ? (
                <div className="w-full max-w-[280px] animate-fade-in">
                     <div className="w-full bg-slate-100 rounded-full h-4 mb-3 overflow-hidden border border-slate-200 shadow-inner relative">
                          <div 
                              className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 relative"
                              style={{ width: `${Math.max(5, progress)}%`, transition: 'width 0.5s ease-out' }}
                          >
                              <div className="absolute inset-0 bg-white/30 w-full h-full animate-pulse"></div>
                          </div>
                     </div>
                     <p className="text-center text-slate-500 text-sm font-bold animate-pulse">
                         Analyzing Data... {progress}%
                     </p>
                </div>
            ) : (
                <button 
                    onClick={handleStart} 
                    disabled={rows.every(r => !r.file)}
                    className="w-full sm:w-auto min-w-[280px] px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-lg shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-3"
                >
                    <span className="text-xl">→</span>
                    Analyze & Calculate FIRE
                </button>
            )}
        </div>
    </div>
  );
};