import type { Currency } from '@/types';

// Re-exported from the analysis service, which owns the canonical FIRE multiplier
// policy (so the dashboard and the AI summary never disagree). Import sites keep
// using `from './fire/shared'` unchanged.
export { FIRE_MULTIPLIER } from '@/services/analysis';

export const getCurrencyDefaults = (currency: Currency) => ({
  returnRate: currency === 'INR' ? 8 : 7,
  inflation: currency === 'INR' ? 6 : 3,
});

export const InfoTooltip = ({ text }: { text: string }) => (
  <span
    title={text}
    className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-300 text-xs cursor-help ml-1 leading-none select-none"
    aria-label={text}
  >
    i
  </span>
);

export const LockedFeature = ({ feature }: { feature: string }) => (
  <div className="card p-10 text-center border-2 border-dashed border-slate-200 dark:border-slate-700">
    <div className="text-4xl mb-3">🔒</div>
    <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">{feature}</h3>
    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-4">
      Upgrade to Pro to unlock advanced FIRE scenario modeling,
      Monte Carlo simulations, and interactive what-if analysis.
    </p>
    <a href="/pricing" className="inline-block px-6 py-2.5 bg-brand-600 text-white rounded-lg font-medium text-sm hover:bg-brand-700 transition-colors">
      Upgrade to Pro
    </a>
  </div>
);

export type FireTab = 'my-fire' | 'scenarios' | 'monte-carlo';

export interface BigTicketExpense {
  id: string;
  name: string;
  currentValue: number;
  yearsFromNow: number;
  expectedInflation: number;
}

export const computeFutureValue = (current: number, years: number, inflation: number) =>
  current * Math.pow(1 + inflation / 100, years);

export const RETURN_ON_CAPITAL = 8;
