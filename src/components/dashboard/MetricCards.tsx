import { formatAmount } from '@/utils/constants';
import type { Currency } from '@/types';
import { MetricCard, type MetricPill } from './MetricCard';

interface Props {
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  currency: Currency;
  displayYear: number;
  isCurrentYear: boolean;
}

export const MetricCards = ({ totalIncome, totalExpenses, netSavings, currency, displayYear, isCurrentYear }: Props) => {
  const yearSuffix = isCurrentYear ? 'YTD' : String(displayYear);

  // Honest, derivable context pills (no fabricated period-over-period deltas).
  const expensePill: MetricPill | undefined = totalIncome > 0
    ? { label: `${Math.round((totalExpenses / totalIncome) * 100)}% of income`, tone: 'neutral' }
    : undefined;
  const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;
  const savingsPill: MetricPill | undefined = totalIncome > 0
    ? (netSavings >= 0
        ? { label: `${savingsRate}% saved`, tone: 'positive', arrow: 'up' }
        : { label: `${Math.abs(savingsRate)}% deficit`, tone: 'negative', arrow: 'down' })
    : undefined;

  return (
    <div className="mb-5 sm:mb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">Financial Dashboard</h2>
        {!isCurrentYear && (
          <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-full font-medium">
            Showing {displayYear} — no {new Date().getFullYear()} data yet
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
        <MetricCard
          eyebrow={`Total Income ${yearSuffix}`}
          value={formatAmount(totalIncome, currency)}
          valueTone="positive"
        />
        <MetricCard
          eyebrow={`Total Expenses ${yearSuffix}`}
          value={formatAmount(totalExpenses, currency)}
          valueTone="negative"
          pill={expensePill}
        />
        <MetricCard
          eyebrow={`Net Savings ${yearSuffix}`}
          value={formatAmount(netSavings, currency)}
          valueTone={netSavings >= 0 ? 'brand' : 'negative'}
          pill={savingsPill}
        />
      </div>
    </div>
  );
};
