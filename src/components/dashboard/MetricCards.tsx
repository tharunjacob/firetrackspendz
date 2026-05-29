import { formatAmount, COLORS } from '@/utils/constants';
import type { Currency } from '@/types';

interface MetricCardProps {
  title: string;
  value: string;
  accentColor: string;
  label: string;
  labelColor: string;
}

const MetricCard = ({ title, value, accentColor, label, labelColor }: MetricCardProps) => (
  <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-6 shadow-md hover:shadow-lg border border-slate-200 dark:border-slate-700 border-l-4 transition-shadow"
    style={{ borderLeftColor: accentColor }}>
    <p className="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider mb-1">{title}</p>
    <div className="flex justify-between items-baseline mt-2">
      <p className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap overflow-hidden text-ellipsis" title={value}>{value}</p>
      <p className={`text-xs sm:text-sm font-semibold ${labelColor} ml-2 shrink-0`}>{label}</p>
    </div>
  </div>
);

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
          title={`Total Income ${yearSuffix}`}
          value={formatAmount(totalIncome, currency)}
          accentColor={COLORS.income.medium}
          label="Income" labelColor="text-green-600"
        />
        <MetricCard
          title={`Total Expenses ${yearSuffix}`}
          value={formatAmount(totalExpenses, currency)}
          accentColor={COLORS.expense.medium}
          label="Expense" labelColor="text-red-600"
        />
        <MetricCard
          title={`Net Savings ${yearSuffix}`}
          value={formatAmount(netSavings, currency)}
          accentColor={netSavings >= 0 ? COLORS.income.dark : COLORS.expense.dark}
          label="Savings" labelColor="text-brand-600"
        />
      </div>
    </div>
  );
};
