import { useState, useEffect, useRef, useMemo } from 'react';
import type { Transaction } from '@/types';
import { TYPE_CATEGORIES, DEFAULT_CATEGORIES } from '@/utils/constants';
import { Icon } from '@/components/common/Icons';

interface Props {
  // Inline variant props (compatibility with transaction table/card)
  transaction?: Transaction;
  isOpen?: boolean;
  onOpen?: () => void;
  onClose?: () => void;

  // Field variant props (compatibility with full forms)
  value?: string;
  type?: 'Income' | 'Expense' | 'Transfer';
  placeholder?: string;

  // Shared props
  allCategories: string[];
  variant?: 'inline' | 'field';
  onChange: any; // (t: Transaction, cat: string) => void OR (cat: string) => void
  openUp?: boolean;
}

export const CategoryPicker = ({
  transaction,
  isOpen: inlineIsOpen,
  onOpen: inlineOnOpen,
  onClose: inlineOnClose,
  value: fieldValue,
  type: fieldType,
  placeholder = 'Select or search category...',
  allCategories,
  variant = 'inline',
  onChange,
  openUp = false,
}: Props) => {
  // Determine variant dynamically if not explicitly specified
  const activeVariant = transaction ? 'inline' : variant;

  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = activeVariant === 'inline' ? !!inlineIsOpen : internalIsOpen;

  const setIsOpen = (open: boolean) => {
    if (activeVariant === 'inline') {
      if (open) {
        inlineOnOpen?.();
      } else {
        inlineOnClose?.();
      }
    } else {
      setInternalIsOpen(open);
    }
  };

  // Determine current category value and transaction type
  const activeValue = activeVariant === 'inline' ? (transaction?.category || '') : (fieldValue || '');
  const activeType = activeVariant === 'inline' ? (transaction?.type || 'Expense') : (fieldType || 'Expense');

  const [search, setSearch] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync search input with value when closed, clear search when opened to display all categories
  useEffect(() => {
    if (!isOpen) {
      setSearch(activeValue);
    } else {
      setSearch('');
    }
  }, [activeValue, isOpen]);

  // Click outside detection
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Group default categories for this transaction type vs other categories
  const recommendedCategories = useMemo(() => {
    const defaults = TYPE_CATEGORIES[activeType as keyof typeof TYPE_CATEGORIES] || DEFAULT_CATEGORIES;
    const isDefaultCategory = (cat: string) => DEFAULT_CATEGORIES.includes(cat);
    
    return allCategories.filter(cat => {
      if (isDefaultCategory(cat)) {
        return defaults.includes(cat);
      }
      return false; // custom ones or other default ones go into others
    });
  }, [allCategories, activeType]);

  const otherCategories = useMemo(() => {
    const defaults = TYPE_CATEGORIES[activeType as keyof typeof TYPE_CATEGORIES] || DEFAULT_CATEGORIES;
    const isDefaultCategory = (cat: string) => DEFAULT_CATEGORIES.includes(cat);
    
    return allCategories.filter(cat => {
      if (isDefaultCategory(cat)) {
        return !defaults.includes(cat);
      }
      return true; // Include custom categories here
    });
  }, [allCategories, activeType]);

  // Filter lists by search query
  const filteredRecommended = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return recommendedCategories;
    return recommendedCategories.filter(cat => cat.toLowerCase().includes(q));
  }, [recommendedCategories, search]);

  const filteredOthers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return otherCategories;
    return otherCategories.filter(cat => cat.toLowerCase().includes(q));
  }, [otherCategories, search]);

  // Build list of all active options for keyboard navigation indexing
  const allFilteredOptions = useMemo(() => {
    const options = [...filteredRecommended, ...filteredOthers];
    
    // Add custom addition option if query is not an exact match
    const q = search.toLowerCase().trim();
    const exactMatch = allCategories.some(cat => cat.toLowerCase() === q);
    if (q && !exactMatch) {
      options.push(`+ Add "${search.trim()}"`);
    }
    return options;
  }, [filteredRecommended, filteredOthers, search, allCategories]);

  // Reset keyboard selection index when dropdown state or query changes
  useEffect(() => {
    setFocusedIndex(-1);
  }, [isOpen, search]);

  const handleSelect = (category: string) => {
    let selectedCat = category;
    if (category.startsWith('+ Add "')) {
      selectedCat = search.trim();
    }

    if (activeVariant === 'inline') {
      onChange(transaction, selectedCat);
    } else {
      onChange(selectedCat);
    }
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => (prev + 1) % allFilteredOptions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => (prev - 1 + allFilteredOptions.length) % allFilteredOptions.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < allFilteredOptions.length) {
          handleSelect(allFilteredOptions[focusedIndex]);
        } else if (search.trim()) {
          const exactMatch = allCategories.some(cat => cat.toLowerCase() === search.toLowerCase().trim());
          if (!exactMatch) {
            handleSelect(`+ Add "${search.trim()}"`);
          } else {
            const match = allCategories.find(cat => cat.toLowerCase() === search.toLowerCase().trim());
            if (match) handleSelect(match);
          }
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        inputRef.current?.blur();
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  };

  const showCustomOption = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return false;
    return !allCategories.some(cat => cat.toLowerCase() === q);
  }, [search, allCategories]);

  if (activeVariant === 'inline') {
    return (
      <div className="relative inline-block text-left" ref={containerRef}>
        {isOpen ? (
          <div
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
            className={`absolute left-0 z-50 min-w-[220px] bg-white dark:bg-slate-800 border border-brand-300 dark:border-brand-700 rounded-lg shadow-xl p-1.5 animate-fade-in ${openUp ? 'bottom-full mb-1' : 'top-full mt-1'}`}
          >
            <div className="relative flex items-center mb-1.5 border-b border-slate-100 dark:border-slate-700 pb-1.5">
              <Icon name="search" className="w-3.5 h-3.5 text-slate-400 absolute left-2" />
              <input
                ref={inputRef}
                autoFocus
                type="text"
                placeholder="Search categories..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full text-xs pl-7 pr-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded outline-none focus:border-brand-400 text-slate-700 dark:text-slate-200"
              />
            </div>
            <div className="max-h-48 overflow-y-auto scrollbar-thin">
              {filteredRecommended.length > 0 && (
                <div>
                  <div className="px-2 py-0.5 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Recommended</div>
                  {filteredRecommended.map((c) => {
                    const optionIdx = allFilteredOptions.indexOf(c);
                    const isFocused = optionIdx === focusedIndex;
                    return (
                      <button
                        key={c}
                        onClick={() => handleSelect(c)}
                        className={`w-full text-left px-2 py-1 text-xs rounded transition-colors flex items-center justify-between ${
                          c === activeValue
                            ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 font-medium'
                            : isFocused
                            ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100'
                            : 'text-slate-650 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-750'
                        }`}
                      >
                        <span>{c}</span>
                        {c === activeValue && <Icon name="check" className="w-3 h-3 text-brand-600 dark:text-brand-400" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {filteredOthers.length > 0 && (
                <div className={filteredRecommended.length > 0 ? 'mt-1.5' : ''}>
                  <div className="px-2 py-0.5 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Other Categories</div>
                  {filteredOthers.map((c) => {
                    const optionIdx = allFilteredOptions.indexOf(c);
                    const isFocused = optionIdx === focusedIndex;
                    return (
                      <button
                        key={c}
                        onClick={() => handleSelect(c)}
                        className={`w-full text-left px-2 py-1 text-xs rounded transition-colors flex items-center justify-between ${
                          c === activeValue
                            ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 font-medium'
                            : isFocused
                            ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100'
                            : 'text-slate-650 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-750'
                        }`}
                      >
                        <span>{c}</span>
                        {c === activeValue && <Icon name="check" className="w-3 h-3 text-brand-600 dark:text-brand-400" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {showCustomOption && (
                <div className="border-t border-slate-100 dark:border-slate-700 mt-1 pt-1">
                  {(() => {
                    const optionStr = `+ Add "${search.trim()}"`;
                    const optionIdx = allFilteredOptions.indexOf(optionStr);
                    const isFocused = optionIdx === focusedIndex;
                    return (
                      <button
                        onClick={() => handleSelect(optionStr)}
                        className={`w-full text-left px-2 py-1 text-xs rounded font-medium text-brand-600 dark:text-brand-400 flex items-center gap-1 ${
                          isFocused ? 'bg-slate-100 dark:bg-slate-700' : 'hover:bg-slate-50 dark:hover:bg-slate-750'
                        }`}
                      >
                        <Icon name="plus" className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                        <span>Add "{search.trim()}"</span>
                      </button>
                    );
                  })()}
                </div>
              )}

              {allFilteredOptions.length === 0 && (
                <div className="px-2 py-3 text-center text-xs text-slate-400 dark:text-slate-500">No categories found</div>
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsOpen(true)}
            className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-650 dark:text-slate-300 rounded text-xs hover:bg-brand-100 dark:hover:bg-slate-600 hover:text-brand-700 dark:hover:text-brand-400 transition-colors inline-flex items-center gap-1 border border-transparent hover:border-brand-200 dark:hover:border-slate-600"
            title="Click to change category"
          >
            <span>{activeValue}</span>
            <Icon name="chevronDown" className="w-2.5 h-2.5 opacity-60" />
          </button>
        )}
      </div>
    );
  }

  // Field variant (full width input dropdown)
  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            setTimeout(() => inputRef.current?.select(), 50);
          }}
          onKeyDown={handleKeyDown}
          className="input-field text-xs py-1.5 w-full pr-8"
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none"
        >
          <Icon name="chevronDown" className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <div
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          className="absolute left-0 right-0 mt-1 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl p-1.5 animate-slide-up max-h-60 overflow-y-auto scrollbar-thin"
        >
          {filteredRecommended.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Recommended Categories</div>
              {filteredRecommended.map((c) => {
                const optionIdx = allFilteredOptions.indexOf(c);
                const isFocused = optionIdx === focusedIndex;
                return (
                  <button
                    type="button"
                    key={c}
                    onClick={() => handleSelect(c)}
                    className={`w-full text-left px-2.5 py-1.5 text-xs rounded transition-colors flex items-center justify-between ${
                      c === activeValue
                        ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 font-semibold'
                        : isFocused
                        ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100'
                        : 'text-slate-650 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750'
                    }`}
                  >
                    <span>{c}</span>
                    {c === activeValue && <Icon name="check" className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />}
                  </button>
                );
              })}
            </div>
          )}

          {filteredOthers.length > 0 && (
            <div className={filteredRecommended.length > 0 ? 'mt-2 border-t border-slate-100 dark:border-slate-700 pt-1.5' : ''}>
              <div className="px-2 py-1 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Other Categories</div>
              {filteredOthers.map((c) => {
                const optionIdx = allFilteredOptions.indexOf(c);
                const isFocused = optionIdx === focusedIndex;
                return (
                  <button
                    type="button"
                    key={c}
                    onClick={() => handleSelect(c)}
                    className={`w-full text-left px-2.5 py-1.5 text-xs rounded transition-colors flex items-center justify-between ${
                      c === activeValue
                        ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 font-semibold'
                        : isFocused
                        ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100'
                        : 'text-slate-655 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-750'
                    }`}
                  >
                    <span>{c}</span>
                    {c === activeValue && <Icon name="check" className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />}
                  </button>
                );
              })}
            </div>
          )}

          {showCustomOption && (
            <div className="border-t border-slate-100 dark:border-slate-700 mt-1.5 pt-1.5">
              {(() => {
                const optionStr = `+ Add "${search.trim()}"`;
                const optionIdx = allFilteredOptions.indexOf(optionStr);
                const isFocused = optionIdx === focusedIndex;
                return (
                  <button
                    type="button"
                    onClick={() => handleSelect(optionStr)}
                    className={`w-full text-left px-2.5 py-1.5 text-xs rounded font-medium text-brand-600 dark:text-brand-400 flex items-center gap-1.5 ${
                      isFocused ? 'bg-slate-100 dark:bg-slate-700' : 'hover:bg-slate-50 dark:hover:bg-slate-750'
                    }`}
                  >
                    <Icon name="plus" className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                    <span>Add "{search.trim()}" as custom category</span>
                  </button>
                );
              })()}
            </div>
          )}

          {allFilteredOptions.length === 0 && (
            <div className="px-2 py-4 text-center text-xs text-slate-400 dark:text-slate-500">No categories found</div>
          )}
        </div>
      )}
    </div>
  );
};
