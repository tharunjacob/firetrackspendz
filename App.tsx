
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Transaction } from './types';
import Dashboard from './Dashboard';
import { Icon } from './constants';
import { transformData } from './services/transformer';
import { loadFromStorage, saveToStorage, deleteFromStorage, resetApplicationData } from './services/storageService';
import { PricingPage, ContactPage, FeaturesPage, PrivacyPage, TermsPage } from './components/PublicPages';

// --- COMPONENTS ---

const Toast = ({ message, onClose }: { message: string, onClose: () => void }) => (
    <div className="fixed bottom-6 right-6 z-[100] animate-fade-in">
        <div className="bg-slate-900 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700">
            <div className="bg-green-500 rounded-full p-1">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3 text-slate-900">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
            </div>
            <span className="font-medium text-sm">{message}</span>
            <button onClick={onClose} className="ml-2 text-slate-400 hover:text-white" aria-label="Close Notification">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>
    </div>
);

const Logo = () => (
    <div className="relative w-10 h-10 transition-transform hover:scale-105 duration-500">
        <div className="absolute inset-0 bg-blue-600 rounded-lg rotate-6 opacity-20 blur-md animate-pulse"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg shadow-xl flex items-center justify-center text-white border border-white/10">
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 drop-shadow-md">
                <path d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
                <path d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
            </svg>
        </div>
    </div>
);

const Navbar = ({ activeView, setView }: { activeView: string, setView: (v: string) => void }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const handleNav = (view: string) => {
        setView(view);
        setIsMenuOpen(false);
    };

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200">
            <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleNav('home')}>
                    <Logo />
                    <span className="font-bold text-xl text-slate-800 tracking-tight">Track<span className="text-blue-600">Spendz</span></span>
                </div>
                
                {/* Desktop Menu */}
                <div className="hidden md:flex items-center gap-6">
                    <button onClick={() => setView('home')} className={`text-sm font-medium transition-colors ${activeView === 'home' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>Home</button>
                    <button onClick={() => setView('features')} className={`text-sm font-medium transition-colors ${activeView === 'features' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>Features</button>
                    {/* Pricing Hidden */}
                    <button onClick={() => setView('contact')} className={`text-sm font-medium transition-colors ${activeView === 'contact' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>Help</button>
                </div>

                {/* Mobile Menu Toggle */}
                <button 
                    className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" 
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    aria-label="Toggle Menu"
                >
                    {isMenuOpen ? <Icon name="close" className="w-6 h-6" /> : <Icon name="menu" className="w-6 h-6" />}
                </button>
            </div>

            {/* Mobile Menu Dropdown */}
            {isMenuOpen && (
                <div className="md:hidden bg-white border-t border-slate-100 shadow-xl absolute w-full left-0 animate-fade-in">
                    <div className="flex flex-col p-4 space-y-2">
                        <button onClick={() => handleNav('home')} className={`text-left px-4 py-3 rounded-xl font-medium ${activeView === 'home' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}>Home</button>
                        <button onClick={() => handleNav('features')} className={`text-left px-4 py-3 rounded-xl font-medium ${activeView === 'features' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}>Features</button>
                        {/* Pricing Hidden */}
                        <button onClick={() => handleNav('contact')} className={`text-left px-4 py-3 rounded-xl font-medium ${activeView === 'contact' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}>Help Center</button>
                    </div>
                </div>
            )}
        </nav>
    );
};

const Footer = ({ setView }: { setView: (v: string) => void }) => (
    <footer className="bg-white border-t border-slate-200 py-12 mt-auto">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
                <div className="flex items-center gap-2 mb-4">
                    <span className="font-bold text-lg text-slate-800">Track<span className="text-blue-600">Spendz</span></span>
                </div>
                <p className="text-slate-500 text-sm leading-relaxed max-w-xs">
                    The privacy-first financial dashboard that helps you discover your FIRE number and optimize your path to financial freedom.
                </p>
                <p className="text-slate-400 text-xs mt-6">© {new Date().getFullYear()} TrackSpendz. All rights reserved.</p>
            </div>
            <div>
                <h4 className="font-bold text-slate-800 mb-4">Product</h4>
                <ul className="space-y-2 text-sm text-slate-500">
                    <li><button onClick={() => setView('features')} className="hover:text-blue-600">Features</button></li>
                    {/* Pricing Hidden */}
                    <li><button onClick={() => setView('home')} className="hover:text-blue-600">FIRE Calculator</button></li>
                </ul>
            </div>
            <div>
                <h4 className="font-bold text-slate-800 mb-4">Support & Legal</h4>
                <ul className="space-y-2 text-sm text-slate-500">
                    <li><a href="mailto:support@trackspendz.com" className="hover:text-blue-600">support@trackspendz.com</a></li>
                    <li><button onClick={() => setView('contact')} className="hover:text-blue-600">Contact Us</button></li>
                    <li><button onClick={() => setView('privacy')} className="hover:text-blue-600">Privacy Policy</button></li>
                    <li><button onClick={() => setView('terms')} className="hover:text-blue-600">Terms & Conditions</button></li>
                </ul>
            </div>
        </div>
    </footer>
);

