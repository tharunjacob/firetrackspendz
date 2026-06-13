import type { Transaction, UserProfile, Currency, DashboardTab, FileJob, SubscriptionPlan } from '@/types';
import { useAuth } from './AuthContext';
import { useData, type ProcessFilesResult } from './DataContext';
import { useUI } from './UIContext';

// ============================================================
// App Context — COMPATIBILITY WRAPPER
// ============================================================
//
// PURPOSE:
// This file exists for backward compatibility. It combines
// AuthContext, DataContext, and UIContext into a single `useApp()`
// hook so that existing components don't need to change their imports.
//
// FOR NEW CODE:
// Prefer importing from the specific context you need:
//   import { useAuth } from '@/contexts/AuthContext';  // auth only
//   import { useData } from '@/contexts/DataContext';  // transactions only
//   import { useUI } from '@/contexts/UIContext';      // UI state only
//
// WHY THIS MATTERS:
// If you only need the user's plan, importing useAuth means your
// component won't re-render when transactions change. This is a
// free performance win.
//
// MIGRATION PATH:
// Over time, components should migrate from useApp() to the
// specific hooks. This file can be removed once all consumers
// have migrated.
// ============================================================

interface AppState {
  // Auth (from AuthContext)
  userId: string | null;
  userEmail: string | null;
  profile: UserProfile | null;
  plan: SubscriptionPlan;
  isAuthOpen: boolean;
  setIsAuthOpen: (open: boolean) => void;
  user: { id: string; email: string } | null;
  logout: () => Promise<void>;
  isMimicMode: boolean;
  isAuthReady: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;

  // Data (from DataContext)
  transactions: Transaction[];
  allTransactionsCount: number;
  isLoading: boolean;
  isProcessing: boolean;
  processingProgress: number;
  isAnonymousPreview: boolean;
  loadError: string | null;
  lastImportHeaders: string[] | null;
  isDemoMode: boolean;
  processFiles: (jobs: FileJob[], ownerOverride?: string) => Promise<ProcessFilesResult>;
  cancelProcessing: () => void;
  updateTransactions: (updated: Transaction[]) => Promise<void>;
  deleteTransactions: (ids: string[]) => Promise<void>;
  clearAllData: () => Promise<void>;
  refreshData: () => Promise<void>;
  clearLastImportHeaders: () => void;
  loadDemoData: () => void;
  clearDemoData: () => void;

  // UI (from UIContext)
  currency: Currency;
  setCurrency: (c: Currency) => void;
  activeTab: DashboardTab;
  setActiveTab: (t: DashboardTab) => void;
  toast: { message: string; visible: boolean; type: 'success' | 'error' | 'info' };
  showToast: (message: string, type?: 'success' | 'error' | 'info', duration?: number) => void;
  hideToast: () => void;
  isFeedbackOpen: boolean;
  setIsFeedbackOpen: (open: boolean) => void;
}

/**
 * Combined hook for backward compatibility.
 * For new code, prefer useAuth(), useData(), or useUI().
 */
export const useApp = (): AppState => {
  const auth = useAuth();
  const data = useData();
  const ui = useUI();

  return {
    // Auth
    userId: auth.userId,
    userEmail: auth.userEmail,
    profile: auth.profile,
    plan: data.isDemoMode ? 'enterprise' : auth.plan,
    isAuthOpen: auth.isAuthOpen,
    setIsAuthOpen: auth.setIsAuthOpen,
    user: auth.user,
    logout: auth.logout,
    isMimicMode: auth.isMimicMode,
    isAuthReady: auth.isAuthReady,
    isAdmin: auth.isAdmin,
    refreshProfile: auth.refreshProfile,

    // Data
    transactions: data.transactions,
    allTransactionsCount: data.allTransactionsCount,
    isLoading: data.isLoading,
    isProcessing: data.isProcessing,
    processingProgress: data.processingProgress,
    isAnonymousPreview: data.isAnonymousPreview,
    loadError: data.loadError,
    lastImportHeaders: data.lastImportHeaders,
    isDemoMode: data.isDemoMode,
    processFiles: data.processFiles,
    cancelProcessing: data.cancelProcessing,
    updateTransactions: data.updateTransactions,
    deleteTransactions: data.deleteTransactions,
    clearAllData: data.clearAllData,
    refreshData: data.refreshData,
    clearLastImportHeaders: data.clearLastImportHeaders,
    loadDemoData: data.loadDemoData,
    clearDemoData: data.clearDemoData,

    // UI
    currency: ui.currency,
    setCurrency: ui.setCurrency,
    activeTab: ui.activeTab,
    setActiveTab: ui.setActiveTab,
    toast: ui.toast,
    showToast: ui.showToast,
    hideToast: ui.hideToast,
    isFeedbackOpen: ui.isFeedbackOpen,
    setIsFeedbackOpen: ui.setIsFeedbackOpen,
  };
};

// Re-export individual hooks for gradual migration
export { useAuth } from './AuthContext';
export { useData } from './DataContext';
export { useUI } from './UIContext';
export { useTheme } from './UIContext';
