import { Icon } from '@/components/common/Icons';
import { formatAmount } from '@/utils/constants';
import type { Transaction, Currency } from '@/types';
import { CategoryPicker } from './CategoryPicker';

interface Props {
  transaction: Transaction;
  currency: Currency;
  selected: boolean;
  editing: boolean;
  categoryOpen: boolean;
  allCategories: string[];
  onToggleSelect: (id: string) => void;
  onOpenCategory: (id: string) => void;
  onCloseCategory: () => void;
  onInlineCategoryChange: (t: Transaction, newCategory: string) => void;
  onStartEdit: (t: Transaction) => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
}

export const TransactionCard = ({
  transaction: t, currency, selected, editing, categoryOpen, allCategories,
  onToggleSelect, onOpenCategory, onCloseCategory, onInlineCategoryChange,
  onStartEdit, onCancelEdit, onDelete,
}: Props) => (
  <div className={`bg-white dark:bg-slate-800 border rounded-lg p-3 flex gap-2.5 ${selected ? 'border-brand-400 dark:border-brand-500 bg-brand-50/30 dark:bg-brand-950/30' : 'border-slate-200 dark:border-slate-700'}`}>
    <input
      type="checkbox"
      checked={selected}
      onChange={() => onToggleSelect(t.id)}
      className="rounded mt-0.5 flex-shrink-0"
    />
    <div className="flex-1 min-w-0">
      <div className="flex justify-between items-center mb-0.5">
        <span className="text-xs text-slate-500 dark:text-slate-400">{t.date}</span>
        <span className={`text-sm font-semibold ${t.type === 'Income' ? 'text-green-600' : t.type === 'Expense' ? 'text-red-500' : 'text-blue-500'}`}>
          {formatAmount(t.amount, currency)}
        </span>
      </div>
      <p className="text-sm text-slate-700 dark:text-slate-200 truncate">{t.notes}</p>
      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        <CategoryPicker
          transaction={t}
          allCategories={allCategories}
          isOpen={categoryOpen}
          onOpen={() => onOpenCategory(t.id)}
          onClose={onCloseCategory}
          onChange={onInlineCategoryChange}
        />
        <span className={`text-xs font-medium ${t.type === 'Income' ? 'text-green-600' : t.type === 'Expense' ? 'text-red-500' : 'text-blue-500'}`}>
          {t.type}
        </span>
      </div>
    </div>
    <div className="flex flex-col gap-1.5 flex-shrink-0 items-center">
      {editing ? (
        <button onClick={onCancelEdit} className="text-slate-400 hover:text-red-500" title="Cancel edit">
          <Icon name="close" className="w-4 h-4" />
        </button>
      ) : (
        <button onClick={() => onStartEdit(t)} className="text-slate-300 hover:text-brand-500" title="Edit">
          <Icon name="pencil" className="w-4 h-4" />
        </button>
      )}
      <button onClick={() => onDelete(t.id)} className="text-slate-300 hover:text-red-500" title="Delete">
        <Icon name="trash" className="w-4 h-4" />
      </button>
    </div>
  </div>
);