interface UploadRow {
    id: number;
    owner: string;
    file: File | null;
}

const FileUploaderSection = ({ onUploadSuccess }: { onUploadSuccess: (data: Transaction[]) => void }) => {
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  
  // Row-based state (Old Layout)
  const [rows, setRows] = useState<UploadRow[]>([
      { id: Date.now(), owner: 'Entity 1', file: null }
  ]);
  
  const [isDragging, setIsDragging] = useState<number | null>(null); 
  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

  useEffect(() => {
    if (status === 'error' || (status === 'success' && message)) {
      const timer = setTimeout(() => {
        setStatus('idle');
        setMessage('');
        setProgress(0);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [status, message]);

  // --- ACTIONS ---
  const addRow = () => {
      // Auto-increment default name: Entity 2, Entity 3, etc.
      const nextNum = rows.length + 1;
      setRows([...rows, { id: Date.now(), owner: `Entity ${nextNum}`, file: null }]);
  };

  const removeRow = (id: number) => {
      if (rows.length > 1) {
          setRows(rows.filter(r => r.id !== id));
      } else {
          // If clearing last row, just reset it
          setRows([{ id: Date.now(), owner: 'Entity 1', file: null }]);
      }
  };

  const updateRowOwner = (id: number, owner: string) => {
      setRows(rows.map(r => r.id === id ? { ...r, owner } : r));
  };

  const updateRowFile = (id: number, file: File | null) => {
      setRows(rows.map(r => r.id === id ? { ...r, file } : r));
  };

  // --- DRAG & DROP ---
  const handleDragEvents = (e: React.DragEvent, id: number | null) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.type === 'dragenter' || e.type === 'dragover') setIsDragging(id);
      else if (e.type === 'dragleave' || e.type === 'drop') setIsDragging(null);
  };

  const handleDrop = useCallback((e: React.DragEvent, id: number) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(null);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          updateRowFile(id, e.dataTransfer.files[0]);
      }
  }, [rows]);
  
  const handleProcess = async () => {
    // 1. Validation
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
    setMessage('Starting analysis...');
    setProgress(10);
    
    try {
        let allTransactions: Transaction[] = [];
        let processedCount = 0;

        for (const row of validRows) {
            if (!row.file) continue;
            setMessage(`Processing ${row.owner}'s file: ${row.file.name}...`);
            
            const result = await transformData(row.file, row.owner);
            allTransactions = [...allTransactions, ...result.transactions];
            
            processedCount++;
            setProgress(10 + (processedCount / validRows.length) * 80);
        }

        setProgress(100);

        if (allTransactions.length === 0) {
            setStatus('error');
            setMessage(`Analysis complete, but no valid transactions were found. Please check file format.`);
            return;
        }

        setMessage(`Success! Processed ${allTransactions.length} transactions.`);
        setStatus('success');
        
        await saveToStorage(allTransactions);

        setTimeout(() => onUploadSuccess(allTransactions), 1500);

    } catch (error: any) {
        console.error(error);
        setMessage(error.message || 'An error occurred during processing.');
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
            <p className="text-sm text-slate-500 mt-1">Combine expense details from different accounts or family members.</p>
        </div>
        
        <div className="space-y-4 mb-8">
            {rows.map((row) => (
                <div key={row.id} className="flex flex-col md:flex-row items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow group">
                    {/* Owner Input */}
                    <div className="w-full md:w-1/3">
                        <label htmlFor={`entity-${row.id}`} className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Entity</label>
                        <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                            <div className="pl-3 text-slate-400">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
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
                                accept=".csv,.xlsx,.xls"
                                ref={(el) => { if(el) fileInputRefs.current[row.id] = el }}
                                className="hidden"
                                onChange={(e) => updateRowFile(row.id, e.target.files ? e.target.files[0] : null)}
                            />
                            
                            {row.file ? (
                                <div className="flex items-center gap-2 text-sm text-slate-700 w-full">
                                    <div className="w-6 h-6 rounded bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
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
                        style={{ width: `${progress}%`, transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}
                        ></div>
                    </div>
                    <p className={`text-center text-sm mt-3 font-medium ${status === 'error' ? 'text-red-600' : 'text-slate-600'}`}>{message}</p>
                </div>
            )}
        </div>
    </div>
  );
};


const App = () => {
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [currentView, setCurrentView] = useState('home'); // 'home', 'pricing', 'contact', 'features', 'privacy', 'terms'
  const [loadingStorage, setLoadingStorage] = useState(true);
  const [toast, setToast] = useState<{message: string, visible: boolean}>({ message: '', visible: false });

  // Update Page Title based on View for SEO
  useEffect(() => {
      const titles: {[key: string]: string} = {
          'home': 'TrackSpendz - FIRE Calculator & Financial Analyst',
          'features': 'Features - TrackSpendz',
          'pricing': 'Pricing Plans - TrackSpendz',
          'contact': 'Contact Support - TrackSpendz',
          'privacy': 'Privacy Policy - TrackSpendz',
          'terms': 'Terms & Conditions - TrackSpendz'
      };
      if (!transactions) {
          document.title = titles[currentView] || 'TrackSpendz';
      } else {
          document.title = 'My Dashboard - TrackSpendz';
      }
  }, [currentView, transactions]);

  // Load data on start, checking for Force Reset flag first
  useEffect(() => {
    const init = async () => {
        // 1. Check for Forced Reset Flag
        if (localStorage.getItem('FORCE_RESET') === 'true') {
            console.log("Force reset detected. Wiping database...");
            try {
                await resetApplicationData();
                localStorage.removeItem('FORCE_RESET');
                console.log("Database wiped. Starting fresh.");
            } catch (e) {
                console.error("Force wipe failed:", e);
            }
        }

        // 2. Normal Load
        try {
            const data = await loadFromStorage();
            if (data && data.length > 0) {
                setTransactions(data);
            }
        } catch (e) {
            console.error("Failed to load storage", e);
        } finally {
            setLoadingStorage(false);
        }
    };
    init();
  }, []);

  // --- PRIVACY PROTECTION HOOKS ---
  useEffect(() => {
    // 1. Disable Right Click (Context Menu)
    const handleContextMenu = (e: MouseEvent) => {
        e.preventDefault();
        return false;
    };

    // 2. Disable Keyboard Shortcuts (Ctrl+P, Ctrl+S, PrintScreen logic attempt)
    const handleKeyDown = (e: KeyboardEvent) => {
        // Block Ctrl+P (Print) and Ctrl+S (Save)
        if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 's')) {
            e.preventDefault();
            e.stopPropagation();
            alert("To ensure privacy, printing and saving this page is disabled.");
            return false;
        }

        // Try to deter screenshot keys (limited effectiveness in browsers)
        if (e.key === 'PrintScreen') {
             // In some browsers, we can't block the key, but we can clear clipboard or warn
             try {
                navigator.clipboard.writeText(''); 
                alert("For your security, screenshots are disabled.");
             } catch(err) {}
        }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
        document.removeEventListener('contextmenu', handleContextMenu);
        document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleUploadSuccess = (data: Transaction[]) => {
    setTransactions(data);
  };

  const showToast = (msg: string) => {
      setToast({ message: msg, visible: true });
      setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  };

  const handleTransactionsUpdate = async (updated: Transaction[]) => {
      setTransactions(prev => {
          if (!prev) return updated;
          // Merge updates: create a map of existing items
          const map = new Map(prev.map(t => [t.id, t]));
          // Overwrite with updated items
          updated.forEach(t => map.set(t.id, t));
          return Array.from(map.values());
      });
      // Persist changes
      await saveToStorage(updated);
      showToast('Dashboard Updated Successfully');
  };

  const handleTransactionsDelete = async (ids: string[]) => {
      setTransactions(prev => {
          if (!prev) return [];
          return prev.filter(t => !ids.includes(t.id));
      });
      await deleteFromStorage(ids);
      showToast('Transactions Deleted');
  };

  const handleClearAll = () => {
      if (window.confirm("Are you sure you want to delete all financial data?")) {
          // 1. Immediate UI Wipe to give instant feedback
          setTransactions(null);
          
          // 2. Set Flag to wipe DB on next load
          localStorage.setItem('FORCE_RESET', 'true');
          
          // 3. Reload immediately
          window.location.reload();
      }
  };

  const handleBackup = () => {
      if (!transactions || transactions.length === 0) {
          alert("No data to backup.");
          return;
      }
      const dataStr = JSON.stringify(transactions, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `trackspendz_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Backup Downloaded');
  };

  const handleRestore = (file: File) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
          try {
              const json = JSON.parse(e.target?.result as string);
              if (Array.isArray(json) && json.length > 0 && json[0].id && json[0].amount) {
                  // Valid backup found
                  if (window.confirm(`Restore ${json.length} transactions? This will overwrite existing data.`)) {
                      setTransactions(json);
                      await saveToStorage(json);
                      showToast('Data Restored Successfully');
                  }
              } else {
                  alert("Invalid backup file.");
              }
          } catch (err) {
              alert("Error reading backup file.");
              console.error(err);
          }
      };
      reader.readAsText(file);
  };

  const scrollToUpload = () => {
      const element = document.getElementById('upload-section');
      if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
      }
  };

  // Safe loading state check (prevents white screen if storage is slow but data exists)
  if (loadingStorage && !transactions) {
    return <div className="h-screen flex items-center justify-center text-slate-400">Loading...</div>;
  }

  return (
      <div className="h-full overflow-y-auto bg-slate-50 selection:bg-blue-100 selection:text-blue-900 flex flex-col">
        <Navbar activeView={currentView} setView={setCurrentView} />
        
        {toast.visible && <Toast message={toast.message} onClose={() => setToast({ ...toast, visible: false })} />}

        {/* Background Gradients */}
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-200/40 rounded-full blur-3xl -translate-y-1/2 animate-pulse"></div>
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl translate-y-1/2 animate-pulse" style={{animationDelay: '1s'}}></div>
        </div>

        <main className="relative z-10 w-full flex-grow pt-24 pb-12 flex flex-col items-center">
            
            {/* If transactions exist, show Dashboard */}
            {transactions ? (
                <div className="w-full">
                     <Dashboard 
                        initialTransactions={transactions} 
                        onUpdate={handleTransactionsUpdate}
                        onDelete={handleTransactionsDelete}
                        onClear={handleClearAll}
                        onBackup={handleBackup}
                        onRestore={handleRestore}
                    />
                </div>
            ) : (
                <>
                    {currentView === 'home' && (
                        <>
                            {/* Hero Section */}
                            <header className="text-center mb-12 animate-fade-in flex flex-col items-center px-4">
                                <div className="mb-6"><Logo /></div>
                                <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 tracking-tight mb-6 max-w-4xl">
                                    The Ultimate <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">FIRE Calculator</span> & Financial Analyst
                                </h1>
                                <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed mb-6">
                                    Stop guessing when you can retire. Upload your expense details, and our AI will categorize your spending, calculate your inflation rate, and reveal your <strong>True Freedom Number</strong>.
                                </p>
                                <div className="flex flex-col items-center gap-4">
                                    <div className="flex flex-wrap justify-center gap-3">
                                        <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider border border-blue-100">100% Private</span>
                                        <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider border border-indigo-100">AI Powered</span>
                                        <span className="px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs font-bold uppercase tracking-wider border border-green-100">Free to Start</span>
                                    </div>
                                    <button onClick={scrollToUpload} className="mt-4 px-8 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-colors">
                                        Start Analyzing for Free
                                    </button>
                                </div>
                            </header>

                            {/* Upload Section */}
                            <FileUploaderSection onUploadSuccess={handleUploadSuccess} />

                            {/* Features Grid */}
                            <section className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl px-4">
                                <div onClick={() => setCurrentView('features')} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group cursor-pointer">
                                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform">
                                        <Icon name="flash" className="w-7 h-7" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-800 mb-3">FIRE Engine</h3>
                                    <p className="text-slate-500 leading-relaxed">
                                        We don't just sum totals. We calculate your <strong>Personal Inflation Rate</strong> and apply the 25x Rule to tell you exactly how much corpus you need to retire in 1, 5, or 10 years.
                                    </p>
                                </div>
                                <div onClick={() => setCurrentView('features')} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group cursor-pointer">
                                    <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform">
                                        <Icon name="shield" className="w-7 h-7" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-800 mb-3">100% Private</h3>
                                    <p className="text-slate-500 leading-relaxed">
                                        Your financial data never leaves your browser. All processing happens locally. We don't store your expense details or transaction history.
                                    </p>
                                </div>
                                <div onClick={() => setCurrentView('features')} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group cursor-pointer">
                                    <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform">
                                        <Icon name="ai" className="w-7 h-7" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-800 mb-3">AI Strategic CFO</h3>
                                    <p className="text-slate-500 leading-relaxed">
                                        Get actionable advice on how to optimize your savings. Our AI identifies recurring subscriptions and "latte factors" draining your wealth.
                                    </p>
                                </div>
                            </section>
                        </>
                    )}

                    {currentView === 'features' && <FeaturesPage setView={setCurrentView} />}
                    {currentView === 'pricing' && <PricingPage />}
                    {currentView === 'contact' && <ContactPage />}
                    {currentView === 'privacy' && <PrivacyPage />}
                    {currentView === 'terms' && <TermsPage />}
                </>
            )}
        </main>

        <Footer setView={setCurrentView} />
      </div>
  );
};

export default App;
