import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { usePageMeta } from '@/hooks/usePageMeta';

const DashboardPage = () => {
  usePageMeta({ title: 'Financial Dashboard | TrackSpendZ', description: 'Your personal finance dashboard. Upload statements, track spending, analyze trends, and plan your path to FIRE.', canonical: '/dashboard', noIndex: true });

  return (
  <main className="h-full">
    <DashboardShell />
  </main>
  );
};

export default DashboardPage;
