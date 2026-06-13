import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { DEFAULT_CATEGORIES, TYPE_CATEGORIES } from '@/utils/constants';
import { Icon } from '@/components/common/Icons';
import { FileUploader } from '@/components/upload/FileUploader';
import { createRuleFromEdit, normalizeKeyword } from '@/services/learningRules';
import type { Transaction } from '@/types';
import { ITEMS_PER_PAGE, type EditState } from './types';
import { TransactionTable } from './TransactionTable';
import { TransactionCard } from './TransactionCard';
import { TransactionEditPanel } from './TransactionEditPanel';
import { Pagination } from './Pagination';
import { BatchActions } from './BatchActions';

export const DataView = () => {
  const { transactions, currency, updateTransactions, deleteTransactions, processFiles, isProcessing, processingProgress, showToast } = useApp();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showUploader, setShowUploader] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<EditState>({
    category: '', customCategory: '', notes: '', type: 'Expense',
    amount: '', date: '', subCategory: '', owner: '',
  });
  const [useCustomCategory, setUseCustomCategory] = useState(false);
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const [batchCategoryOpen, setBatchCategoryOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [showEditHint, setShowEditHint] = useState(() => {
    try { return localStorage.getItem('tsz_data_edit_hint_dismissed') !== '1'; }
    catch { return true; }
  });
  const [pendingBulkUpdate, setPendingBulkUpdate] = useState<{
    originalTransaction: Transaction;
    newCategory: string;
    field: 'category' | 'subCategory';
    matchingIds: string[];
    keyword: string;
  } | null>(null);
  const dismissEditHint = useCallback(() => {
    setShowEditHint(false);
    try { localStorage.setItem('tsz_data_edit_hint_dismissed', '1'); } catch { /* ignore */ }
  }, []);

  const owners = useMemo(() => [...new Set(transactions.map(t => t.owner))], [transactions]);
  const allCategories = useMemo(() => {
    const fromTxns = transactions.map(t => t.category);
    const combined = new Set([...DEFAULT_CATEGORIES, ...fromTxns]);
    return [...combined].sort();
  }, [transactions]);

  const filtered = useMemo(() => {
    let result = [...transactions];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.notes.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.merchant_name?.toLowerCase().includes(q) ||
        t.original_description?.toLowerCase().includes(q) ||
        t.owner.toLowerCase().includes(q)
      );
    }
    if (typeFilter !== 'all') result = result.filter(t => t.type === typeFilter);
    if (ownerFilter !== 'all') result = result.filter(t => t.owner === ownerFilter);
    result.sort((a, b) => {
      const cmp = sortBy === 'date' ? a.date.localeCompare(b.date) : a.amount - b.amount;
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return result;
  }, [transactions, search, typeFilter, ownerFilter, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = useMemo(
    () => filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE),
    [filtered, page]
  );

  useEffect(() => { setPage(1); }, [search, typeFilter, ownerFilter, sortBy, sortDir]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds(prev => {
      if (prev.size === filtered.length) return new Set();
      return new Set(filtered.map(t => t.id));
    });
  }, [filtered]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    deleteTransactions([...selectedIds]);
    setSelectedIds(new Set());
  }, [selectedIds, deleteTransactions]);

  const startEdit = useCallback((t: Transaction) => {
    setEditId(t.id);
    setEditData({
      category: t.category,
      customCategory: '',
      notes: t.notes,
      type: t.type,
      amount: t.amount.toString(),
      date: t.date,
      subCategory: t.subCategory || '',
      owner: t.owner,
    });
    setUseCustomCategory(false);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditId(null);
    setUseCustomCategory(false);
  }, []);

  const handleInlineCategoryChange = useCallback(async (t: Transaction, newCategory: string) => {
    setOpenCategoryId(null);
    if (newCategory === '__custom__') {
      startEdit(t);
      return;
    }
    if (newCategory === t.category) return;

    const keyword = normalizeKeyword(t.original_description || t.notes || '');
    const similarTxns = keyword.length >= 3
      ? transactions.filter(other =>
          other.id !== t.id &&
          (other.original_description || other.notes || '').toLowerCase().includes(keyword) &&
          other.category !== newCategory
        )
      : [];

    if (similarTxns.length > 0) {
      setPendingBulkUpdate({
        originalTransaction: { ...t, category: newCategory },
        newCategory,
        field: 'category',
        matchingIds: similarTxns.map(s => s.id),
        keyword,
      });
    } else {
      updateTransactions([{ ...t, category: newCategory }]);
      const created = await createRuleFromEdit(t, 'category', newCategory);
      if (created) showToast(`Learned: similar transactions → "${newCategory}"`);
    }
  }, [transactions, updateTransactions, showToast, startEdit]);

  const handleInlineTypeChange = useCallback(async (t: Transaction, newType: 'Income' | 'Expense' | 'Transfer') => {
    if (newType === t.type) return;
    let newCategory = t.category;

    const defaults = TYPE_CATEGORIES[newType as keyof typeof TYPE_CATEGORIES] || DEFAULT_CATEGORIES;
    const isDefaultCategory = (cat: string) => DEFAULT_CATEGORIES.includes(cat);

    if (isDefaultCategory(t.category) && !defaults.includes(t.category)) {
      if (newType === 'Income') newCategory = 'Other Income';
      else if (newType === 'Expense') newCategory = 'Unclassified';
      else if (newType === 'Transfer') newCategory = 'Transfer';
    }

    updateTransactions([{ ...t, type: newType, category: newCategory }]);
    
    if (newCategory !== t.category) {
      showToast(`Updated transaction to ${newType} and category auto-corrected to "${newCategory}"`);
    } else {
      showToast(`Updated transaction type to ${newType}`);
    }
  }, [updateTransactions, showToast]);

  const handleBatchCategory = useCallback(async (newCategory: string) => {
    setBatchCategoryOpen(false);
    if (!newCategory) return;
    const toUpdate = [...selectedIds]
      .map(id => transactions.find(t => t.id === id))
      .filter((t): t is Transaction => !!t);
    updateTransactions(toUpdate.map(t => ({ ...t, category: newCategory })));
    for (const t of toUpdate) {
      if (t.category !== newCategory) await createRuleFromEdit(t, 'category', newCategory);
    }
    const n = toUpdate.length;
    showToast(`Updated ${n} transaction${n !== 1 ? 's' : ''} to "${newCategory}"`);
    setSelectedIds(new Set());
  }, [selectedIds, transactions, updateTransactions, showToast]);

  const saveEdit = useCallback(async () => {
    if (!editId) return;
    const tx = transactions.find(t => t.id === editId);
    if (!tx) return;

    const finalCategory = useCustomCategory && editData.customCategory.trim()
      ? editData.customCategory.trim()
      : editData.category;

    const parsedAmount = parseFloat(editData.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    const updatedTx = {
      ...tx,
      category: finalCategory,
      notes: editData.notes,
      type: editData.type,
      amount: parsedAmount,
      date: editData.date,
      subCategory: editData.subCategory,
      owner: editData.owner,
    };

    if (finalCategory !== tx.category) {
      const keyword = normalizeKeyword(tx.original_description || tx.notes || '');
      const similarTxns = keyword.length >= 3
        ? transactions.filter(other =>
            other.id !== tx.id &&
            (other.original_description || other.notes || '').toLowerCase().includes(keyword) &&
            other.category !== finalCategory
          )
        : [];

      if (similarTxns.length > 0) {
        setPendingBulkUpdate({
          originalTransaction: updatedTx,
          newCategory: finalCategory,
          field: 'category',
          matchingIds: similarTxns.map(s => s.id),
          keyword,
        });
        setEditId(null);
        setUseCustomCategory(false);
        return;
      }
    } else if (editData.subCategory && editData.subCategory !== (tx.subCategory || '')) {
      const keyword = normalizeKeyword(tx.original_description || tx.notes || '');
      const similarTxns = keyword.length >= 3
        ? transactions.filter(other =>
            other.id !== tx.id &&
            (other.original_description || other.notes || '').toLowerCase().includes(keyword) &&
            (other.subCategory || '') !== editData.subCategory
          )
        : [];

      if (similarTxns.length > 0) {
        setPendingBulkUpdate({
          originalTransaction: updatedTx,
          newCategory: editData.subCategory,
          field: 'subCategory',
          matchingIds: similarTxns.map(s => s.id),
          keyword,
        });
        setEditId(null);
        setUseCustomCategory(false);
        return;
      }
    }

    updateTransactions([updatedTx]);

    if (finalCategory !== tx.category) {
      const created = await createRuleFromEdit(tx, 'category', finalCategory);
      if (created) showToast(`Learned: similar transactions will be categorized as "${finalCategory}"`);
    }
    if (editData.subCategory && editData.subCategory !== (tx.subCategory || '')) {
      await createRuleFromEdit(tx, 'subCategory', editData.subCategory);
    }

    setEditId(null);
    setUseCustomCategory(false);
  }, [editId, transactions, useCustomCategory, editData, updateTransactions, showToast]);

  const handleConfirmBulkUpdate = useCallback(async (updateAll: boolean) => {
    if (!pendingBulkUpdate) return;
    const { originalTransaction, newCategory, field, matchingIds } = pendingBulkUpdate;
    setPendingBulkUpdate(null);

    const txnsToUpdate = [originalTransaction];

    if (updateAll) {
      matchingIds.forEach(id => {
        const other = transactions.find(t => t.id === id);
        if (other) {
          txnsToUpdate.push({
            ...other,
            [field]: newCategory,
          });
        }
      });
    }

    await updateTransactions(txnsToUpdate);

    // Create the learning rule
    const created = await createRuleFromEdit(originalTransaction, field, newCategory);

    if (updateAll) {
      showToast(`Updated ${txnsToUpdate.length} transactions and saved rule.`);
    } else {
      const msg = field === 'category' ? `categorized as "${newCategory}"` : `updated subcategory to "${newCategory}"`;
      if (created) {
        showToast(`Updated 1 transaction. Learned: similar future transactions will be ${msg}`);
      } else {
        showToast(`Updated 1 transaction.`);
      }
    }
  }, [pendingBulkUpdate, transactions, updateTransactions, showToast]);

  const onSort = useCallback((field: 'date' | 'amount') => {
    setSortBy(field);
    setSortDir(d => d === 'asc' ? 'desc' : 'asc');
  }, []);

  const toggleCustomCategory = useCallback(() => setUseCustomCategory(v => !v), []);
  const onOpenCategory = useCallback((id: string) => setOpenCategoryId(id), []);
  const onCloseCategory = useCallback(() => setOpenCategoryId(null), []);
  const onDelete = useCallback((id: string) => deleteTransactions([id]), [deleteTransactions]);

  const handleStartAnalysis = useCallback(async (jobs: any[]) => {
    try {
      const result = await processFiles(jobs);
      // Auto-collapse the uploader after a successful import so the user lands on
      // their data table. Only collapse when at least one file imported (never on
      // a failed/empty import — the panel stays open so the user can retry). A
      // short delay lets the "success" state register before the panel hides.
      if (result && result.successCount > 0) {
        setTimeout(() => setShowUploader(false), 1000);
      }
    } catch (e) {
      // Processing failed — keep the uploader open so the user can try again.
    }
  }, [processFiles]);

  const paginationBar = (
    <Pagination page={page} totalPages={totalPages} totalFiltered={filtered.length} onPageChange={setPage} />
  );

  return (
    <div className="space-y-4 animate-fade-in">
      {showEditHint && (
        <div className="flex items-start gap-3 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg px-4 py-3">
          <Icon name="pencil" className="w-4 h-4 text-brand-600 mt-0.5 shrink-0" />
          <p className="flex-1 text-xs text-brand-800 dark:text-brand-300 leading-relaxed">
            Tap any category to edit it. Your corrections automatically apply to future uploads.
          </p>
          <button
            onClick={dismissEditHint}
            aria-label="Dismiss"
            className="text-brand-500 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-200 shrink-0 p-0.5"
          >
            <Icon name="close" className="w-4 h-4" />
          </button>
        </div>
      )}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Transaction Data ({filtered.length})</h2>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowUploader(!showUploader)} className="btn-primary text-sm px-4 py-2">
            <Icon name="upload" className="w-4 h-4 inline mr-1" /> Upload More
          </button>
          <BatchActions
            selectedCount={selectedIds.size}
            allCategories={allCategories}
            batchOpen={batchCategoryOpen}
            onToggleBatch={() => setBatchCategoryOpen(o => !o)}
            onCloseBatch={() => setBatchCategoryOpen(false)}
            onDeleteSelected={handleDeleteSelected}
            onCategorize={handleBatchCategory}
          />
        </div>
      </div>

      {showUploader && (
        <div className="animate-slide-up">
          <FileUploader onStartAnalysis={handleStartAnalysis} isProcessing={isProcessing} progress={processingProgress} />
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Icon name="search" className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input type="text" placeholder="Search transactions..." value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="input-field w-auto">
          <option value="all">All Types</option>
          <option value="Income">Income</option>
          <option value="Expense">Expense</option>
          <option value="Transfer">Transfer</option>
        </select>
        <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} className="input-field w-auto">
          <option value="all">All Accounts</option>
          {owners.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      <div className="text-xs text-slate-500 flex items-center gap-2">
        <Icon name="pencil" className="w-3.5 h-3.5" />
        Click any category pill to change it instantly. Use the pencil icon for full edits (date, amount, account).
      </div>

      <div className="md:hidden space-y-2">
        {paginated.map(t => (
          <React.Fragment key={t.id}>
            <TransactionCard
              transaction={t}
              currency={currency}
              selected={selectedIds.has(t.id)}
              editing={editId === t.id}
              categoryOpen={openCategoryId === t.id}
              allCategories={allCategories}
              onToggleSelect={toggleSelect}
              onOpenCategory={onOpenCategory}
              onCloseCategory={onCloseCategory}
              onInlineCategoryChange={handleInlineCategoryChange}
              onStartEdit={startEdit}
              onCancelEdit={cancelEdit}
              onDelete={onDelete}
            />
            {editId === t.id && (
              <div className="bg-brand-50/30 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg px-4 py-4 -mt-1">
                <TransactionEditPanel
                  editData={editData}
                  setEditData={setEditData}
                  useCustomCategory={useCustomCategory}
                  toggleCustomCategory={toggleCustomCategory}
                  allCategories={allCategories}
                  onSave={saveEdit}
                  onCancel={cancelEdit}
                />
              </div>
            )}
          </React.Fragment>
        ))}
        {paginationBar}
      </div>

      <div className="card overflow-hidden hidden md:block">
        {paginationBar}
        <TransactionTable
          paginated={paginated}
          totalFiltered={filtered.length}
          selectedIds={selectedIds}
          currency={currency}
          sortBy={sortBy}
          sortDir={sortDir}
          editId={editId}
          editData={editData}
          setEditData={setEditData}
          useCustomCategory={useCustomCategory}
          toggleCustomCategory={toggleCustomCategory}
          openCategoryId={openCategoryId}
          allCategories={allCategories}
          onToggleSelect={toggleSelect}
          onToggleAll={toggleAll}
          onSort={onSort}
          onOpenCategory={onOpenCategory}
          onCloseCategory={onCloseCategory}
          onInlineCategoryChange={handleInlineCategoryChange}
          onInlineTypeChange={handleInlineTypeChange}
          onStartEdit={startEdit}
          onCancelEdit={cancelEdit}
          onSaveEdit={saveEdit}
        />
        {paginationBar}
      </div>

      {pendingBulkUpdate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setPendingBulkUpdate(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 max-w-lg w-full p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-100 dark:bg-brand-900/30 rounded-full flex items-center justify-center text-brand-600 dark:text-brand-400">
                  <Icon name="ai" className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Apply rules to existing data?</h3>
                  <p className="text-xs text-slate-500">We found similar transactions matching "{pendingBulkUpdate.keyword}"</p>
                </div>
              </div>
              <button onClick={() => setPendingBulkUpdate(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <Icon name="close" className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-xl p-4 mb-4">
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
                We found <strong className="text-brand-600 dark:text-brand-400">{pendingBulkUpdate.matchingIds.length} other</strong> matching transactions currently categorized differently.
              </p>
              <p className="text-xs text-slate-500">
                Do you want to update all of them to <strong className="text-slate-800 dark:text-slate-200">"{pendingBulkUpdate.newCategory}"</strong> or only update the one you just edited?
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 justify-end">
              <button
                onClick={() => handleConfirmBulkUpdate(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
              >
                Only this one
              </button>
              <button
                onClick={() => handleConfirmBulkUpdate(true)}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-750 text-white rounded-xl transition-colors text-sm font-medium shadow-md shadow-brand-600/10 flex items-center justify-center gap-1.5"
              >
                <Icon name="check" className="w-4 h-4" />
                Update all {pendingBulkUpdate.matchingIds.length + 1} transactions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
