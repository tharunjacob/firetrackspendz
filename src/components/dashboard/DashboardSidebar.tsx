import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Transaction, TransactionType, FilterState, Currency, DashboardTab } from '@/types';
import { TAB_GROUPS, TAB_DISPLAY_NAMES } from '@/types';
import { CURRENCIES } from '@/utils/constants';
import { Icon } from '@/components/common/Icons';
import { useAuth } from '@/contexts/AuthContext';
import { useUI } from '@/contexts/UIContext';

// ─── Multi‑Select Chip Component ────────────────────────────
const MultiSelect = ({ label, options, selected, onChange }: {
  label: string; options: string[]; selected: string[]; onChange: (s: string[]) => void;
}) => {
  const toggle = (o: string) =>
    selected.includes(o) ? onChange(selected.filter(i => i !== o)) : onChange([...selected, o]);

  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">{label}</h4>
      <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
        {options.map(o => (
          <button key={o} onClick={() => toggle(o)}
            className={`focus-ring px-3 py-1 text-xs font-medium rounded-full transition-all border ${
              selected.includes(o)
                ? 'bg-brand-500 border-brand-600 text-white'
                : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600'
            }`}
          >{o}</button>
        ))}
      </div>
    </div>
  );
};

interface SidebarProps {
  transactions: Transaction[];
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onClear?: () => void;
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
}

