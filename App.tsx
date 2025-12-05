import React, { useState, useEffect, useRef } from 'react';
import { Transaction, FileJob } from './types';
import Dashboard from './Dashboard';
import { Icon } from './constants';
import { loadFromStorage, saveToStorage, deleteFromStorage, resetApplicationData } from './services/storageService';
import { PricingPage, ContactPage, FeaturesPage, PrivacyPage, TermsPage } from './components/PublicPages';
import { Navbar, Footer, Logo } from './components/Layout';
import { FileUploaderSection } from './components/FileUploader';
import { ErrorBoundary } from './components/ErrorBoundary';
import { transformData, identifyInterAccountTransfers } from './services/transformer';

// --- COMPONENTS ---

const Toast = ({ message, onClose }: { message: string, onClose: () => void }) => (
    <div className="fixed bottom-6 right-6 z-[100] animate-fade-in">
        <div className="bg-slate-900 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700">
            <div className="bg-green-500 rounded-full p-1">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" width="12" height="12" className="w-3 h-3 text-slate-900 icon-safe">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
            </div>
            <span className="font-medium text-sm">{message}</span>
            <button onClick={onClose} className="ml-2 text-slate-400 hover:text-white" aria-label="Close Notification">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="16" height="16" className="w-4 h-4 icon-safe"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>
    </div>
);

const LandingPage = ({ 
    setView, 
    onStartAnalysis,
    isProcessing,
    progress
}: { 
    setView: (v: string) => void, 
    onStartAnalysis: (jobs: FileJob[]) => void,
    isProcessing: boolean,
    progress: number
}) => {
    const scrollToUpload = () => {
      const element = document.getElementById('upload-section');
      if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
      }
    };

    return (
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

            {/* Upload Section wrapped in ErrorBoundary */}
            <ErrorBoundary>
                <FileUploaderSection onStartAnalysis={onStartAnalysis} isProcessing={isProcessing} progress={progress} />
            </ErrorBoundary>

            {/* Features Grid */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl px-4">
                <div onClick={() => setView('features')} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group cursor-pointer">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform">
                        <Icon name="flash" className="w-7 h-7" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-3">FIRE Engine</h3>
                    <p className="text-slate-500 leading-relaxed">
                        We don't just sum totals. We calculate your <strong>Personal Inflation Rate</strong> and apply the 25x Rule to tell you exactly how much corpus you need to retire in 1, 5, or 10 years.
                    </p>
                </div>
                <div onClick={() => setView('features')} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group cursor-pointer">
                    <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform">
                        <Icon name="shield" className="w-7 h-7" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-3">100% Private</h3>
                    <p className="text-slate-500 leading-relaxed">
                        Your financial data never leaves your browser. All processing happens locally. (Note: PDF uploads are securely processed via Gemini AI for extraction only; we never store your data).
                    </p>
                </div>
                <div onClick={() => setView('features')} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group cursor-pointer">
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
    );
}

