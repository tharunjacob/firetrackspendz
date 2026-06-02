import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo, type ReactNode, type MutableRefObject } from 'react';
import type { Transaction, FileJob, SubscriptionPlan } from '@/types';
import { loadFromStorage, saveToStorage, deleteFromStorage, resetAllData } from '@/services/storage';
import { cloudSave, cloudLoad } from '@/services/cloudStorage';
import { transformData, identifyInterAccountTransfers, deduplicateTransactions } from '@/services/transformer';
import { clearStoredMappings } from '@/services/learningRules';
import { generateDemoTransactions } from '@/services/demoData';
import { logEvent, EVENTS } from '@/services/logger';
import { LIMITS } from '@/config/storage';

// ============================================================
// Data Context — Handles transaction data state ONLY
// ============================================================
//
// WHAT THIS CONTEXT MANAGES:
//   - transactions[] (the visible set)
//   - allTransactionsCount (total including hidden behind paywall)
//   - isAnonymousPreview (user uploaded without signing in)
//   - File processing (processFiles)
//   - CRUD operations (updateTransactions, deleteTransactions)
//   - Loading states (isLoading, isProcessing, processingProgress)
//
// WHAT THIS CONTEXT DOES NOT MANAGE:
//   - Who is logged in → see AuthContext
//   - UI state (toasts, tabs) → see UIContext
//
// KEY DESIGN DECISION — Anonymous Preview:
//   When no user is signed in, we still allow file upload.
//   We store ALL parsed transactions in allTransactionsRaw (memory only).
//   We show only the most recent 500 in the visible transactions[].
//   When user signs up, we promote allTransactionsRaw → cloud storage.
//
// CONSUMED BY: DashboardShell, PaywallBanner, DataView, all chart views
// ============================================================

interface DataState {
  transactions: Transaction[];
  allTransactionsCount: number;
  isLoading: boolean;
  isProcessing: boolean;
  processingProgress: number;
  isAnonymousPreview: boolean;
  /** Populated when the initial load failed. UI can use this to show a retry banner. */
  loadError: string | null;
  /** True while the in-memory sample dataset is loaded (never persisted). */
  isDemoMode: boolean;
  /**
   * Headers from the most recent non-cached Excel/CSV import.
   * Set after a community/AI/rule-based mapping succeeds so the UI can ask the
   * user to confirm the result and feed the community format library.
   * Null for PDF imports or when the cached (localStorage) mapping was used.
   */
  lastImportHeaders: string[] | null;
  processFiles: (jobs: FileJob[], ownerOverride?: string) => Promise<void>;
  updateTransactions: (updated: Transaction[]) => Promise<void>;
  deleteTransactions: (ids: string[]) => Promise<void>;
  clearAllData: () => Promise<void>;
  refreshData: () => Promise<void>;
  clearLastImportHeaders: () => void;
  /** Load the synthetic sample dataset into memory (no storage writes). */
  loadDemoData: () => void;
  /** Discard the sample dataset and return to the empty state. */
  clearDemoData: () => void;
}

/**
 * Caps the *visible* transaction set for free-plan users to the most-recent
 * FREE_PREVIEW_TRANSACTIONS (500). This is a NON-DESTRUCTIVE view limit only:
 * the full set always lives in `allTransactionsRaw` and in cloud/local storage,
 * so an already-promoted free account never loses data — it just sees the
 * newest 500 with an upgrade prompt for the rest. Pro/Enterprise see everything.
 *
 * Applies to anonymous users too: they default to plan 'free', so the same
 * predicate covers both the anon preview and the signed-in free tier.
 */
const applyPlanCap = (all: Transaction[], plan: SubscriptionPlan): Transaction[] => {
  if (plan !== 'free') return all;
  if (all.length <= LIMITS.FREE_PREVIEW_TRANSACTIONS) return all;
  return [...all]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, LIMITS.FREE_PREVIEW_TRANSACTIONS);
};

const DataContext = createContext<DataState | null>(null);

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
};

