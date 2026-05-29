import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { Navbar } from '@/components/layout/Navbar';
import { Toast } from '@/components/common/Toast';
import { AuthModal } from '@/components/auth/AuthModal';
import { FeedbackButton } from '@/components/common/FeedbackButton';
import { ConsentBanner } from '@/components/common/ConsentBanner';
import { ROUTES } from '@/config/routes';
import { logPageView } from '@/services/logger';

// Tracks route changes and fires a page_view event on every navigation
const PageTracker = () => {
  const location = useLocation();
  useEffect(() => { logPageView(location.pathname); }, [location.pathname]);
  return null;
};

// Lazy load pages
const LandingPage = lazy(() => import('@/pages/LandingPage'));
const PricingPage = lazy(() => import('@/pages/PricingPage'));
const FeaturesPage = lazy(() => import('@/pages/FeaturesPage'));
const AuthCallback = lazy(() => import('@/pages/AuthCallback'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const AdminPage = lazy(() => import('@/pages/AdminPage'));
const NetAssetPage = lazy(() => import('@/pages/NetAssetPage'));
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage'));
const TermsPage = lazy(() => import('@/pages/TermsPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const HelpPage = lazy(() => import('@/pages/HelpPage'));
const FamilyDashboard = lazy(() => import('@/pages/FamilyDashboard'));
const FeedbackPage = lazy(() => import('@/pages/FeedbackPage'));
const FireCalculatorTool = lazy(() => import('@/pages/tools/FireCalculatorTool'));
const SavingsRateTool = lazy(() => import('@/pages/tools/SavingsRateTool'));

const Loading = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
    <div className="text-center">
      <div className="w-10 h-10 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      <p className="text-sm text-slate-500">Loading...</p>
    </div>
  </div>
);

function App() {
  const { user, toast, hideToast, isAuthOpen, setIsAuthOpen } = useApp();

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      <PageTracker />
      <Navbar />
      <div className="flex-1 min-h-0">
      <Suspense fallback={<Loading />}>
        <Routes>
          {/* Public routes */}
          <Route path={ROUTES.HOME} element={user ? <Navigate to={ROUTES.DASHBOARD} replace /> : <LandingPage />} />
          <Route path={ROUTES.PRICING} element={<PricingPage />} />
          <Route path={ROUTES.FEATURES} element={<FeaturesPage />} />
          <Route path={ROUTES.PRIVACY} element={<PrivacyPage />} />
          <Route path={ROUTES.TERMS} element={<TermsPage />} />
          <Route path={ROUTES.HELP} element={<HelpPage />} />
          <Route path={ROUTES.FEEDBACK} element={<FeedbackPage />} />
          <Route path={ROUTES.AUTH_CALLBACK} element={<AuthCallback />} />
          <Route path={ROUTES.FIRE_CALCULATOR_TOOL} element={<FireCalculatorTool />} />
          <Route path={ROUTES.SAVINGS_RATE_TOOL} element={<SavingsRateTool />} />

          {/* Dashboard â€” open to all (upload-first experience) */}
          <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />

          {/* Protected routes â€” require sign-in */}
          <Route path={ROUTES.ASSETS} element={user ? <NetAssetPage /> : <Navigate to={ROUTES.HOME} replace />} />
          <Route path={ROUTES.SETTINGS} element={user ? <SettingsPage /> : <Navigate to={ROUTES.HOME} replace />} />
          <Route path={ROUTES.FAMILY} element={user ? <FamilyDashboard /> : <Navigate to={ROUTES.HOME} replace />} />
          <Route path={ROUTES.ADMIN} element={user ? <AdminPage /> : <Navigate to={ROUTES.HOME} replace />} />

          {/* Catch all */}
          <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
        </Routes>
      </Suspense>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
      {isAuthOpen && <AuthModal onClose={() => setIsAuthOpen(false)} />}
      <FeedbackButton />
      <ConsentBanner />
    </div>
  );
}

export default App;
