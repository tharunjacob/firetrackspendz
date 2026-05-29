import { useMemo, useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import type { FamilyMember } from '@/types';
import { STORAGE_KEYS } from '@/config/storage';
import { logEvent, EVENTS } from '@/services/logger';
import { TAB_DISPLAY_NAMES, type FilterState, type TransactionType } from '@/types';
import { Icon } from '@/components/common/Icons';
import { DashboardSidebar } from './DashboardSidebar';
import { SummaryView } from './views/SummaryView';
import { YearlyView } from './views/YearlyView';
import { MonthlyView } from './views/MonthlyView';
import { CategoriesView } from './views/CategoriesView';
import { TrendsView } from './views/TrendsView';
import { CompareView } from './views/CompareView';
import { DataView } from './views/data';
import { FireView } from './views/fire';
import { NetWorthView } from './views/NetWorthView';
import { BudgetsView } from './views/BudgetsView';
import { AIAdvisorView } from './views/AIAdvisorView';
import { GoalsView } from './views/GoalsView';
import { RecurringView } from './views/RecurringView';
import { WrappedView } from './views/wrapped';
import { DebtPayoffView } from './views/DebtPayoffView';
import { FileUploader } from '@/components/upload/FileUploader';
import { OnboardingGuide } from './OnboardingGuide';
import { PaywallBanner } from './PaywallBanner';
import { FilterPanel } from './FilterPanel';
import { MetricCards } from './MetricCards';
import { BottomTabBar } from './BottomTabBar';

export const DashboardShell = () => {
  const {
    transactions, allTransactionsCount, isAnonymousPreview, loadError, refreshData,
    activeTab, setActiveTab, currency, setCurrency,
    processFiles, isProcessing, processingProgress, clearAllData,
    lastImportHeaders, clearLastImportHeaders, showToast,
    plan, userId,
    isDemoMode, loadDemoData, clearDemoData,
  } = useApp();

  const devPlan = import.meta.env.DEV
    ? new URLSearchParams(window.location.search).get('dev_plan')
    : null;

  const [uploadMemberOverride, setUploadMemberOverride] = useState('');
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.FAMILY_MEMBERS);
      if (raw) setFamilyMembers(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const processFilesForMember = useCallback(
    (jobs: Parameters<typeof processFiles>[0]) =>
      processFiles(jobs, uploadMemberOverride || undefined),
    [processFiles, uploadMemberOverride],
  );

  // Confirmation prompt fires at most once per browser session
  const importConfirmShownRef = useRef(false);
  const showImportConfirmBanner =
    lastImportHeaders !== null &&
    transactions.length >= 5 &&
    !importConfirmShownRef.current;

  const handleImportConfirmYes = async () => {
    const headers = lastImportHeaders; // capture before state clears
    importConfirmShownRef.current = true;
    clearLastImportHeaders();
    if (!headers) return;
    try {
      const { confirmFormatSuccess } = await import('@/services/formatLibrary');
      await confirmFormatSuccess(headers);
    } catch { /* silent */ }
    showToast('Thanks! You helped other users with the same bank format.', 'success', 4000);
  };

  const handleImportConfirmNo = async () => {
    const headers = lastImportHeaders; // capture before state clears
    importConfirmShownRef.current = true;
    clearLastImportHeaders();
    if (!headers) return;
    try {
      const { reportFormatFailure } = await import('@/services/formatLibrary');
      await reportFormatFailure(headers);
    } catch { /* silent */ }
    showToast("We've flagged this for review. You can re-upload after correcting the column mapping.", 'info', 6000);
  };

  const mimicEmail = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const email = params.get('mimic_email');
    return email ? decodeURIComponent(email) : null;
  }, []);

  // Post-upgrade confirmation. PricingPage redirects to
  // /dashboard?payment=success&plan=<tier> after a successful charge; celebrate
  // here and strip the params so a refresh doesn't re-trigger the toast.
  const paymentConfirmShownRef = useRef(false);
  useEffect(() => {
    if (paymentConfirmShownRef.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') !== 'success') return;
    paymentConfirmShownRef.current = true;

    const plan = params.get('plan');
    const message =
      plan === 'enterprise'
        ? 'Welcome to Enterprise! Your subscription is active — family accounts and advanced features are unlocked.'
        : 'Welcome to Pro! Your subscription is active.';
    showToast(message, 'success', 6000);

    params.delete('payment');
    params.delete('plan');
    const query = params.toString();
    const cleanUrl = window.location.pathname + (query ? `?${query}` : '') + window.location.hash;
    window.history.replaceState({}, '', cleanUrl);
  }, [showToast]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const uploaderRef = useRef<HTMLDivElement>(null);

  const tabStartRef = useRef<{ tab: string; ts: number }>({ tab: activeTab, ts: Date.now() });
  useEffect(() => {
    const prev = tabStartRef.current;
    if (prev.tab !== activeTab) {
      const durationSec = Math.round((Date.now() - prev.ts) / 1000);
      logEvent(EVENTS.DASHBOARD_TAB_TIME, { tab: prev.tab, durationSec });
      logEvent(EVENTS.DASHBOARD_TAB_SWITCHED, { from: prev.tab, to: activeTab });
      tabStartRef.current = { tab: activeTab, ts: Date.now() };
    }
  }, [activeTab]);

  const [filters, setFilters] = useState<FilterState>(() => ({
    owners: [...new Set(transactions.map(t => t.owner))],
    types: ['Income', 'Expense', 'Transfer'],
    excludedCategories: [],
    excludedProjects: [],
  }));

  const knownOwnersRef = useRef<Set<string>>(new Set(transactions.map(t => t.owner)));
  useEffect(() => {
    const currentOwners = new Set(transactions.map(t => t.owner));
    const newOwners: string[] = [];
    currentOwners.forEach(owner => {
      if (!knownOwnersRef.current.has(owner)) {
        newOwners.push(owner);
        knownOwnersRef.current.add(owner);
      }
    });
    if (newOwners.length > 0) {
      setFilters(prev => ({ ...prev, owners: [...prev.owners, ...newOwners] }));
    }
  }, [transactions]);

  const filteredData = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];
    return transactions.filter(t =>
      filters.owners.includes(t.owner) &&
      filters.types.includes(t.type) &&
      !filters.excludedCategories.includes(t.category) &&
      !filters.excludedProjects.includes(t.project || '')
    );
  }, [transactions, filters]);

  const ytdStats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const getYearData = (year: number) => filteredData.filter(t => {
      try { return new Date(t.date + 'T00:00:00').getFullYear() === year; }
      catch { return false; }
    });
    let ytd = getYearData(currentYear);
    let displayYear = currentYear;
    if (ytd.length === 0 && filteredData.length > 0) {
      const years = filteredData.map(t => {
        try { return new Date(t.date + 'T00:00:00').getFullYear(); }
        catch { return 0; }
      }).filter(y => y > 0);
      const latestYear = Math.max(...years);
      if (latestYear !== currentYear) {
        ytd = getYearData(latestYear);
        displayYear = latestYear;
      }
    }
    let totalIncome = 0, totalExpenses = 0;
    ytd.forEach(t => {
      if (t.type === 'Income') totalIncome += t.amount;
      else if (t.type === 'Expense') totalExpenses += t.amount;
    });
    return { totalIncome, totalExpenses, netSavings: totalIncome - totalExpenses, displayYear, isCurrentYear: displayYear === currentYear };
  }, [filteredData]);

  useLayoutEffect(() => {
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
  }, [activeTab]);

  // Ref-based scroll within the dashboard scroll container — avoids the page
  // hijacking that element.scrollIntoView() can cause on the whole window.
  const scrollToUploader = useCallback(() => {
    const container = scrollContainerRef.current;
    const target = uploaderRef.current;
    if (!container || !target) return;
    const top = target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
    container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }, []);

  const uniqueValues = useMemo(() => {
    const projects = [...new Set(transactions.map(t => t.project).filter((p): p is string => !!p && p.trim() !== ''))].sort();
    return {
      owners: [...new Set(transactions.map(t => t.owner))],
      types: ['Income', 'Expense', 'Transfer'] as TransactionType[],
      categories: [...new Set(transactions.map(t => t.category))].sort(),
      projects,
    };
  }, [transactions]);

  const resetFilters = useCallback(() => {
    setFilters({
      owners: uniqueValues.owners,
      types: ['Income', 'Expense', 'Transfer'],
      excludedCategories: [],
      excludedProjects: [],
    });
  }, [uniqueValues.owners]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.owners.length < uniqueValues.owners.length) count++;
    if (filters.types.length < 3) count++;
    if (filters.excludedCategories.length > 0) count++;
    if (filters.excludedProjects.length > 0) count++;
    return count;
  }, [filters, uniqueValues]);

  const renderView = () => {
    switch (activeTab) {
      case 'Summary': return <SummaryView data={filteredData} />;
      case 'FIRE Calculator': return <FireView data={filteredData} />;
      case 'Net Worth': return <NetWorthView />;
      case 'Goals': return <GoalsView />;
      case 'Yearly Analysis': return <YearlyView data={filteredData} />;
      case 'Monthly Analysis': return <MonthlyView data={filteredData} />;
      case 'Categories': return <CategoriesView data={filteredData} />;
      case 'Trends': return <TrendsView data={filteredData} />;
      case 'Compare': return <CompareView data={filteredData} />;
      case 'Recurring': return <RecurringView />;
      case 'Budgets': return <BudgetsView />;
      case 'Data': return <DataView />;
      case 'Debt Payoff': return <DebtPayoffView />;
      case 'AI Advisor': return <AIAdvisorView />;
      case 'Year Review': return <WrappedView />;
      default: return <SummaryView data={filteredData} />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden relative">
      {import.meta.env.DEV && devPlan && (
        <div className="flex-shrink-0 bg-brand-500 text-white px-4 py-1 text-xs font-bold text-center">
          DEV MODE — Plan: {devPlan} | <a href="?dev_plan=free" className="underline">free</a> · <a href="?dev_plan=pro" className="underline">pro</a> · <a href="?dev_plan=enterprise" className="underline">enterprise</a>
        </div>
      )}
      {mimicEmail && (
        <div className="flex-shrink-0 bg-amber-400 text-amber-900 px-4 py-2 text-xs sm:text-sm font-bold text-center flex items-center justify-center gap-2 z-50">
          <Icon name="eye" className="w-4 h-4 shrink-0" />
          <span>MIMIC MODE – Viewing as <strong>{mimicEmail}</strong> (read-only)</span>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="hidden lg:flex lg:flex-col lg:h-full">
          <DashboardSidebar
            transactions={transactions}
            filters={filters}
            setFilters={setFilters}
            currency={currency}
            setCurrency={setCurrency}
            isOpen={sidebarOpen}
            setIsOpen={setSidebarOpen}
            onClear={clearAllData}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        </div>

        <main className="flex-1 flex flex-col h-full overflow-hidden relative w-full">
          <div className="lg:hidden flex items-center justify-between px-4 py-2.5 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shrink-0 min-h-[52px]">
            <span className="font-bold text-slate-800 dark:text-slate-100 text-base">TrackSpendZ</span>
            {transactions.length > 0 && (
              <button
                onClick={() => setFiltersSheetOpen(true)}
                className="focus-ring relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 min-h-[44px] min-w-[44px]"
              >
                <Icon name="filter" className="w-4 h-4" />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 bg-brand-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            )}
          </div>

          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-7xl mx-auto pb-24 lg:pb-4">
              {isDemoMode && (
                <div className="mb-4 p-3 rounded-lg bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-medium text-brand-700 dark:text-brand-300">
                    <Icon name="eye" className="w-4 h-4 shrink-0" />
                    Sample data — this is a synthetic example, not your own data.
                  </span>
                  <button
                    type="button"
                    onClick={clearDemoData}
                    className="focus-ring shrink-0 text-sm font-semibold text-brand-700 dark:text-brand-300 border border-brand-300 dark:border-brand-700 px-3 py-1.5 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              )}
              {filteredData.length > 0 && (
                <MetricCards
                  totalIncome={ytdStats.totalIncome}
                  totalExpenses={ytdStats.totalExpenses}
                  netSavings={ytdStats.netSavings}
                  currency={currency}
                  displayYear={ytdStats.displayYear}
                  isCurrentYear={ytdStats.isCurrentYear}
                />
              )}

              {filteredData.length > 0 && (
                <div className="lg:hidden mb-3 flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">{TAB_DISPLAY_NAMES[activeTab] ?? activeTab}</span>
                </div>
              )}


              {/* Free-tier 500 cap: anonymous (sign up) OR signed-in free (upgrade).
                  PaywallBanner self-hides when nothing is hidden, so a free user
                  at/under 500 sees nothing. */}
              {(isAnonymousPreview || (!!userId && plan === 'free')) && filteredData.length > 0 && (
                <PaywallBanner
                  totalCount={allTransactionsCount}
                  visibleCount={filteredData.length}
                  transactions={filteredData}
                  variant={isAnonymousPreview ? 'anonymous' : 'free'}
                />
              )}
              {loadError && transactions.length === 0 && (
                <div className="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-red-800 dark:text-red-300">Failed to load your data</p>
                    <p className="text-sm text-red-700 dark:text-red-400 mt-0.5">{loadError}. Try refreshing — if this keeps happening, check your connection or sign out and back in.</p>
                  </div>
                  <button onClick={refreshData} className="px-3 py-1.5 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 shrink-0">
                    Retry
                  </button>
                </div>
              )}
              {showImportConfirmBanner && (
                <div className="mb-4 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                    Import looks good? Help other users with the same bank format by confirming.
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleImportConfirmYes}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                      Yes, looks correct
                    </button>
                    <button
                      onClick={handleImportConfirmNo}
                      className="px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                    >
                      No, something looks off
                    </button>
                  </div>
                </div>
              )}

              {transactions.length === 0 ? (
                <div className="py-8 sm:py-12" ref={uploaderRef}>
                  {plan === 'enterprise' && familyMembers.filter(m => m.status !== 'removed').length > 1 && (
                    <div className="flex items-center gap-3 max-w-4xl mx-auto px-4 mb-4">
                      <label className="text-sm font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        Uploading for:
                      </label>
                      <select
                        value={uploadMemberOverride}
                        onChange={e => setUploadMemberOverride(e.target.value)}
                        className="input-field text-sm"
                      >
                        {familyMembers.filter(m => m.status !== 'removed').map(m => (
                          <option key={m.id} value={m.name}>
                            {m.status === 'owner' ? `${m.name} (you)` : m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <FileUploader onStartAnalysis={processFilesForMember} isProcessing={isProcessing} progress={processingProgress} />

                  {/* Activation: explore the product with realistic sample data
                      (in-memory only — nothing is written to storage). */}
                  <div className="max-w-4xl mx-auto px-4 mt-5 flex flex-col items-center gap-2">
                    <div className="flex items-center gap-3 w-full text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                      <span>or</span>
                      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                    </div>
                    <button
                      type="button"
                      onClick={loadDemoData}
                      className="btn-secondary inline-flex items-center gap-2"
                    >
                      <Icon name="eye" className="w-4 h-4" />
                      See it with sample data
                    </button>
                    <p className="text-footnote text-center">No file needed — explore every view with a synthetic example account.</p>
                  </div>
                </div>
              ) : (
                <div className="fade-in min-h-[500px]">
                  {renderView()}
                </div>
              )}
              {!isDemoMode && (
                <div className="mt-8">
                  <OnboardingGuide
                    hasTransactions={transactions.length > 0}
                    hasAssets={false}
                    onStartUpload={scrollToUploader}
                  />
                </div>
              )}
            </div>
          </div>

          {transactions.length > 0 && (
            <BottomTabBar
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              moreSheetOpen={moreSheetOpen}
              setMoreSheetOpen={setMoreSheetOpen}
            />
          )}
        </main>
      </div>

      <FilterPanel
        open={filtersSheetOpen}
        onClose={() => setFiltersSheetOpen(false)}
        filters={filters}
        setFilters={setFilters}
        uniqueValues={uniqueValues}
        activeFilterCount={activeFilterCount}
        currency={currency}
        setCurrency={setCurrency}
        onReset={resetFilters}
        onClearAll={clearAllData}
      />
    </div>
  );
};