const App = () => {
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [currentView, setCurrentView] = useState('home');
  const [toast, setToast] = useState<{message: string, visible: boolean}>({ message: '', visible: false });

  // Processing State for background loading
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);

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

  // Load data on start
  useEffect(() => {
    const init = async () => {
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
        try {
            const data = await loadFromStorage();
            if (data && data.length > 0) {
                setTransactions(data);
            }
        } catch (e) {
            console.error("Failed to load storage", e);
        }
    };
    init();
  }, []);

  // --- PRIVACY PROTECTION HOOKS ---
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
        e.preventDefault();
        return false;
    };
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 's')) {
            e.preventDefault();
            e.stopPropagation();
            alert("To ensure privacy, printing and saving this page is disabled.");
            return false;
        }
    };
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
        document.removeEventListener('contextmenu', handleContextMenu);
        document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // --- CORE PROCESSING LOGIC (LIFTED FROM UPLOADER) ---
  const processFilesBatch = async (jobs: FileJob[]) => {
    setIsProcessing(true);
    setProcessingProgress(5); // Immediate start feedback
    
    // Start artificial ticker to move progress bar slowly
    const interval = setInterval(() => {
        setProcessingProgress(prev => {
            if (prev >= 95) return prev; // Cap at 95% until actually done
            return prev + 2; // Increment by 2%
        });
    }, 1000); // Every second

    let processedTransactions: Transaction[] = transactions || [];
    let completedJobs = 0;
    const totalJobs = jobs.length;

    try {
        for (const job of jobs) {
            try {
                // Process one file
                const result = await transformData(job.file, job.owner);
                
                if (result.transactions.length > 0) {
                    // Append new transactions to existing set
                    processedTransactions = [...processedTransactions, ...result.transactions];
                    
                    // Run logic to link transfers (important to do this incrementally so data is correct)
                    const { transactions: cleaned } = identifyInterAccountTransfers(processedTransactions);
                    processedTransactions = cleaned;

                    // Update UI State immediately
                    setTransactions(processedTransactions);
                    
                    // Save incrementally to storage to be safe
                    saveToStorage(processedTransactions).catch(console.error);
                }
            } catch (err) {
                console.error(`Error processing file ${job.file.name}:`, err);
                showToast(`Failed to process ${job.file.name}`);
            }

            // Update Progress
            completedJobs++;
            const realPercentage = Math.round((completedJobs / totalJobs) * 100);
            
            // If real progress jumps ahead of fake progress, sync up. 
            // If fake progress is ahead (because file took long), keep fake progress.
            setProcessingProgress(prev => Math.max(prev, realPercentage));
        }
    } catch (e) {
        console.error("Batch processing error", e);
        showToast("An unexpected error occurred during processing.");
    } finally {
        clearInterval(interval);
        // Ensure we hit 100% and finish properly
        setProcessingProgress(100);
        setTimeout(() => {
            setIsProcessing(false);
        }, 800); // Small delay to let user see 100%
    }
  };

  const showToast = (msg: string) => {
      setToast({ message: msg, visible: true });
      setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  };

  const handleTransactionsUpdate = async (updated: Transaction[]) => {
      setTransactions(prev => {
          if (!prev) return updated;
          const map = new Map(prev.map(t => [t.id, t]));
          updated.forEach(t => map.set(t.id, t));
          return Array.from(map.values());
      });
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
          setTransactions(null);
          localStorage.setItem('FORCE_RESET', 'true');
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

  return (
      <div className="h-full overflow-y-auto bg-slate-50 selection:bg-blue-100 selection:text-blue-900 flex flex-col">
        {/* Navbar wrapped in ErrorBoundary to ensure navigation survives crashes */}
        <ErrorBoundary>
            <Navbar activeView={currentView} setView={setCurrentView} />
        </ErrorBoundary>
        
        {toast.visible && <Toast message={toast.message} onClose={() => setToast({ ...toast, visible: false })} />}

        {/* Background Gradients */}
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-200/40 rounded-full blur-3xl -translate-y-1/2 animate-pulse"></div>
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl translate-y-1/2 animate-pulse" style={{animationDelay: '1s'}}></div>
        </div>

        <main className="relative z-10 w-full flex-grow pt-24 pb-12 flex flex-col items-center">
            
            <ErrorBoundary>
                {transactions ? (
                    <div className="w-full">
                         <Dashboard 
                            initialTransactions={transactions} 
                            onUpdate={handleTransactionsUpdate}
                            onDelete={handleTransactionsDelete}
                            onClear={handleClearAll}
                            onBackup={handleBackup}
                            onRestore={handleRestore}
                            isProcessing={isProcessing}
                            processingProgress={processingProgress}
                        />
                    </div>
                ) : (
                    <>
                        {currentView === 'home' && <LandingPage setView={setCurrentView} onStartAnalysis={processFilesBatch} isProcessing={isProcessing} progress={processingProgress} />}
                        {currentView === 'features' && <FeaturesPage setView={setCurrentView} />}
                        {currentView === 'pricing' && <PricingPage />}
                        {currentView === 'contact' && <ContactPage />}
                        {currentView === 'privacy' && <PrivacyPage />}
                        {currentView === 'terms' && <TermsPage />}
                    </>
                )}
            </ErrorBoundary>
        </main>

        <ErrorBoundary>
            <Footer setView={setCurrentView} />
        </ErrorBoundary>
      </div>
  );
};

export default App;