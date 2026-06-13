import React, { useState } from 'react';
import { Icon } from '@/components/common/Icons';
import { formatAmount } from '@/utils/constants';
import type { Transaction, Currency } from '@/types';
import { CategoryPicker } from './CategoryPicker';
import { TransactionEditPanel } from './TransactionEditPanel';
import type { EditState } from './types';

interface Props {
  paginated: Transaction[];
  totalFiltered: number;
  selectedIds: Set<string>;
  currency: Currency;
  sortBy: 'date' | 'amount';
  sortDir: 'asc' | 'desc';
  editId: string | null;
  editData: EditState;
  setEditData: React.Dispatch<React.SetStateAction<EditState>>;
  useCustomCategory: boolean;
  toggleCustomCategory: () => void;
  openCategoryId: string | null;
  allCategories: string[];
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
  onSort: (field: 'date' | 'amount') => void;
  onOpenCategory: (id: string) => void;
  onCloseCategory: () => void;
  onInlineCategoryChange: (t: Transaction, newCategory: string) => void;
  onInlineTypeChange: (t: Transaction, newType: 'Income' | 'Expense' | 'Transfer') => void;
  onStartEdit: (t: Transaction) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
}

export const TransactionTable = ({
  paginated, totalFiltered, selectedIds, currency, sortBy, sortDir,
  editId, editData, setEditData, useCustomCategory, toggleCustomCategory,
  openCategoryId, allCategories,
  onToggleSelect, onToggleAll, onSort, onOpenCategory, onCloseCategory,
  onInlineCategoryChange, onInlineTypeChange, onStartEdit, onCancelEdit, onSaveEdit,
}: Props) => {
  const [editingTypeRowId, setEditingTypeRowId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead className="bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
        <tr>
          <th className="px-3 py-3 w-10">
            <input type="checkbox" onChange={onToggleAll} checked={selectedIds.size === totalFiltered && totalFiltered > 0} className="rounded" />
          </th>
          <th
            className="px-3 py-3 text-left cursor-pointer hover:text-slate-700 dark:hover:text-slate-200"
            onClick={() => onSort('date')}
          >
            Date {sortBy === 'date' && (sortDir === 'asc' ? '↑' : '↓')}
          </th>
          <th className="px-3 py-3 text-left">Account</th>
          <th className="px-3 py-3 text-left">Description</th>
          <th className="px-3 py-3 text-left">Category</th>
          <th className="px-3 py-3 text-left">Sub-Cat</th>
          <th className="px-3 py-3 text-left">Type</th>
          <th
            className="px-3 py-3 text-right cursor-pointer hover:text-slate-700 dark:hover:text-slate-200"
            onClick={() => onSort('amount')}
          >
            Amount {sortBy === 'amount' && (sortDir === 'asc' ? '↑' : '↓')}
          </th>
          <th className="px-3 py-3 w-10"></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
        {paginated.map(t => (
          <React.Fragment key={t.id}>
            <tr className={`hover:bg-slate-50 dark:hover:bg-slate-700 ${selectedIds.has(t.id) ? 'bg-brand-50 dark:bg-brand-950/30' : ''} ${editId === t.id ? 'bg-brand-50/50 dark:bg-brand-900/20' : ''}`}>
              <td className="px-3 py-2.5">
                <input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => onToggleSelect(t.id)} className="rounded" />
              </td>
              <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">{t.date}</td>
              <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 text-xs">{t.owner}</td>
              <td className="px-3 py-2.5 max-w-[200px] text-slate-700 dark:text-slate-200" title={t.original_description || t.notes}>
                <span className="block truncate">{t.notes}</span>
                {t.original_description && t.original_description !== t.notes && (
                  <span className="block text-[10px] text-slate-500 truncate mt-0.5">{t.original_description}</span>
                )}
              </td>
              <td className="px-3 py-2.5">
                <CategoryPicker
                  transaction={t}
                  allCategories={allCategories}
                  isOpen={openCategoryId === t.id}
                  onOpen={() => onOpenCategory(t.id)}
                  onClose={onCloseCategory}
                  onChange={onInlineCategoryChange}
                />
              </td>
              <td className="px-3 py-2.5">
                <span className="text-xs text-slate-500">{t.subCategory && t.subCategory !== 'General' ? t.subCategory : '—'}</span>
              </td>
              <td
                className="px-3 py-2.5 cursor-pointer select-none"
                onDoubleClick={() => setEditingTypeRowId(t.id)}
                title="Double click to edit type"
              >
                {editingTypeRowId === t.id ? (
                  <select
                    autoFocus
                    value={t.type}
                    onChange={e => {
                      onInlineTypeChange(t, e.target.value as 'Income' | 'Expense' | 'Transfer');
                      setEditingTypeRowId(null);
                    }}
                    onBlur={() => setEditingTypeRowId(null)}
                    className="text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand-500 w-24 text-slate-700 dark:text-slate-200"
                  >
                    <option value="Income">Income</option>
                    <option value="Expense">Expense</option>
                    <option value="Transfer">Transfer</option>
                  </select>
                ) : (
                  <span className={`text-xs font-medium ${t.type === 'Income' ? 'text-green-600' : t.type === 'Expense' ? 'text-red-500' : 'text-brand-500'}`}>
                    {t.type}
                  </span>
                )}
              </td>
              <td className={`px-3 py-2.5 text-right font-semibold ${t.type === 'Income' ? 'text-green-600' : t.type === 'Expense' ? 'text-red-500' : 'text-brand-500'}`}>
                {formatAmount(t.amount, currency)}
              </td>
              <td className="px-3 py-2.5">
                {editId === t.id ? (
                  <button onClick={onCancelEdit} className="text-slate-500 hover:text-red-500" title="Cancel edit">
                    <Icon name="close" className="w-4 h-4" />
                  </button>
                ) : (
                  <button onClick={() => onStartEdit(t)} className="text-slate-500 hover:text-brand-600" title="Edit transaction">
                    <Icon name="pencil" className="w-4 h-4" />
                  </button>
                )}
              </td>
            </tr>
            {editId === t.id && (
              <tr>
                <td colSpan={9} className="px-4 py-4 bg-brand-50/30 dark:bg-brand-900/20 border-b-2 border-brand-200 dark:border-brand-800">
                  <TransactionEditPanel
                    editData={editData}
                    setEditData={setEditData}
                    useCustomCategory={useCustomCategory}
                    toggleCustomCategory={toggleCustomCategory}
                    allCategories={allCategories}
                    onSave={onSaveEdit}
                    onCancel={onCancelEdit}
                    hint
                  />
                </td>
              </tr>
            )}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  </div>
  );
};
