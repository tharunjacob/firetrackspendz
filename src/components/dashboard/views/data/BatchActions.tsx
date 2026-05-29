import { useEffect, useRef } from 'react';
import { Icon } from '@/components/common/Icons';

interface Props {
  selectedCount: number;
  allCategories: string[];
  batchOpen: boolean;
  onToggleBatch: () => void;
  onCloseBatch: () => void;
  onDeleteSelected: () => void;
  onCategorize: (category: string) => void;
}

export const BatchActions = ({
  selectedCount, allCategories, batchOpen,
  onToggleBatch, onCloseBatch, onDeleteSelected, onCategorize,
}: Props) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!batchOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onCloseBatch();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [batchOpen, onCloseBatch]);

  if (selectedCount === 0) return null;

  return (
    <>
      <button onClick={onDeleteSelected} className="btn-danger text-sm px-4 py-2">
        <Icon name="trash" className="w-4 h-4 inline mr-1" /> Delete ({selectedCount})
      </button>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={onToggleBatch}
          className="btn-secondary text-sm px-4 py-2"
        >
          Categorize as...
        </button>
        {batchOpen && (
          <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-md min-w-[180px] max-h-64 overflow-y-auto">
            {allCategories.map(c => (
              <button
                key={c}
                onClick={() => onCategorize(c)}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-brand-50 dark:hover:bg-slate-700 hover:text-brand-700 dark:hover:text-brand-400 text-slate-600 dark:text-slate-300"
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
};
