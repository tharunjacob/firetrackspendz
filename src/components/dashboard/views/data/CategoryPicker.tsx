import { useMemo } from 'react';
import type { Transaction } from '@/types';
import { TYPE_CATEGORIES, DEFAULT_CATEGORIES } from '@/utils/constants';

interface Props {
  transaction: Transaction;
  allCategories: string[];
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onChange: (t: Transaction, newCategory: string) => void;
}

export const CategoryPicker = ({ transaction, allCategories, isOpen, onOpen, onClose, onChange }: Props) => {
  const filteredCategories = useMemo(() => {
    const type = transaction.type;
    const defaults = TYPE_CATEGORIES[type as keyof typeof TYPE_CATEGORIES] || DEFAULT_CATEGORIES;
    const isDefaultCategory = (cat: string) => DEFAULT_CATEGORIES.includes(cat);

    return allCategories.filter(cat => {
      if (cat === transaction.category) return true;
      if (isDefaultCategory(cat)) {
        return defaults.includes(cat);
      }
      return true;
    });
  }, [allCategories, transaction.type, transaction.category]);

  if (isOpen) {
    return (
      <select
        autoFocus
        value={transaction.category}
        onChange={e => onChange(transaction, e.target.value)}
        onBlur={onClose}
        className="text-xs border border-brand-300 dark:border-brand-700 rounded px-1 py-0.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none max-w-[160px]"
      >
        {filteredCategories.map(c => <option key={c} value={c}>{c}</option>)}
        <option value="__custom__">+ Custom...</option>
      </select>
    );
  }
  return (
    <button
      onClick={onOpen}
      className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-xs hover:bg-brand-100 dark:hover:bg-slate-600 hover:text-brand-700 dark:hover:text-brand-400 transition-colors"
      title="Click to change category"
    >
      {transaction.category}
    </button>
  );
};
