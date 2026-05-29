import type { Currency } from '@/types';
import { formatAmount } from '@/utils/constants';

interface Props {
  currentSavings: number;
  fireNumber: number;
  currency: Currency;
  netWorthSource: 'asset' | 'manual' | 'none';
}

export const FireProgressBar = ({ currentSavings, fireNumber, currency, netWorthSource }: Props) => {
  const pct = fireNumber > 0 ? Math.min(100, (currentSavings / fireNumber) * 100) : 0;
  const { barColor, textColor } =
    pct >= 75 ? { barColor: '#10b981', textColor: 'text-emerald-500' }
    : pct >= 50 ? { barColor: '#22c55e', textColor: 'text-green-600' }
    : pct >= 25 ? { barColor: '#f59e0b', textColor: 'text-amber-500' }
    : { barColor: '#ef4444', textColor: 'text-red-500' };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-slate-100 dark:border-slate-700">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">FIRE Progress</p>
          <p className={`text-5xl font-bold ${textColor}`}>
            {pct < 1 && pct > 0 ? '<1' : pct.toFixed(1)}% to FIRE
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {formatAmount(Math.round(currentSavings), currency)} saved of{' '}
            {formatAmount(Math.round(fireNumber), currency)} needed
          </p>
        </div>
        <div className="text-right shrink-0">
          {netWorthSource === 'asset' ? (
            <a
              href="/net-assets"
              className="text-xs text-brand-600 hover:underline font-medium"
            >
              Using your net worth data &rarr;
            </a>
          ) : netWorthSource === 'manual' ? (
            <span className="text-xs text-slate-500">Enter savings in Scenarios tab</span>
          ) : (
            <a href="/net-assets" className="text-xs text-amber-600 hover:underline font-medium">
              No net worth data — add your assets &rarr;
            </a>
          )}
        </div>
      </div>
      <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-5 overflow-hidden">
        <div
          className="h-5 rounded-full transition-all duration-700"
          style={{ width: `${Math.max(pct, 0.5)}%`, backgroundColor: barColor }}
        />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-xs text-slate-500">0%</span>
        <span className="text-xs text-slate-500">100% (FIRE)</span>
      </div>
    </div>
  );
};
