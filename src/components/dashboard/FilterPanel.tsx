import { Icon } from '@/components/common/Icons';
import { CURRENCIES } from '@/utils/constants';
import type { FilterState, TransactionType, Currency } from '@/types';

interface UniqueValues {
  owners: string[];
  types: TransactionType[];
  categories: string[];
  projects: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  uniqueValues: UniqueValues;
  activeFilterCount: number;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  onReset: () => void;
  onClearAll?: () => void;
}

export const FilterPanel = ({
  open, onClose, filters, setFilters, uniqueValues, activeFilterCount,
  currency, setCurrency, onReset, onClearAll,
}: Props) => {
  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-50 lg:hidden"
        onClick={onClose}
      />
      <div className="fixed bottom-0 inset-x-0 z-50 bg-white dark:bg-slate-800 rounded-t-2xl lg:hidden max-h-[88vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Filters &amp; Settings</h3>
            {activeFilterCount > 0 && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                {activeFilterCount} active
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <Icon name="close" className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        <div className="p-4 space-y-5 pb-10">
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
            <label className="block text-sm font-bold text-blue-800 mb-2">Currency</label>
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value as Currency)}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-blue-200 dark:border-blue-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 font-medium outline-none min-h-[44px]"
            >
              {(Object.keys(CURRENCIES) as Currency[]).map(c => (
                <option key={c} value={c}>{c} ({CURRENCIES[c].symbol})</option>
              ))}
            </select>
          </div>

          {uniqueValues.owners.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-600 mb-2">Include Entities</h4>
              <div className="flex flex-wrap gap-2">
                {uniqueValues.owners.map(o => (
                  <button
                    key={o}
                    onClick={() => {
                      const next = filters.owners.includes(o)
                        ? filters.owners.filter(i => i !== o)
                        : [...filters.owners, o];
                      setFilters(f => ({ ...f, owners: next }));
                    }}
                    className={`px-4 py-2 text-sm font-medium rounded-full border min-h-[44px] transition-all ${
                      filters.owners.includes(o)
                        ? 'bg-blue-500 border-blue-600 text-white'
                        : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'
                    }`}
                  >{o}</button>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold text-slate-600 mb-2">Include Types</h4>
            <div className="flex flex-wrap gap-2">
              {uniqueValues.types.map(o => (
                <button
                  key={o}
                  onClick={() => {
                    const next = filters.types.includes(o)
                      ? filters.types.filter(i => i !== o)
                      : [...filters.types, o];
                    setFilters(f => ({ ...f, types: next as TransactionType[] }));
                  }}
                  className={`px-4 py-2 text-sm font-medium rounded-full border min-h-[44px] transition-all ${
                    filters.types.includes(o)
                      ? 'bg-blue-500 border-blue-600 text-white'
                      : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'
                  }`}
                >{o}</button>
              ))}
            </div>
          </div>

          {uniqueValues.categories.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-600 mb-2">Exclude Categories</h4>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                {uniqueValues.categories.map(o => (
                  <button
                    key={o}
                    onClick={() => {
                      const next = filters.excludedCategories.includes(o)
                        ? filters.excludedCategories.filter(i => i !== o)
                        : [...filters.excludedCategories, o];
                      setFilters(f => ({ ...f, excludedCategories: next }));
                    }}
                    className={`px-3 py-2 text-xs font-medium rounded-full border min-h-[36px] transition-all ${
                      filters.excludedCategories.includes(o)
                        ? 'bg-red-500 border-red-600 text-white'
                        : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'
                    }`}
                  >{o}</button>
                ))}
              </div>
            </div>
          )}

          {uniqueValues.projects.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-600 mb-2">Exclude Projects</h4>
              <div className="flex flex-wrap gap-2">
                {uniqueValues.projects.map(o => (
                  <button
                    key={o}
                    onClick={() => {
                      const next = filters.excludedProjects.includes(o)
                        ? filters.excludedProjects.filter(i => i !== o)
                        : [...filters.excludedProjects, o];
                      setFilters(f => ({ ...f, excludedProjects: next }));
                    }}
                    className={`px-3 py-2 text-xs font-medium rounded-full border min-h-[36px] transition-all ${
                      filters.excludedProjects.includes(o)
                        ? 'bg-red-500 border-red-600 text-white'
                        : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'
                    }`}
                  >{o}</button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2 pt-1">
            <button
              onClick={onReset}
              className="w-full py-3 rounded-xl bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium min-h-[44px]"
            >
              Reset Filters
            </button>
            {onClearAll && (
              <button
                onClick={() => { onClearAll(); onClose(); }}
                className="w-full py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium min-h-[44px] flex items-center justify-center gap-2"
              >
                <Icon name="trash" className="w-4 h-4" />
                Clear All Data
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
