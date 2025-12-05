import React, { useState, useMemo, useCallback, createContext, useContext, useEffect, useRef, useLayoutEffect } from 'react';
import { Transaction, TransactionType, FilterState } from './types';
import { TABS, COLORS, Icon } from './constants';
import SummaryViews from './components/SummaryViews';
import DataTab from './components/DataTab';
import { FireCalculatorTab, AIChatTab } from './components/AIAssistantTab';
import { PDFReport } from './components/PDFReport';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { CURRENCIES, Currency, detectUserCurrency, formatAmount } from './services/currency';
import { FeedbackModal } from './components/FeedbackModal';
import { transformData, identifyInterAccountTransfers } from './services/transformer';

interface CurrencyContextType {
    currency: Currency;
    setCurrency: (currency: Currency) => void;
    formatCurrency: (value: number) => string;
}

const CurrencyContext = createContext<CurrencyContextType | null>(null);
export const useCurrency = () => {
    const context = useContext(CurrencyContext);
    if (!context) throw new Error("useCurrency must be used within a CurrencyProvider");
    return context;
};

// --- Components ---

const ProcessingBanner = ({ isProcessing, progress }: { isProcessing: boolean, progress: number }) => {
    const [showDone, setShowDone] = useState(false);
    
    useEffect(() => {
        if (!isProcessing && progress === 100) {
            setShowDone(true);
            const timer = setTimeout(() => setShowDone(false), 3000);
            return () => clearTimeout(timer);
        }
        if (isProcessing) setShowDone(false);
    }, [isProcessing, progress]);

    if (!isProcessing && !showDone) return null;

    return (
        <div className="sticky top-0 z-[60] bg-white/95 backdrop-blur-md border-b border-indigo-100 shadow-sm animate-fade-in">
            <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                    {showDone ? (
                        <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white animate-pulse">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" /></svg>
                        </div>
                    ) : (
                        <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                    )}
                    <div>
                        <p className={`text-sm font-bold ${showDone ? 'text-green-600' : 'text-indigo-900'}`}>
                            {showDone ? "Analysis Complete" : "Processing Files..."}
                        </p>
                        {!showDone && <p className="text-xs text-indigo-500">Live updating dashboard</p>}
                    </div>
                </div>
                {!showDone && (
                    <div className="w-48 sm:w-64">
                        <div className="flex justify-between text-[10px] font-bold text-indigo-400 mb-1 uppercase tracking-wide">
                            <span>Progress</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-indigo-50 rounded-full h-1.5 overflow-hidden">
                            <div 
                                className="h-full bg-indigo-500 rounded-full transition-all duration-300 ease-out" 
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const Header = ({ data, onExportSnapshot, isExporting }: { data: Transaction[], onExportSnapshot: () => void, isExporting: boolean }) => {
    const { formatCurrency } = useCurrency();
    const ytdData = useMemo(() => {
        const currentYear = new Date().getFullYear();
        return data.filter(t => new Date(t.date + 'T00:00:00').getFullYear() === currentYear);
    }, [data]);

    const { totalIncome, totalExpenses, netSavings } = useMemo(() => {
        let totalIncome = 0;
        let totalExpenses = 0;
        ytdData.forEach(t => {
            if (t.type === 'Income') totalIncome += t.amount;
            else if (t.type === 'Expense') totalExpenses += t.amount;
        });
        return { totalIncome, totalExpenses, netSavings: totalIncome - totalExpenses };
    }, [ytdData]);

    const MetricCard = ({ title, value, accentColor, change }: { title: string, value: string, accentColor: string, change: { value: string, color: string } }) => (
        <div className={`bg-white rounded-2xl p-6 shadow-md hover:shadow-lg border border-slate-200 border-l-4 transition-shadow`} style={{ borderLeftColor: accentColor }}>
            <p className="text-xs uppercase font-bold text-slate-500 tracking-wider mb-1">{title}</p>
            <div className="flex justify-between items-baseline mt-2">
                <p className="text-3xl font-bold text-slate-800 whitespace-nowrap" title={value}>{value}</p>
                <p className={`text-sm font-semibold ${change.color}`}>{change.value}</p>
            </div>
        </div>
    );

    return (
        <div className="mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h2 className="text-2xl font-bold text-slate-800">Financial Dashboard</h2>
                <button 
                    onClick={onExportSnapshot}
                    disabled={isExporting}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl shadow-lg shadow-slate-300 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:cursor-wait"
                >
                    {isExporting ? (
                         <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                         <Icon name="snapshot" className="w-5 h-5 text-yellow-400" />
                    )}
                    <span className="font-bold text-sm">Export Snapshot</span>
                </button>
            </div>
            <header className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricCard title="Total Income YTD" value={formatCurrency(totalIncome)} accentColor={COLORS.income.medium} change={{ value: 'Income', color: 'text-green-600'}} />
                <MetricCard title="Total Expenses YTD" value={formatCurrency(totalExpenses)} accentColor={COLORS.expense.medium} change={{ value: 'Expense', color: 'text-red-600'}}/>
                <MetricCard title="Net Savings YTD" value={formatCurrency(netSavings)} accentColor={netSavings >= 0 ? COLORS.income.dark : COLORS.expense.dark} change={{ value: 'Savings', color: 'text-blue-600'}}/>
            </header>
        </div>
    );
};

const MultiSelect = ({ label, options, selected, onChange }: { label: string, options: string[], selected: string[], onChange: (selected: string[]) => void }) => {
    const toggleOption = (option: string) => {
        if (selected.includes(option)) {
            onChange(selected.filter(item => item !== option));
        } else {
            onChange([...selected, option]);
        }
    };

    return (
        <div>
            <h4 className="text-sm font-semibold text-slate-600 mb-2">{label}</h4>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto custom-scrollbar">
                {options.map(option => (
                    <button
                        key={option}
                        onClick={() => toggleOption(option)}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-all duration-200 border ${selected.includes(option) ? 'bg-blue-500 border-blue-600 text-white' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                    >
                        {option}
                    </button>
                ))}
            </div>
        </div>
    );
};

const Sidebar = ({ transactions, filters, setFilters, isOpen, setIsOpen, onClear, onBackup, onRestore, onUpdate }: { 
    transactions: Transaction[], 
    filters: FilterState, 
    setFilters: React.Dispatch<React.SetStateAction<FilterState>>, 
    isOpen: boolean, 
    setIsOpen: (isOpen: boolean) => void, 
    onClear?: () => void,
    onBackup?: () => void,
    onRestore?: (file: File) => void,
    onUpdate?: (updated: Transaction[]) => void
}) => {
    const { currency, setCurrency } = useCurrency();
    const restoreInputRef = useRef<HTMLInputElement>(null);
    const uploadInputRef = useRef<HTMLInputElement>(null);
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    
    const uniqueValues = useMemo(() => {
        const projects = [...new Set(transactions.map(t => t.project).filter((p): p is string => !!p && typeof p === 'string' && p.trim() !== ''))].sort();
        const hasProjects = projects.length > 0;

        return {
            owners: [...new Set(transactions.map(t => t.owner))],
            types: ['Income', 'Expense', 'Transfer'] as TransactionType[],
            categories: [...new Set(transactions.map(t => t.category))].sort(),
            hasProjects,
            projects
        }
    }, [transactions]);
    
    const resetFilters = () => {
        setFilters({
            owners: uniqueValues.owners,
            types: ['Income', 'Expense', 'Transfer'],
            excludedCategories: [],
            excludedProjects: [],
        })
    };

    const generateEntityName = (fileName: string): string => {
        const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
        let cleanName = nameWithoutExt.substring(0, 15).replace(/[-_]/g, ' ');
        return cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        
        const files: File[] = Array.from(e.target.files);
        setIsUploading(true);
        setUploadProgress(0);

        // Check for PDF passwords quickly
        const safeFiles = [];
        for (const file of files) {
            if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                try {
                    const text = await file.text();
                    if (text.includes('/Encrypt') && !text.includes('/Encrypt null')) {
                        alert(`🔒 "${file.name}" is password protected. Skipped.`);
                        continue; 
                    }
                } catch (err) { console.warn(err); }
            }
            safeFiles.push(file);
        }

        if (safeFiles.length === 0) {
            setIsUploading(false);
            e.target.value = '';
            return;
        }

        // Progress Loop
        const interval = setInterval(() => {
            setUploadProgress(prev => {
                if (prev >= 95) return prev;
                return prev + 1;
            });
        }, 300);

        try {
            let newTransactions: Transaction[] = [];
            
            // Process sequentially to avoid browser choke
            for (const file of safeFiles) {
                // Auto-generate name based on file
                const ownerName = generateEntityName(file.name);
                const result = await transformData(file, ownerName);
                if (result.transactions.length > 0) {
                    newTransactions = [...newTransactions, ...result.transactions];
                }
            }
            
            clearInterval(interval);
            setUploadProgress(100);
            await new Promise(resolve => setTimeout(resolve, 600));

            if (newTransactions.length > 0) {
                if (onUpdate) {
                    const combined = [...transactions, ...newTransactions];
                    const { transactions: processed } = identifyInterAccountTransfers(combined);
                    onUpdate(processed);
                }
            } else {
                alert("No transactions extracted. Please check file format.");
            }
        } catch (err: any) {
            clearInterval(interval);
            console.error(err);
            alert("Import failed: " + (err.message || "Unknown error"));
        } finally {
            setTimeout(() => {
                setIsUploading(false);
                setUploadProgress(0);
            }, 1000);
            e.target.value = '';
        }
    };

    return (
        <>
            <div className={`fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsOpen(false)}></div>
            <aside className={`fixed top-0 left-0 w-64 h-full bg-white shadow-xl z-40 transform transition-transform duration-300 ease-in-out lg:relative lg:w-72 lg:h-auto lg:shadow-none lg:transform-none lg:shrink-0 flex flex-col border-r border-slate-200 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="p-6 flex-grow overflow-y-auto space-y-6 custom-scrollbar">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-slate-800">Filters & Settings</h3>
                        <button onClick={() => setIsOpen(false)} className="lg:hidden text-slate-500 hover:text-slate-800">
                           <Icon name="close" className="w-6 h-6"/>
                        </button>
                    </div>

                    {/* Currency Selector */}
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                        <label htmlFor="currency-select" className="block text-sm font-bold text-blue-800 mb-2">Currency</label>
                        <select
                            id="currency-select"
                            value={currency}
                            onChange={e => setCurrency(e.target.value as Currency)}
                            className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 text-slate-800 font-medium outline-none"
                        >
                            {Object.keys(CURRENCIES).map(c => <option key={c} value={c}>{c} ({CURRENCIES[c as Currency].symbol})</option>)}
                        </select>
                    </div>
                    
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                        <h4 className="text-sm font-semibold text-slate-600 mb-3">Include</h4>
                        <div className="space-y-4">
                            <MultiSelect label="Entities" options={uniqueValues.owners} selected={filters.owners} onChange={owners => setFilters(f => ({ ...f, owners }))} />
                            <MultiSelect label="Types" options={uniqueValues.types} selected={filters.types} onChange={types => setFilters(f => ({ ...f, types: types as TransactionType[] }))} />
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                        <h4 className="text-sm font-semibold text-slate-600 mb-3">Exclude</h4>
                         <div className="space-y-4">
                            <MultiSelect label="Categories" options={uniqueValues.categories} selected={filters.excludedCategories} onChange={cats => setFilters(f => ({ ...f, excludedCategories: cats }))} />
                            
                            {/* Show Projects filter if ANY project data exists */}
                            {uniqueValues.hasProjects && (
                                <MultiSelect 
                                    label="Projects" 
                                    options={uniqueValues.projects} 
                                    selected={filters.excludedProjects} 
                                    onChange={projs => setFilters(f => ({...f, excludedProjects: projs}))} 
                                />
                            )}
                        </div>
                    </div>
                </div>
                
                <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
                    <button onClick={resetFilters} className="w-full text-center text-sm py-2.5 px-4 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition shadow-sm font-medium">
                        Reset Filters
                    </button>
                    <div className="flex gap-2">
                        {onBackup && (
                            <button onClick={onBackup} className="flex-1 text-center text-sm py-2.5 px-4 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition shadow-sm font-medium flex items-center justify-center gap-1" title="Backup Data">
                                <span>Backup</span>
                            </button>
                        )}
                        {onRestore && (
                            <button onClick={() => restoreInputRef.current?.click()} className="flex-1 text-center text-sm py-2.5 px-4 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition shadow-sm font-medium flex items-center justify-center gap-1" title="Restore Data">
                                <span>Restore</span>
                                <input 
                                    type="file" 
                                    ref={restoreInputRef} 
                                    className="hidden" 
                                    accept=".json" 
                                    onChange={(e) => { 
                                        if(e.target.files?.[0]) onRestore(e.target.files[0]);
                                        e.target.value = ''; 
                                    }} 
                                />
                            </button>
                        )}
                    </div>

                    {/* ADD FILE BUTTON */}
                    {onUpdate && (
                        <div>
                            <button 
                                onClick={() => uploadInputRef.current?.click()} 
                                disabled={isUploading}
                                className="w-full text-center text-sm py-2.5 px-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm font-medium flex items-center justify-center gap-2"
                            >
                                {isUploading ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <Icon name="upload" className="w-4 h-4 text-white" />
                                )}
                                <span>{isUploading ? 'Analyzing...' : 'Add More Files'}</span>
                            </button>
                            <input 
                                type="file" 
                                ref={uploadInputRef} 
                                className="hidden" 
                                accept=".csv,.xlsx,.xls,.pdf" 
                                multiple
                                onChange={handleFileUpload} 
                            />
                            
                            {/* Progress Loader UI */}
                            {isUploading && (
                                <div className="mt-3 animate-fade-in bg-white p-2 rounded-lg border border-slate-200">
                                    <div className="flex justify-between text-[10px] text-slate-500 mb-1 font-semibold uppercase tracking-wider">
                                        <span>Processing</span>
                                        <span>{uploadProgress.toFixed(0)}%</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                        <div 
                                            className="h-full bg-blue-600 rounded-full transition-all duration-300" 
                                            style={{ width: `${uploadProgress}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {onClear && (
                        <button type="button" onClick={onClear} className="w-full text-center text-sm py-2.5 px-4 rounded-lg bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition shadow-sm font-medium flex items-center justify-center gap-2">
                            <Icon name="trash" className="w-4 h-4" />
                            Clear All Data
                        </button>
                    )}
                    
                    <button onClick={() => setIsFeedbackOpen(true)} className="w-full text-center text-sm py-2.5 px-4 rounded-lg border border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50 transition font-medium flex items-center justify-center gap-2">
                        <span className="text-lg">💡</span> Give Feedback
                    </button>

                    <button onClick={() => setIsOpen(false)} className="w-full text-center text-xs py-2 text-slate-400 hover:text-slate-600 transition">
                        ← Back to Dashboard
                    </button>
                </div>
                <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
            </aside>
        </>
    );
};

interface DashboardProps {
    initialTransactions: Transaction[];
    onUpdate?: (updated: Transaction[]) => void;
    onDelete?: (ids: string[]) => void;
    onClear?: () => void;
    onBackup?: () => void;
    onRestore?: (file: File) => void;
    isProcessing?: boolean;
    processingProgress?: number;
}

const Dashboard = ({ initialTransactions, onUpdate, onDelete, onClear, onBackup, onRestore, isProcessing = false, processingProgress = 0 }: DashboardProps) => {
    const [activeTab, setActiveTab] = useState(TABS[0]);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    
    // Initialize currency based on location detection
    const [currency, setCurrency] = useState<Currency>(() => detectUserCurrency());

    const [filters, setFilters] = useState<FilterState>(() => {
        const owners = [...new Set(initialTransactions.map(t => t.owner))];
        return {
            owners,
            types: ['Income', 'Expense', 'Transfer'], 
            excludedCategories: [],
            excludedProjects: [],
        };
    });

    // Track known owners to detect new files arriving in the stream
    const knownOwnersRef = useRef<Set<string>>(new Set(initialTransactions.map(t => t.owner)));

    // Effect: Auto-select newly processed files in the dashboard
    useEffect(() => {
        const currentOwners = new Set(initialTransactions.map(t => t.owner));
        const newOwners: string[] = [];

        currentOwners.forEach(owner => {
            if (!knownOwnersRef.current.has(owner)) {
                newOwners.push(owner);
                knownOwnersRef.current.add(owner);
            }
        });

        if (newOwners.length > 0) {
            setFilters(prev => ({
                ...prev,
                owners: [...prev.owners, ...newOwners]
            }));
        }
    }, [initialTransactions]);

    const filteredData = useMemo(() => {
        if (!initialTransactions || initialTransactions.length === 0) {
            return [];
        }
        return initialTransactions.filter(t => 
            filters.owners.includes(t.owner) &&
            filters.types.includes(t.type) &&
            !filters.excludedCategories.includes(t.category) &&
            !filters.excludedProjects.includes(t.project || '')
        );
    }, [initialTransactions, filters]);

    const formatCurrencyFn = useCallback((value: number) => {
        return formatAmount(value, currency);
    }, [currency]);
    
    const renderContent = () => {
        switch (activeTab) {
            case 'Data (Edit)': return <DataTab data={filteredData} onUpdate={onUpdate} onDelete={onDelete} />;
            case 'FIRE Calculator': return <FireCalculatorTab data={filteredData} />;
            case 'AI Chat': return <AIChatTab data={filteredData} />;
            // Default assumes it's a Summary view (Summary, Yearly, Monthly, etc.)
            default: return <SummaryViews activeTab={activeTab} data={filteredData} />;
        }
    };

    const handleExportSnapshot = async () => {
        setIsExporting(true);
        try {
            // Allow DOM to update with the report container
            await new Promise(resolve => setTimeout(resolve, 1500));

            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();

            const pages = [document.getElementById('pdf-page-1'), document.getElementById('pdf-page-2'), document.getElementById('pdf-page-3')];

            for (let i = 0; i < pages.length; i++) {
                const element = pages[i];
                if (!element) continue;

                const canvas = await html2canvas(element, { 
                    scale: 2, // High resolution
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff'
                });

                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                const imgWidth = pageWidth;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;

                if (i > 0) pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
            }

            pdf.save(`TrackSpendz_Snapshot_${new Date().toISOString().slice(0, 10)}.pdf`);
        } catch (err) {
            console.error("PDF Export failed:", err);
            alert("Failed to generate PDF. Please try again.");
        } finally {
            setIsExporting(false);
        }
    };

    const currencyContextValue = { currency, setCurrency, formatCurrency: formatCurrencyFn };
    
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Scroll to top whenever tab changes or dashboard mounts
    useLayoutEffect(() => {
        // 1. Reset Internal Dashboard Scroll
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
        }
        
        // 2. Reset Outer App Shell Scroll (Fixes "Load at bottom" issue)
        // The App wrapper has 'h-full overflow-y-auto'
        const appShell = document.querySelector('.h-full.overflow-y-auto');
        if (appShell) {
            appShell.scrollTop = 0;
        }
    }, [activeTab]);

    return (
        <CurrencyContext.Provider value={currencyContextValue}>
            <div className="flex h-screen bg-slate-50 overflow-hidden relative">
                {/* Hidden Export Container */}
                {isExporting && (
                    <div style={{ position: 'fixed', top: 0, left: 10000, zIndex: -1000 }}>
                        <PDFReport data={filteredData} currency={currency} formatCurrency={formatCurrencyFn} />
                    </div>
                )}
                
                {/* Exporting Overlay */}
                {isExporting && (
                    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center flex-col text-white animate-fade-in">
                        <div className="w-16 h-16 border-4 border-white/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                        <h3 className="text-xl font-bold">Generating PDF Snapshot...</h3>
                        <p className="text-slate-300">Compiling charts and metrics.</p>
                    </div>
                )}

                <Sidebar 
                    transactions={initialTransactions} 
                    filters={filters} 
                    setFilters={setFilters} 
                    isOpen={sidebarOpen} 
                    setIsOpen={setSidebarOpen} 
                    onClear={onClear}
                    onBackup={onBackup}
                    onRestore={onRestore}
                    onUpdate={onUpdate}
                />
                
                <main className="flex-1 flex flex-col h-screen overflow-hidden relative w-full">
                     <div className="lg:hidden p-4 bg-white border-b border-slate-200 flex items-center">
                        <button onClick={() => setSidebarOpen(true)} className="p-2 bg-slate-100 rounded-md">
                            <Icon name="menu" className="w-6 h-6 text-slate-700"/>
                        </button>
                        <span className="ml-4 font-bold text-slate-800">TrackSpendz</span>
                     </div>
                    
                    {/* Processing Banner Logic */}
                    <ProcessingBanner isProcessing={isProcessing} progress={processingProgress} />

                    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                        <div className="w-full max-w-7xl mx-auto">
                            <Header data={filteredData} onExportSnapshot={handleExportSnapshot} isExporting={isExporting} />
                            
                            <nav className="mb-6 flex space-x-2 lg:space-x-4 border-b border-slate-200 overflow-x-auto pb-px shrink-0 custom-scrollbar">
                                {TABS.map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`flex items-center space-x-2 whitespace-nowrap px-3 py-2 text-sm font-medium rounded-t-lg transition-colors duration-200 ${
                                            activeTab === tab ? 'border-b-2 border-blue-500 text-blue-600 bg-white' : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                                        }`}
                                    >
                                        <Icon name={tab.split(' ')[0].toLowerCase()} className="w-4 h-4"/>
                                        <span>{tab}</span>
                                    </button>
                                ))}
                            </nav>

                            <div className="fade-in min-h-[500px] pb-20">
                                {renderContent()}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </CurrencyContext.Provider>
    );
};

export default Dashboard;