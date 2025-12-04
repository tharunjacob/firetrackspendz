import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, TransactionType } from '../types';
import { useCurrency } from '../Dashboard';
import { suggestCategories } from '../services/geminiService';
import { saveCategoryRule } from '../services/learningService';

const MultiSelect = ({ label, options, selected, onChange }: { label: string, options: string[], selected: string[], onChange: (selected: string[]) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    return (
        <div className="relative">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full text-left bg-white border border-slate-300 rounded-lg px-4 py-2 text-sm flex justify-between items-center shadow-sm hover:border-blue-400 transition-colors">
                <span className="truncate block pr-4">{selected.length > 0 ? `${label} (${selected.length})` : label}</span>
                <span className="text-xs text-slate-500">▼</span>
            </button>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>
                    <div className="absolute z-20 top-full mt-1 w-full max-h-60 overflow-y-auto bg-white border border-slate-300 rounded-lg shadow-xl p-1">
                        {options.length === 0 && <div className="p-2 text-xs text-slate-400 text-center">No options</div>}
                        {options.map(option => (
                            <label key={option} className="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer rounded transition-colors">
                                <input 
                                    type="checkbox"
                                    checked={selected.includes(option)}
                                    onChange={() => {
                                        if (selected.includes(option)) {
                                            onChange(selected.filter(item => item !== option));
                                        } else {
                                            onChange([...selected, option]);
                                        }
                                    }}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-slate-700 truncate">{option}</span>
                            </label>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
};

interface DataTabProps {
    data: Transaction[];
    onUpdate?: (updated: Transaction[]) => void;
    onDelete?: (ids: string[]) => void;
}

const DataTab = ({ data, onUpdate, onDelete }: DataTabProps) => {
    const { formatCurrency } = useCurrency();
    const [sortConfig, setSortConfig] = useState<{ key: keyof Transaction; direction: 'ascending' | 'descending' } | null>({ key: 'date', direction: 'descending' });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    // --- SELECTION & EDITING STATE ---
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Transaction>>({});
    const [saveRule, setSaveRule] = useState(false);
    
    // --- BULK ACTION STATE ---
    const [bulkAction, setBulkAction] = useState<'category' | 'type' | 'project' | 'delete' | null>(null);
    const [bulkValue, setBulkValue] = useState('');

    // --- SMART FILL STATE ---
    const [isSmartFilling, setIsSmartFilling] = useState(false);

    // Extract unique values for filters
    const uniqueCategories = useMemo(() => [...new Set(data.map(t => t.category))].sort(), [data]);
    const uniqueSubCategories = useMemo(() => [...new Set(data.map(t => t.subCategory))].sort(), [data]);
    const uniqueProjects = useMemo(() => [...new Set(data.map(t => t.project || 'None'))].sort(), [data]);
    
    const unclassifiedCount = useMemo(() => data.filter(t => t.category === 'Unclassified').length, [data]);

    // Calculate Min/Max Amount for Slider
    const { globalMin, globalMax } = useMemo(() => {
        if (data.length === 0) return { globalMin: 0, globalMax: 1000 };
        const amounts = data.map(t => t.amount);
        return { globalMin: Math.min(...amounts), globalMax: Math.max(...amounts) };
    }, [data]);

    // Filters State
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedSubCategories, setSelectedSubCategories] = useState<string[]>([]);
    const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
    const [selectedType, setSelectedType] = useState<'all' | TransactionType>('all');
    
    const [amountRange, setAmountRange] = useState({ min: '', max: '' });
    const sliderMax = amountRange.max === '' ? globalMax : Number(amountRange.max);

    const filteredAndSortedData = useMemo(() => {
        let filteredData = data.filter(item => {
            const searchMatch = Object.values(item).some(val =>
                String(val).toLowerCase().includes(searchTerm.toLowerCase())
            );
            const startDate = dateRange.start ? new Date(dateRange.start + 'T00:00:00') : null;
            const endDate = dateRange.end ? new Date(dateRange.end + 'T00:00:00') : null;
            const itemDate = new Date(item.date + 'T00:00:00');
            
            const dateMatch = (!startDate || itemDate >= startDate) && (!endDate || itemDate <= endDate);
            const categoryMatch = selectedCategories.length === 0 || selectedCategories.includes(item.category);
            const subCategoryMatch = selectedSubCategories.length === 0 || selectedSubCategories.includes(item.subCategory);
            const projectMatch = selectedProjects.length === 0 || selectedProjects.includes(item.project || 'None');
            const typeMatch = selectedType === 'all' || item.type === selectedType;
            
            const minVal = amountRange.min !== '' ? parseFloat(amountRange.min) : -Infinity;
            const maxVal = amountRange.max !== '' ? parseFloat(amountRange.max) : Infinity;
            const amountMatch = item.amount >= minVal && item.amount <= maxVal;

            return searchMatch && dateMatch && categoryMatch && subCategoryMatch && projectMatch && typeMatch && amountMatch;
        });

        if (sortConfig !== null) {
            filteredData.sort((a, b) => {
                const valA = a[sortConfig.key] ?? '';
                const valB = b[sortConfig.key] ?? '';
                
                if (valA < valB) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (valA > valB) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        
        return filteredData;
    }, [data, searchTerm, sortConfig, dateRange, selectedCategories, selectedSubCategories, selectedProjects, selectedType, amountRange]);

    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredAndSortedData.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredAndSortedData, currentPage]);
    
    const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);

    const requestSort = (key: keyof Transaction) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    // --- ACTION HANDLERS ---

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === paginatedData.length && paginatedData.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(paginatedData.map(t => t.id)));
        }
    };

    const startEditing = (t: Transaction) => {
        setEditingId(t.id);
        setEditForm({ ...t });
        setSaveRule(false);
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditForm({});
        setSaveRule(false);
    };

    const saveEditing = () => {
        if (!editingId || !onUpdate) return;
        
        // Find original to merge properly
        const original = data.find(t => t.id === editingId);
        if (!original) return;

        const updatedTx: Transaction = {
            ...original,
            ...editForm,
            amount: Number(editForm.amount) || 0, // Ensure valid number
        };

        // SAVE RULE LOGIC
        if (saveRule && editForm.category && editForm.notes) {
            // We save the rule mapping the DESCRIPTION (Notes) to the CATEGORY
            // We use the first 2 words of description as the key to be general enough but specific
            // Or better, just use the notes as provided by user in edit form if they shortened it
            saveCategoryRule(editForm.notes, editForm.category);
            alert(`Rule Saved! Future uploads containing "${editForm.notes}" will be categorized as "${editForm.category}".`);
        }

        onUpdate([updatedTx]);
        setEditingId(null);
        setEditForm({});
        setSaveRule(false);
    };

    // Key Listener for Quick Save (Enter) or Cancel (Escape)
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveEditing();
        } else if (e.key === 'Escape') {
            cancelEditing();
        }
    };

    const handleBulkApply = (overrideAction?: string) => {
        const action = overrideAction || bulkAction;

        if (!onUpdate || !onDelete || !action) return;

        if (action === 'delete') {
            if (window.confirm(`Delete ${selectedIds.size} selected transactions?`)) {
                onDelete(Array.from(selectedIds));
                setSelectedIds(new Set());
                setBulkAction(null);
            }
            return;
        }

        if (!bulkValue.trim()) return;

        const transactionsToUpdate = data.filter(t => selectedIds.has(t.id)).map(t => {
            const updates: Partial<Transaction> = {};
            if (action === 'category') updates.category = bulkValue;
            if (action === 'project') updates.project = bulkValue;
            if (action === 'type') updates.type = bulkValue as TransactionType;
            return { ...t, ...updates };
        });

        onUpdate(transactionsToUpdate);
        setSelectedIds(new Set());
        setBulkAction(null);
        setBulkValue('');
    };

    const handleSmartCategorize = async () => {
        if (!onUpdate || isSmartFilling) return;
        
        const unclassifiedItems = data.filter(t => t.category === 'Unclassified');
        if (unclassifiedItems.length === 0) return;

        setIsSmartFilling(true);
        
        // Get unique descriptions to minimize API usage
        // Use 'notes' (description) as the primary key for classification
        const descriptions = [...new Set(unclassifiedItems.map(t => t.notes).filter(n => !!n))];
        
        // Process in batches of 50 to avoid token limits
        const batchSize = 50;
        let updates: Transaction[] = [];

        try {
            for (let i = 0; i < descriptions.length; i += batchSize) {
                const batch = descriptions.slice(i, i + batchSize);
                const mapping = await suggestCategories(batch);
                
                // Apply mapping to all matching unclassified transactions
                const batchUpdates = unclassifiedItems.filter(t => mapping[t.notes]).map(t => ({
                    ...t,
                    category: mapping[t.notes]
                }));
                updates = [...updates, ...batchUpdates];
            }

            if (updates.length > 0) {
                onUpdate(updates);
                alert(`Successfully categorized ${updates.length} transactions!`);
            } else {
                alert("AI couldn't find confident categories for these items.");
            }
        } catch (e) {
            console.error(e);
            alert("Error running Smart Categorize.");
        } finally {
            setIsSmartFilling(false);
        }
    };

    const exportToCsv = () => {
        // Headers for CSV
        const headers: (keyof Transaction)[] = ['id', 'owner', 'type', 'date', 'time', 'category', 'subCategory', 'notes', 'amount', 'project'];
        // Display Headers (UI Friendly)
        const displayHeaders = ['ID', 'Entity', 'Type', 'Date', 'Time', 'Category', 'SubCategory', 'Notes', 'Amount', 'Project'];
        
        const csvRows = [
            displayHeaders.join(','),
            ...filteredAndSortedData.map(row => 
                headers.map(fieldName => {
                    const val = row[fieldName];
                    return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
                }).join(',')
            )
        ];
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', 'transactions.csv');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const SortableHeader = ({ tkey, label }: { tkey: keyof Transaction; label: string }) => {
        const isSorted = sortConfig?.key === tkey;
        const sortIcon = isSorted ? (sortConfig?.direction === 'ascending' ? '▲' : '▼') : '↕';
        return (
            <th scope="col" className="px-6 py-3 cursor-pointer hover:bg-slate-200 transition-colors whitespace-nowrap select-none" onClick={() => requestSort(tkey)}>
                <div className="flex items-center gap-1">
                    {label}
                    <span className={`text-xs ${isSorted ? 'text-blue-600' : 'text-slate-300'}`}>{sortIcon}</span>
                </div>
            </th>
        );
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm space-y-4 relative">
             <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                 <h3 className="text-lg font-bold text-slate-800">Data Explorer</h3>
                 <div className="flex-grow flex flex-wrap justify-end gap-3 w-full md:w-auto">
                    {unclassifiedCount > 0 && (
                        <button 
                            onClick={handleSmartCategorize} 
                            disabled={isSmartFilling}
                            className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition shadow flex items-center gap-2 w-full md:w-auto justify-center disabled:opacity-50 disabled:cursor-wait"
                        >
                            {isSmartFilling ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <span className="text-yellow-300">✨</span>
                            )}
                            <span>Smart Category Fill ({unclassifiedCount})</span>
                        </button>
                    )}
                    <button onClick={exportToCsv} className="px-4 py-2 text-sm rounded-lg bg-slate-800 text-white font-semibold hover:bg-slate-900 transition shadow flex items-center gap-2 w-full md:w-auto justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="16" height="16" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        <span>Export CSV</span>
                    </button>
                 </div>
            </div>

            {/* Filters Container */}
            <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-5">
                {/* Row 1: Primary Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                     <div className="relative">
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm shadow-sm"
                        />
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="16" height="16" className="w-4 h-4 text-slate-400 absolute left-3 top-2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                        </svg>
                     </div>

                     <select value={selectedType} onChange={e => setSelectedType(e.target.value as any)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white text-sm shadow-sm">
                        <option value="all">All Types</option>
                        <option value="Income">Income</option>
                        <option value="Expense">Expense</option>
                        <option value="Transfer">Transfer</option>
                    </select>
                    <MultiSelect label="Category" options={uniqueCategories} selected={selectedCategories} onChange={setSelectedCategories} />
                    <MultiSelect label="Subcategory" options={uniqueSubCategories} selected={selectedSubCategories} onChange={setSelectedSubCategories} />
                    <MultiSelect label="Project" options={uniqueProjects} selected={selectedProjects} onChange={setSelectedProjects} />
                </div>

                {/* Row 2: Range Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Date Range */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                        <span className="text-xs font-bold uppercase text-slate-400 tracking-wider w-full sm:w-12">Date</span>
                        <div className="flex items-center gap-2 w-full">
                            <input 
                                type="date" 
                                value={dateRange.start} 
                                onChange={e => setDateRange(dr => ({...dr, start: e.target.value}))} 
                                className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:border-blue-500 outline-none" 
                            />
                            <span className="text-slate-300">→</span>
                            <input 
                                type="date" 
                                value={dateRange.end} 
                                onChange={e => setDateRange(dr => ({...dr, end: e.target.value}))} 
                                className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:border-blue-500 outline-none" 
                            />
                        </div>
                    </div>

                    {/* Amount Range */}
                    <div className="flex flex-col justify-center gap-2 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Amount</span>
                            <div className="flex gap-2 items-center w-full sm:max-w-[240px]">
                                <input 
                                    type="number" 
                                    placeholder="Min" 
                                    value={amountRange.min} 
                                    onChange={e => setAmountRange(ar => ({...ar, min: e.target.value}))} 
                                    className="w-full px-2 py-1 border border-slate-300 rounded text-xs text-right focus:border-blue-500 outline-none" 
                                />
                                <span className="text-slate-300 text-xs">-</span>
                                <input 
                                    type="number" 
                                    placeholder="Max" 
                                    value={amountRange.max} 
                                    onChange={e => setAmountRange(ar => ({...ar, max: e.target.value}))} 
                                    className="w-full px-2 py-1 border border-slate-300 rounded text-xs text-right focus:border-blue-500 outline-none" 
                                />
                            </div>
                        </div>
                        <input 
                            type="range" 
                            min={globalMin} 
                            max={globalMax} 
                            value={sliderMax} 
                            onChange={(e) => setAmountRange(prev => ({ ...prev, max: e.target.value }))}
                            className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                    </div>
                </div>
            </div>
           
            {/* BULK ACTIONS FLOATING BAR */}
            {selectedIds.size > 0 && (
                <div className="sticky top-0 z-20 bg-blue-900 text-white p-4 rounded-xl shadow-xl flex flex-wrap items-center gap-4 animate-fade-in mb-4">
                    <div className="font-bold whitespace-nowrap">{selectedIds.size} Selected</div>
                    <div className="h-6 w-px bg-blue-700 hidden sm:block"></div>
                    
                    <div className="flex items-center gap-2">
                        <button onClick={() => setBulkAction(bulkAction === 'category' ? null : 'category')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${bulkAction === 'category' ? 'bg-white text-blue-900' : 'bg-blue-800 hover:bg-blue-700'}`}>
                            Set Category
                        </button>
                        <button onClick={() => setBulkAction(bulkAction === 'type' ? null : 'type')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${bulkAction === 'type' ? 'bg-white text-blue-900' : 'bg-blue-800 hover:bg-blue-700'}`}>
                            Set Type
                        </button>
                        <button onClick={() => handleBulkApply('delete')} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 transition ml-2">
                            Delete Selected
                        </button>
                    </div>

                    {bulkAction && bulkAction !== 'delete' && (
                        <div className="flex items-center gap-2 ml-auto animate-fade-in">
                            {bulkAction === 'type' ? (
                                <select 
                                    value={bulkValue} 
                                    onChange={(e) => setBulkValue(e.target.value)} 
                                    className="text-slate-800 px-3 py-1.5 rounded-lg text-sm border-none outline-none"
                                >
                                    <option value="">Select Type...</option>
                                    <option value="Income">Income</option>
                                    <option value="Expense">Expense</option>
                                    <option value="Transfer">Transfer</option>
                                </select>
                            ) : (
                                <input 
                                    type="text" 
                                    placeholder={`New ${bulkAction}...`} 
                                    value={bulkValue}
                                    onChange={(e) => setBulkValue(e.target.value)}
                                    className="text-slate-800 px-3 py-1.5 rounded-lg text-sm border-none outline-none w-48"
                                    list="bulk-options"
                                />
                            )}
                            <datalist id="bulk-options">
                                {uniqueCategories.map(c => <option key={c} value={c} />)}
                            </datalist>
                            <button onClick={() => handleBulkApply()} className="bg-green-500 hover:bg-green-400 text-white font-bold px-4 py-1.5 rounded-lg text-sm">
                                Apply
                            </button>
                        </div>
                    )}
                    
                    <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-blue-300 hover:text-white underline">Clear</button>
                </div>
            )}

            {/* Data Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm min-h-[400px]">
                <table className="w-full text-sm text-left text-slate-500 min-w-[1000px]">
                    <thead className="text-xs text-slate-700 uppercase bg-slate-100 font-bold border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3 w-10">
                                <input type="checkbox" onChange={toggleSelectAll} checked={selectedIds.size === paginatedData.length && paginatedData.length > 0} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                            </th>
                            <th className="px-4 py-3 w-10">Action</th>
                            <SortableHeader tkey="date" label="Date" />
                            <SortableHeader tkey="owner" label="Entity" />
                            <SortableHeader tkey="type" label="Type" />
                            <SortableHeader tkey="category" label="Category" />
                            <SortableHeader tkey="subCategory" label="Sub-Cat" />
                            <SortableHeader tkey="project" label="Project" />
                            <SortableHeader tkey="notes" label="Notes" />
                            <SortableHeader tkey="amount" label="Amount" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {paginatedData.map((t, i) => {
                            const isEditing = editingId === t.id;
                            return (
                            <tr key={t.id} className={`hover:bg-blue-50/50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'} ${selectedIds.has(t.id) ? 'bg-blue-50' : ''}`}>
                                <td className="px-4 py-3">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedIds.has(t.id)} 
                                        onChange={() => toggleSelection(t.id)} 
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                                    />
                                </td>
                                <td className="px-4 py-3">
                                    {isEditing ? (
                                        <div className="flex gap-1">
                                            <button onClick={saveEditing} className="text-green-600 hover:text-green-800 p-1 font-bold" title="Save (Enter)">✓</button>
                                            <button onClick={cancelEditing} className="text-red-600 hover:text-red-800 p-1 font-bold" title="Cancel (Esc)">✕</button>
                                        </div>
                                    ) : (
                                        <button onClick={() => startEditing(t)} className="text-blue-500 hover:text-blue-700 p-1" title="Edit Row">
                                            ✎
                                        </button>
                                    )}
                                </td>
                                
                                {/* --- EDITABLE FIELDS --- */}
                                
                                {/* Date */}
                                <td className="px-6 py-3 whitespace-nowrap font-medium text-slate-700">
                                    {isEditing ? <input type="date" className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs" value={editForm.date || ''} onChange={e => setEditForm({...editForm, date: e.target.value})} onKeyDown={handleKeyDown} /> : t.date}
                                </td>

                                {/* Owner */}
                                <td className="px-6 py-3">
                                    {isEditing ? <input className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs" value={editForm.owner || ''} onChange={e => setEditForm({...editForm, owner: e.target.value})} onKeyDown={handleKeyDown} /> : t.owner}
                                </td>

                                {/* Type */}
                                <td className="px-6 py-3">
                                    {isEditing ? (
                                        <select className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs" value={editForm.type || 'Expense'} onChange={e => setEditForm({...editForm, type: e.target.value as TransactionType})} onKeyDown={handleKeyDown}>
                                            <option value="Expense">Expense</option>
                                            <option value="Income">Income</option>
                                            <option value="Transfer">Transfer</option>
                                        </select>
                                    ) : (
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            t.type === 'Income' ? 'bg-green-100 text-green-800' :
                                            t.type === 'Expense' ? 'bg-red-100 text-red-800' :
                                            'bg-blue-100 text-blue-800'
                                        }`}>
                                            {t.type}
                                        </span>
                                    )}
                                </td>

                                {/* Category */}
                                <td className="px-6 py-3 text-slate-800 font-medium">
                                    {isEditing ? (
                                        <div className="flex flex-col gap-1">
                                            <input list="cat-options" className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs" value={editForm.category || ''} onChange={e => setEditForm({...editForm, category: e.target.value})} onKeyDown={handleKeyDown} />
                                            {/* LEARN RULE OPTION */}
                                            <label className="flex items-center gap-1 text-[10px] text-slate-500 cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={saveRule} 
                                                    onChange={(e) => setSaveRule(e.target.checked)} 
                                                    className="w-3 h-3 text-blue-600 rounded border-slate-300 focus:ring-0" 
                                                />
                                                <span>Apply to future "{editForm.notes?.substring(0, 15)}..."</span>
                                            </label>
                                        </div>
                                    ) : t.category}
                                </td>

                                {/* SubCat */}
                                <td className="px-6 py-3 text-slate-600">
                                    {isEditing ? (
                                        <input className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs" value={editForm.subCategory || ''} onChange={e => setEditForm({...editForm, subCategory: e.target.value})} onKeyDown={handleKeyDown} />
                                    ) : t.subCategory}
                                </td>

                                {/* Project */}
                                <td className="px-6 py-3 text-slate-600">
                                    {isEditing ? (
                                        <input className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs" value={editForm.project || ''} onChange={e => setEditForm({...editForm, project: e.target.value})} onKeyDown={handleKeyDown} />
                                    ) : (
                                        t.project && t.project !== 'None' ? (
                                            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs border border-slate-200">{t.project}</span>
                                        ) : <span className="text-slate-300">-</span>
                                    )}
                                </td>

                                {/* Notes */}
                                <td className="px-6 py-3 text-slate-500 max-w-xs truncate">
                                    {isEditing ? (
                                        <input className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs" value={editForm.notes || ''} onChange={e => setEditForm({...editForm, notes: e.target.value})} onKeyDown={handleKeyDown} />
                                    ) : (
                                        <span title={t.notes}>{t.notes}</span>
                                    )}
                                </td>

                                {/* Amount */}
                                <td className={`px-6 py-3 text-right font-mono font-medium ${t.type === 'Income' ? 'text-green-600' : 'text-slate-800'}`}>
                                    {isEditing ? (
                                        <input type="number" className="w-24 bg-white border border-slate-300 rounded px-2 py-1 text-xs text-right" value={editForm.amount || ''} onChange={e => setEditForm({...editForm, amount: parseFloat(e.target.value)})} onKeyDown={handleKeyDown} />
                                    ) : (
                                        <>{t.type === 'Expense' && '-'}{formatCurrency(t.amount)}</>
                                    )}
                                </td>
                            </tr>
                        )})}
                    </tbody>
                </table>
                {paginatedData.length === 0 && (
                    <div className="p-12 text-center text-slate-400">
                        No transactions match your filters.
                    </div>
                )}
            </div>
            
            <datalist id="cat-options">
                {uniqueCategories.map(c => <option key={c} value={c} />)}
            </datalist>

            {/* Pagination */}
             <div className="flex flex-col sm:flex-row justify-between items-center pt-2 px-2 gap-4">
                <span className="text-xs text-slate-400">
                    Showing {filteredAndSortedData.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, filteredAndSortedData.length)} of {filteredAndSortedData.length} records
                </span>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                        disabled={currentPage === 1} 
                        className="px-3 py-1.5 text-xs font-medium rounded-md bg-white border border-slate-300 text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-colors shadow-sm"
                    >
                        Previous
                    </button>
                    <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                        disabled={currentPage === totalPages || totalPages === 0} 
                        className="px-3 py-1.5 text-xs font-medium rounded-md bg-white border border-slate-300 text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-colors shadow-sm"
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DataTab;