import React from 'react';
import { Icon } from '@/components/common/Icons';
import type { TransactionType } from '@/types';
import type { EditState } from './types';
import { TYPE_CATEGORIES, DEFAULT_CATEGORIES } from '@/utils/constants';
import { CategoryPicker } from './CategoryPicker';

interface Props {
  editData: EditState;
  setEditData: React.Dispatch<React.SetStateAction<EditState>>;
  useCustomCategory: boolean;
  toggleCustomCategory: () => void;
  allCategories: string[];
  onSave: () => void;
  onCancel: () => void;
  hint?: boolean;
}

export const TransactionEditPanel = ({
  editData, setEditData, useCustomCategory, toggleCustomCategory,
  allCategories, onSave, onCancel, hint,
}: Props) => {
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Date</label>
          <input type="date" value={editData.date} onChange={e => setEditData(p => ({ ...p, date: e.target.value }))} className="input-field text-xs py-1.5 w-full" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Amount</label>
          <input type="number" value={editData.amount} onChange={e => setEditData(p => ({ ...p, amount: e.target.value }))} className="input-field text-xs py-1.5 w-full" min="0" step="0.01" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Type</label>
          <select
            value={editData.type}
            onChange={e => {
              const newType = e.target.value as TransactionType;
              setEditData(p => {
                let newCategory = p.category;
                const defaults = TYPE_CATEGORIES[newType as keyof typeof TYPE_CATEGORIES] || DEFAULT_CATEGORIES;
                const isDefaultCategory = (cat: string) => DEFAULT_CATEGORIES.includes(cat);

                if (isDefaultCategory(p.category) && !defaults.includes(p.category)) {
                  if (newType === 'Income') newCategory = 'Other Income';
                  else if (newType === 'Expense') newCategory = 'Unclassified';
                  else if (newType === 'Transfer') newCategory = 'Transfer';
                }
                return { ...p, type: newType, category: newCategory };
              });
            }}
            className="input-field text-xs py-1.5 w-full"
          >
            <option value="Income">Income</option>
            <option value="Expense">Expense</option>
            <option value="Transfer">Transfer</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Account</label>
          <input type="text" value={editData.owner} onChange={e => setEditData(p => ({ ...p, owner: e.target.value }))} className="input-field text-xs py-1.5 w-full" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
            Category
            <button type="button" onClick={toggleCustomCategory} className="ml-2 text-[10px] text-brand-600 hover:underline">
              {useCustomCategory ? 'Use existing' : '+ Custom'}
            </button>
          </label>
          {useCustomCategory ? (
            <input type="text" value={editData.customCategory} onChange={e => setEditData(p => ({ ...p, customCategory: e.target.value }))} placeholder="Enter custom category" className="input-field text-xs py-1.5 w-full" autoFocus />
          ) : (
            <CategoryPicker
              value={editData.category}
              onChange={(newCategory: string) => setEditData(p => ({ ...p, category: newCategory }))}
              type={editData.type}
              allCategories={allCategories}
              variant="field"
            />
          )}
        </div>
      <div>
        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Sub-Category</label>
        <input type="text" value={editData.subCategory} onChange={e => setEditData(p => ({ ...p, subCategory: e.target.value }))} placeholder="e.g., General" className="input-field text-xs py-1.5 w-full" />
      </div>
      <div className="sm:col-span-2">
        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Description / Notes</label>
        <input type="text" value={editData.notes} onChange={e => setEditData(p => ({ ...p, notes: e.target.value }))} className="input-field text-xs py-1.5 w-full" />
      </div>
    </div>
    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-brand-100 dark:border-brand-900">
      <button onClick={onSave} className="btn-primary text-xs px-4 py-1.5">
        <Icon name="check" className="w-3.5 h-3.5 inline mr-1" /> Save Changes
      </button>
      <button onClick={onCancel} className="btn-secondary text-xs px-4 py-1.5">Cancel</button>
      {hint && <span className="text-[10px] text-slate-500 ml-auto">Changes are saved to your data immediately.</span>}
    </div>
  </>
  );
};
