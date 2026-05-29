import { ITEMS_PER_PAGE } from './types';

interface Props {
  page: number;
  totalPages: number;
  totalFiltered: number;
  onPageChange: (next: number) => void;
}

export const Pagination = ({ page, totalPages, totalFiltered, onPageChange }: Props) => (
  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700 flex-wrap gap-2">
    <span className="text-xs text-slate-500 dark:text-slate-400">
      {totalFiltered === 0
        ? 'No transactions'
        : `Showing ${(page - 1) * ITEMS_PER_PAGE + 1}–${Math.min(page * ITEMS_PER_PAGE, totalFiltered)} of ${totalFiltered} transactions`}
    </span>
    {totalPages > 1 && (
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← Prev
        </button>
        <span className="text-xs text-slate-600 dark:text-slate-400">Page {page} of {totalPages}</span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next →
        </button>
      </div>
    )}
  </div>
);