export const DashboardSidebar = ({
  transactions, filters, setFilters, currency, setCurrency,
  isOpen, setIsOpen, onClear, activeTab, setActiveTab,
}: SidebarProps) => {
  const { plan, userId, setIsAuthOpen } = useAuth();
  const { setIsFeedbackOpen } = useUI();
  const showReportCardNotice = !!userId && (plan === 'pro' || plan === 'enterprise');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const uniqueValues = useMemo(() => {
    const projects = [...new Set(transactions.map(t => t.project).filter((p): p is string => !!p && typeof p === 'string' && p.trim() !== ''))].sort();
    return {
      owners: [...new Set(transactions.map(t => t.owner))],
      types: ['Income', 'Expense', 'Transfer'] as TransactionType[],
      categories: [...new Set(transactions.map(t => t.category))].sort(),
      hasProjects: projects.length > 0,
      projects,
    };
  }, [transactions]);

  const resetFilters = () => {
    setFilters({
      owners: uniqueValues.owners,
      types: ['Income', 'Expense', 'Transfer'],
      excludedCategories: [],
      excludedProjects: [],
    });
  };

  const activeFilterCount = [
    filters.owners.length < uniqueValues.owners.length,
    filters.types.length < 3,
    filters.excludedCategories.length > 0,
    filters.excludedProjects.length > 0,
  ].filter(Boolean).length;

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 bg-black/50 z-30 lg:hidden transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsOpen(false)}
      />

      <aside className={`fixed top-0 left-0 w-64 h-full bg-white dark:bg-slate-800 shadow-xl z-40 transform transition-transform duration-300 ease-in-out lg:relative lg:w-64 lg:h-full lg:shadow-none lg:transform-none lg:shrink-0 flex flex-col border-r border-slate-200 dark:border-slate-700 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>

        {/* Mobile header */}
        <div className="lg:hidden flex justify-between items-center px-4 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <span className="font-bold text-slate-800 dark:text-slate-100">Navigation</span>
          <button onClick={() => setIsOpen(false)} className="focus-ring rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100">
            <Icon name="close" className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable nav + filters */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>

          {/* Navigation groups */}
          <nav className="px-2 pt-3 pb-1">
            {TAB_GROUPS.map((group, gi) => (
              <div key={group.label}>
                {gi > 0 && <div className="my-3 mx-1 border-t border-slate-200 dark:border-slate-700" />}
                <div className="flex items-center gap-2 px-3 mb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                </div>
                {group.tabs.map(tab => {
                  const t = tab as DashboardTab;
                  const isActive = activeTab === t;
                  return (
                    <button
                      key={t}
                      onClick={() => { setActiveTab(t); setIsOpen(false); }}
                      className={`focus-ring w-full text-left px-3 py-2 text-sm rounded-lg transition-colors mb-0.5 ${
                        isActive
                          ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 font-semibold border-l-2 border-brand-500'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                      }`}
                    >
                      {TAB_DISPLAY_NAMES[t] ?? t}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Divider */}
          <div className="border-t border-slate-200 dark:border-slate-700 mx-3" />

          {/* Filters accordion */}
          <div className="px-2 py-2">
            <button
              onClick={() => setFiltersOpen(o => !o)}
              className="focus-ring w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-lg transition-colors"
            >
              <span className="flex items-center gap-2">
                <Icon name="filter" className="w-4 h-4 text-slate-500 shrink-0" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="min-w-[18px] h-[18px] bg-brand-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1">
                    {activeFilterCount}
                  </span>
                )}
              </span>
              <Icon
                name="chevronDown"
                className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${filtersOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {filtersOpen && (
              <div className="space-y-3 pt-3 px-1 pb-2">
                {/* Currency */}
                <div className="p-3 bg-brand-50 dark:bg-brand-900/20 rounded-lg border border-brand-100 dark:border-brand-800">
                  <label htmlFor="currency-select" className="block text-xs font-bold text-brand-800 dark:text-brand-300 mb-1.5">Currency</label>
                  <select id="currency-select" value={currency}
                    onChange={e => setCurrency(e.target.value as Currency)}
                    className="focus-ring w-full px-2.5 py-1.5 bg-white dark:bg-slate-700 border border-brand-200 dark:border-brand-700 rounded-lg text-sm focus:border-brand-500 text-slate-800 dark:text-slate-100 font-medium outline-none"
                  >
                    {(Object.keys(CURRENCIES) as Currency[]).map(c => (
                      <option key={c} value={c}>{c} ({CURRENCIES[c].symbol})</option>
                    ))}
                  </select>
                </div>

                {/* Include filters */}
                <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-100 dark:border-slate-700">
                  <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Include</h4>
                  <div className="space-y-3">
                    <MultiSelect label="Entities" options={uniqueValues.owners}
                      selected={filters.owners} onChange={owners => setFilters(f => ({ ...f, owners }))} />
                    <MultiSelect label="Types" options={uniqueValues.types}
                      selected={filters.types} onChange={types => setFilters(f => ({ ...f, types: types as TransactionType[] }))} />
                  </div>
                </div>

                {/* Exclude filters */}
                <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-100 dark:border-slate-700">
                  <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Exclude</h4>
                  <div className="space-y-3">
                    <MultiSelect label="Categories" options={uniqueValues.categories}
                      selected={filters.excludedCategories}
                      onChange={cats => setFilters(f => ({ ...f, excludedCategories: cats }))} />
                    {uniqueValues.hasProjects && (
                      <MultiSelect label="Projects" options={uniqueValues.projects}
                        selected={filters.excludedProjects}
                        onChange={projs => setFilters(f => ({ ...f, excludedProjects: projs }))} />
                    )}
                  </div>
                </div>

                <button onClick={resetFilters}
                  className="focus-ring w-full text-center text-sm py-2 px-4 rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 transition shadow-sm font-medium">
                  Reset Filters
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Monthly report card notice — Pro/Enterprise only */}
        {showReportCardNotice && (
          <div className="mx-3 mb-2 p-3 bg-brand-50 dark:bg-brand-900/20 rounded-lg border border-brand-100 dark:border-brand-800 flex items-start gap-2">
            <Icon name="chart" className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" />
            <p className="text-xs text-brand-700 dark:text-brand-300 leading-snug">
              Monthly report cards are sent on the 1st of each month.
            </p>
          </div>
        )}

        {/* Bottom actions */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 space-y-1 shrink-0">
          {userId ? (
            <Link
              to="/settings"
              className="focus-ring flex items-center gap-2 px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
            >
              <Icon name="cog" className="w-4 h-4" />
              Settings
            </Link>
          ) : (
            <button
              onClick={() => setIsAuthOpen(true)}
              className="focus-ring w-full text-left flex items-center gap-2 px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
            >
              <Icon name="cog" className="w-4 h-4" />
              Settings
            </button>
          )}
          <button
            onClick={() => { setIsFeedbackOpen(true); setIsOpen(false); }}
            className="focus-ring w-full text-left flex items-center gap-2 px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
          >
            <Icon name="mail" className="w-4 h-4" />
            Send Feedback
          </button>
          {onClear && transactions.length > 0 && (
            <button onClick={onClear}
              className="focus-ring w-full text-left flex items-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition font-medium">
              <Icon name="trash" className="w-4 h-4" />
              Clear All Data
            </button>
          )}
          <button onClick={() => setIsOpen(false)}
            className="w-full text-center text-xs py-2 text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition lg:hidden">
            ← Back to Dashboard
          </button>
        </div>
      </aside>
    </>
  );
};
