import { useMemo, useState, useCallback, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { formatAmount } from '@/utils/constants';
import { canAccessFeature } from '@/config/plans';
import { logEvent, EVENTS } from '@/services/logger';
import { computeWrappedStats } from './computeStats';
import { WrappedIntro, WrappedEmpty } from './WrappedIntro';
import { WrappedSlides } from './WrappedSlides';
import { WrappedSummary } from './WrappedSummary';

export const WrappedView = () => {
  const { transactions, currency, plan } = useApp();

  useEffect(() => {
    logEvent(EVENTS.FEATURE_WRAPPED_OPENED);
  }, []);

  const availableYears = useMemo(() => {
    const yearSet = new Set<number>();
    transactions.forEach(t => {
      const y = parseInt(t.date.substring(0, 4), 10);
      if (!isNaN(y) && y > 2000) yearSet.add(y);
    });
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [transactions]);

  const [selectedYear, setSelectedYear] = useState<number>(() => {
    if (availableYears.length > 0) return availableYears[0];
    return new Date().getFullYear();
  });

  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  const isPro = canAccessFeature(plan, 'financial_wrapped');
  const stats = useMemo(() => computeWrappedStats(transactions, selectedYear), [transactions, selectedYear]);
  const fmt = useCallback((v: number) => formatAmount(v, currency), [currency]);

  if (transactions.length === 0) {
    return <WrappedEmpty />;
  }

  return (
    <div className="space-y-6">
      <WrappedIntro
        selectedYear={selectedYear}
        availableYears={availableYears}
        onSelectYear={setSelectedYear}
      />
      <WrappedSlides stats={stats} isPro={isPro} fmt={fmt} />
      {isPro && <WrappedSummary stats={stats} currency={currency} plan={plan} />}
    </div>
  );
};

export default WrappedView;
