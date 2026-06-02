import { type ReactNode, type MutableRefObject, useCallback, useRef } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { DataProvider } from './DataContext';
import { UIProvider, useUI } from './UIContext';

// ============================================================
// Combined App Provider — Wraps Auth + Data + UI providers
// ============================================================
//
// PURPOSE:
// This is the single provider you mount in main.tsx. It composes
// AuthContext, DataContext, and UIContext in the correct order
// and wires the cross-context communication (e.g., when user signs
// in, DataContext needs to load their cloud data).
//
// PROVIDER ORDER (outermost → innermost):
//   UIProvider → AuthProvider → DataBridge
//   - UI is outermost because showToast is used by both Auth and Data
//   - Auth is next because Data needs userId to decide storage
//   - DataBridge is innermost because it reads from both Auth and UI
//
// HOW TO USE:
// In main.tsx:
//   import { AppProvider } from '@/contexts/AppProvider';
//   <AppProvider><App /></AppProvider>
// ============================================================

/**
 * Internal bridge component that reads auth state and passes
 * it down to DataProvider as props. This avoids DataProvider
 * needing to call useAuth() internally (which would be a
 * cross-context dependency).
 */
const DataBridge = ({
  children,
  promoteRef,
}: {
  children: ReactNode;
  promoteRef: MutableRefObject<(() => Promise<void>) | null>;
}) => {
  const { userId, plan, isMimicMode, isAuthReady } = useAuth();
  const { showToast } = useUI();

  return (
    <DataProvider
      userId={userId}
      plan={plan}
      isMimicMode={isMimicMode}
      isAuthReady={isAuthReady}
      showToast={showToast}
      promoteRef={promoteRef}
    >
      {children}
    </DataProvider>
  );
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  // Shared holder that lets AuthProvider (mounted ABOVE DataProvider, so it
  // cannot read DataContext) trigger anon→cloud promotion on sign-in.
  // DataProvider populates promoteRef.current with its promoteAnonymousData;
  // AuthProvider's onSignIn fires it once the SIGNED_IN session is established.
  const promoteRef = useRef<(() => Promise<void>) | null>(null);
  const handleSignIn = useCallback(() => { void promoteRef.current?.(); }, []);

  return (
    <UIProvider>
      <AuthProvider onSignIn={handleSignIn}>
        <DataBridge promoteRef={promoteRef}>
          {children}
        </DataBridge>
      </AuthProvider>
    </UIProvider>
  );
};