interface DataProviderProps {
  children: ReactNode;
  userId: string | null;
  /** Current subscription tier. Drives the free-tier 500 view cap (anon users are 'free'). */
  plan: SubscriptionPlan;
  isMimicMode: boolean;
  isAuthReady: boolean;
  showToast: (message: string, type?: 'success' | 'error' | 'info', duration?: number) => void;
  /**
   * Holder that AppProvider populates with `promoteAnonymousData` so that
   * AuthProvider — which sits ABOVE this provider and therefore cannot read
   * DataContext — can trigger anon→cloud promotion from its onSignIn handler.
   */
  promoteRef?: MutableRefObject<(() => Promise<void>) | null>;
}

export const DataProvider = ({ children, userId, plan, isMimicMode, isAuthReady, showToast, promoteRef }: DataProviderProps) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allTransactionsRaw, setAllTransactionsRaw] = useState<Transaction[]>([]);
  const [isAnonymousPreview, setIsAnonymousPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastImportHeaders, setLastImportHeaders] = useState<string[] | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  // Mirror for synchronous reads inside processFiles (see the upload guard below).
  const isDemoModeRef = useRef(false);
  useEffect(() => { isDemoModeRef.current = isDemoMode; }, [isDemoMode]);
  // Prevents the upload reminder toast from firing more than once per session
  const uploadReminderShownRef = useRef(false);

  // ── Anon→cloud promotion bookkeeping ──────────────────────────────────────
  // These refs mirror state / track flags WITHOUT being in the load effect's
  // dependency array. They let the load effect and promoteAnonymousData read
  // the latest values without re-running the load on every upload.
  const allRawRef = useRef<Transaction[]>([]);          // mirror of allTransactionsRaw
  const isAnonPreviewRef = useRef(false);               // mirror of isAnonymousPreview
  const promotionInFlightRef = useRef(false);           // true while a promotion is running
  const promotionDoneRef = useRef(false);               // true once promoted this session
  useEffect(() => { allRawRef.current = allTransactionsRaw; }, [allTransactionsRaw]);
  useEffect(() => { isAnonPreviewRef.current = isAnonymousPreview; }, [isAnonymousPreview]);

  // Load data on mount or when userId changes.
  // Gate on isAuthReady so storage.ts routes to cloud vs local with a settled session.
  useEffect(() => {
    if (!isAuthReady) return;

    // GUARD — do not clobber pending anonymous data.
    // When an anon user signs in, `userId` flips null→id and this effect
    // re-runs. Without this guard, loadFromStorage() routes to cloud, returns
    // [] for the brand-new account, and setAllTransactionsRaw([]) wipes the
    // in-memory upload. If we are holding anonymous-preview rows (or a
    // promotion is already running), skip the load entirely —
    // promoteAnonymousData() (invoked via onSignIn) pushes those rows to the
    // cloud and refreshes state. The guard is independent of effect-run order
    // and StrictMode double-invocation because it checks current data/flags,
    // not a null→id transition.
    if (
      userId && !isMimicMode &&
      (promotionInFlightRef.current ||
        (isAnonPreviewRef.current && allRawRef.current.length > 0))
    ) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    const checkUploadReminder = (data: Transaction[]): boolean => {
      if (data.length === 0) return false;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 28);
      const recent = data.filter(t => new Date(t.date) >= cutoff);
      // Has historical data but nothing in the last 28 days — they've stopped uploading
      return recent.length === 0;
    };

    const load = async () => {
      try {
        const data = await loadFromStorage();
        setTransactions(applyPlanCap(data, plan));
        setAllTransactionsRaw(data);
        if (!uploadReminderShownRef.current) {
          uploadReminderShownRef.current = true;
          if (checkUploadReminder(data)) {
            showToast(
              "It's been a while! Upload last month's statements to keep your FIRE progress up to date.",
              'info',
              8000,
            );
          }
        }
      } catch (e) {
        console.error('Failed to load transactions:', e);
        const msg = e instanceof Error ? e.message : 'Failed to load your data';
        setLoadError(msg);
        showToast('Failed to load your data — try refreshing', 'error');
        logEvent(EVENTS.ERROR_BOUNDARY_CAUGHT, { where: 'DataContext.load', error: msg }, 'error');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [userId, plan, isAuthReady, isMimicMode, showToast]);

  const processFiles = useCallback(async (jobs: FileJob[], ownerOverride?: string) => {
    setIsProcessing(true);
    setProcessingProgress(5);
    const interval = setInterval(() => setProcessingProgress(p => p >= 95 ? p : p + 2), 1000);
    const startMs = Date.now();

    const isAnon = !userId;

    // A real upload supersedes the sample dataset. Discard the in-memory demo
    // rows (synchronously, so the merge below starts from a clean slate and no
    // demo row is ever persisted).
    if (isDemoModeRef.current) {
      allRawRef.current = [];
      setAllTransactionsRaw([]);
      setIsDemoMode(false);
    }

    try {
      // Merge/dedup against the FULL set (allRawRef), never the capped visible
      // `transactions`. For a free user with >500 transactions, deduping only
      // against the visible 500 let overlapping re-uploads slip duplicate rows of
      // the hidden transactions into storage. allRawRef holds the complete set
      // for both anonymous and signed-in users, so this compares against everything.
      let fullDataset = [...allRawRef.current];
      let completed = 0;
      let successCount = 0;
      let totalDuplicates = 0;
      let totalNewTransactions = 0;
      // Track headers from the first file that returns non-cached headers (for confirmation prompt)
      let importHeaders: string[] | null = null;

      for (const job of jobs) {
        try {
          const res = await transformData(job.file, job.owner, job.password);
          if (res.transactions.length) {
            successCount++;
            // Capture headers from the first file that used a non-cached mapping
            if (res.lastHeaders && !importHeaders) {
              importHeaders = res.lastHeaders;
            }
            // Apply family member override when uploading on behalf of another member
            const txnsToMerge = ownerOverride
              ? res.transactions.map(t => ({ ...t, owner: ownerOverride }))
              : res.transactions;
            // Deduplicate before merging: prevents duplicate rows from overlapping statements
            const { unique, duplicateCount } = deduplicateTransactions(fullDataset, txnsToMerge);
            totalDuplicates += duplicateCount;
            totalNewTransactions += unique.length;
            if (duplicateCount > 0) {
              console.info(`[processFiles] Skipped ${duplicateCount} duplicate transactions from ${job.file.name}`);
            }
            fullDataset = [...fullDataset, ...unique];
            const { transactions: cleaned } = identifyInterAccountTransfers(fullDataset);
            fullDataset = cleaned;

            if (isAnon) {
              setAllTransactionsRaw(fullDataset);
              setIsAnonymousPreview(true);
              // Anon users are 'free' → applyPlanCap shows only the most-recent 500.
              setTransactions(applyPlanCap(fullDataset, plan));
            } else {
              // For signed-in users we update React state per-file so the UI reflects
              // progress, but persist to storage only once after the loop ends. This
              // turns N upserts into one — major win for users uploading many files.
              // applyPlanCap limits the VISIBLE set for free users; the full dataset
              // is still saved to the cloud below (non-destructive). Pro sees all.
              setTransactions(applyPlanCap(fullDataset, plan));
              setAllTransactionsRaw(fullDataset);
            }

            logEvent(EVENTS.FILE_PROCESSED, {
              filename: job.file.name,
              count: res.transactions.length,
              anonymous: isAnon,
            });
          }
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : 'Failed to process file';
          logEvent(EVENTS.UPLOAD_ANALYSIS_FAILED, {
            fileName: job.file.name,
            error: message,
          }, 'error');
          showToast(message, 'error');
        }
        completed++;
        setProcessingProgress(Math.round((completed / jobs.length) * 100));
      }

      // Single persist after all files processed (signed-in users only).
      if (!isAnon && !isMimicMode && totalNewTransactions > 0 && successCount > 0) {
        try {
          await saveToStorage(fullDataset);
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Failed to save uploaded data';
          console.error('[processFiles] saveToStorage failed', e);
          showToast(message, 'error');
        }
      }

      // Expose headers so DashboardShell can show the import confirmation prompt
      if (importHeaders) {
        setLastImportHeaders(importHeaders);
      }

      if (jobs.length > 0) {
        const dupMsg = totalDuplicates > 0 ? ` (${totalDuplicates} duplicates skipped)` : '';
        if (successCount === jobs.length) {
          showToast(`Processed ${jobs.length} file(s) successfully${dupMsg}`);
        } else if (successCount > 0) {
          showToast(`Processed ${successCount} of ${jobs.length} file(s) successfully${dupMsg}`);
        }

        if (successCount > 0) {
          logEvent(EVENTS.UPLOAD_ANALYSIS_COMPLETED, {
            fileCount: jobs.length,
            successCount,
            newTransactions: totalNewTransactions,
            duplicatesSkipped: totalDuplicates,
            durationMs: Date.now() - startMs,
            anonymous: isAnon,
          });
        }
      }
    } finally {
      clearInterval(interval);

      setProcessingProgress(100);
      setTimeout(() => setIsProcessing(false), 800);
    }
  }, [transactions, allTransactionsRaw, userId, plan, isMimicMode, showToast]);

  const updateTransactions = useCallback(async (updated: Transaction[]) => {
    // Edit against the FULL set (allRawRef) so the visible cap and the total
    // count stay consistent, then re-derive the capped view for free users.
    const map = new Map(allRawRef.current.map(t => [t.id, t]));
    updated.forEach(t => map.set(t.id, t));
    const newRaw = Array.from(map.values());
    setAllTransactionsRaw(newRaw);
    setTransactions(applyPlanCap(newRaw, plan));
    try {
      if (!isMimicMode) await saveToStorage(updated);
      showToast('Data Updated');
    } catch (e) {
      console.error('updateTransactions: save failed', e);
      const msg = e instanceof Error ? e.message : 'Failed to save changes';
      showToast(msg, 'error');
    }
  }, [isMimicMode, plan, showToast]);

  const deleteTransactions = useCallback(async (ids: string[]) => {
    // Remove from the FULL set, then re-derive the capped view. For free users
    // this also surfaces a previously-hidden transaction to backfill the 500.
    const idSet = new Set(ids);
    const newRaw = allRawRef.current.filter(t => !idSet.has(t.id));
    setAllTransactionsRaw(newRaw);
    setTransactions(applyPlanCap(newRaw, plan));
    try {
      if (!isMimicMode) await deleteFromStorage(ids);
      showToast('Deleted');
    } catch (e) {
      console.error('deleteTransactions: delete failed', e);
      const msg = e instanceof Error ? e.message : 'Failed to delete';
      showToast(msg, 'error');
    }
  }, [isMimicMode, plan, showToast]);

  const clearAllData = useCallback(async () => {
    setTransactions([]);
    setAllTransactionsRaw([]);
    setIsAnonymousPreview(false);
    clearStoredMappings(); // also wipe saved column mappings so next upload re-detects format
    try {
      await resetAllData();
    } catch (e) {
      console.error('clearAllData failed', e);
    }
    window.location.reload();
  }, []);

  const clearLastImportHeaders = useCallback(() => {
    setLastImportHeaders(null);
  }, []);

  // ── Sample data (in-memory only — never touches storage) ──────────────────
  const loadDemoData = useCallback(() => {
    const demo = generateDemoTransactions();
    setAllTransactionsRaw(demo);
    setTransactions(applyPlanCap(demo, plan));
    setIsAnonymousPreview(false); // demo is not an anon upload — must not be promoted on sign-in
    setIsDemoMode(true);
    logEvent('demo_data_loaded', { count: demo.length });
  }, [plan]);

  const clearDemoData = useCallback(() => {
    setIsDemoMode(false);
    setTransactions([]);
    setAllTransactionsRaw([]);
    logEvent('demo_data_cleared', {});
  }, []);

  const refreshData = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await loadFromStorage();
      setTransactions(applyPlanCap(data, plan));
      setAllTransactionsRaw(data);
    } catch (e) {
      console.error('refreshData failed', e);
      const msg = e instanceof Error ? e.message : 'Failed to reload';
      setLoadError(msg);
      showToast(msg, 'error');
    }
  }, [plan, showToast]);

  // ── Anonymous → cloud promotion ───────────────────────────────────────────
  // Pushes the in-memory anonymous upload to the just-signed-in user's cloud
  // account, then refreshes from cloud so the UI shows the canonical rows.
  //
  // SIGN-UP SEQUENCE TRACE (anon uploads 50 txns → signs up):
  //   1. Anon upload → processFiles (isAnon) sets allTransactionsRaw=50,
  //      isAnonymousPreview=true. Nothing is persisted anywhere yet.
  //   2. User signs up → Supabase fires SIGNED_IN → AuthContext sets userId
  //      and (after profile load) calls onSignIn → promoteRef.current() → here.
  //   3. React also re-runs the load effect because userId changed. Whichever
  //      runs first, the load effect's GUARD bails (isAnonPreviewRef && rows>0,
  //      or promotionInFlightRef), so it never calls setAllTransactionsRaw([]).
  //   4. promoteAnonymousData: cloudSave(50) → cloudLoad() → state = 50 cloud
  //      rows, isAnonymousPreview=false, promotionDoneRef=true.
  //   => The 50 txns are in the cloud AND remain visible. No path resets them
  //      to empty: the only writer of [] is the load effect, which is guarded;
  //      cloudLoad() here returns the rows we just saved, not [].
  //
  // Safe by construction:
  //   - No-op when there is no anonymous data (rows===0 or not anon preview).
  //   - No double-write for already-signed-in users (their data is not an
  //     anonymous preview) or repeat sign-in events (promotionDoneRef).
  //   - Never writes under Mimic Mode.
  //   - cloudSave/cloudLoad authenticate via supabase.auth.getUser() directly,
  //     so they don't depend on storage.ts's cached _isLoggedIn flag (which may
  //     lag this SIGNED_IN event).
  const promoteAnonymousData = useCallback(async () => {
    if (isMimicMode) return;
    if (promotionDoneRef.current || promotionInFlightRef.current) return;
    if (!isAnonPreviewRef.current) return; // data didn't originate from an anon upload
    const raw = allRawRef.current;
    if (!raw || raw.length === 0) return;  // nothing to promote

    promotionInFlightRef.current = true;
    try {
      await cloudSave(raw);
      const cloudData = await cloudLoad();
      // All rows are now safely in the cloud. Free accounts still only VIEW the
      // most-recent 500 (applyPlanCap) — promotion never drops data.
      setAllTransactionsRaw(cloudData);
      setTransactions(applyPlanCap(cloudData, plan));
      setIsAnonymousPreview(false);
      promotionDoneRef.current = true;
      logEvent('anon_data_promoted', { count: raw.length });
      showToast(`Saved ${raw.length} uploaded transaction(s) to your account`);
    } catch (e) {
      // Keep the in-memory rows so the upload is not lost — the user can retry.
      console.error('[promoteAnonymousData] failed', e);
      const msg = e instanceof Error ? e.message : 'Could not save your data to the cloud';
      showToast(`${msg} — your uploaded data is still here, please try again`, 'error');
      logEvent(EVENTS.ERROR_BOUNDARY_CAUGHT, { where: 'promoteAnonymousData', error: msg }, 'error');
    } finally {
      promotionInFlightRef.current = false;
    }
  }, [isMimicMode, plan, showToast]);

  // Register promoteAnonymousData into the holder AppProvider shares with
  // AuthProvider (which sits above this provider and cannot read DataContext).
  useEffect(() => {
    if (!promoteRef) return;
    promoteRef.current = promoteAnonymousData;
    return () => { promoteRef.current = null; };
  }, [promoteRef, promoteAnonymousData]);

  // Total available to the user across every tier. `allTransactionsRaw` is the
  // full set (anon memory, or local/cloud storage) and is kept in sync on
  // upload/edit/delete, so this is the true total even when the visible
  // `transactions` set is capped for a free user. Drives the paywall "X of Y".
  const allTransactionsCount = allTransactionsRaw.length;

  const value = useMemo(
    () => ({
      transactions, allTransactionsCount, isLoading, isProcessing, processingProgress,
      isAnonymousPreview, loadError, lastImportHeaders, isDemoMode,
      processFiles, updateTransactions, deleteTransactions, clearAllData, refreshData,
      clearLastImportHeaders, loadDemoData, clearDemoData,
    }),
    [
      transactions, allTransactionsCount, isLoading, isProcessing, processingProgress,
      isAnonymousPreview, loadError, lastImportHeaders, isDemoMode,
      processFiles, updateTransactions, deleteTransactions, clearAllData, refreshData,
      clearLastImportHeaders, loadDemoData, clearDemoData,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

// Export internal methods for AppProvider to orchestrate sign-in flow
export { DataContext };
