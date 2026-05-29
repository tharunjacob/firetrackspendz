import { useMemo, useState, useEffect } from 'react';
import { logEvent, EVENTS } from '@/services/logger';
import { useApp } from '@/contexts/AppContext';
import { detectRecurring, estimateMonthlyByCategory } from '@/services/analysis';
import { formatAmount } from '@/utils/constants';
import { Icon } from '@/components/common/Icons';
import { canAccessFeature } from '@/config/plans';
import { UpgradePrompt } from '@/components/common/UpgradePrompt';

// ============================================================
// Recurring Expenses View – Shows detected recurring charges
// ============================================================

const getFrequencyLabel = (days: number): { label: string; color: string; badgeColor: string } => {
  if (Math.abs(days - 7) < 2) return { label: 'Weekly', color: 'text-brand-600', badgeColor: 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-800' };
  if (Math.abs(days - 30.5) < 5) return { label: 'Monthly', color: 'text-brand-600', badgeColor: 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-800' };
  if (Math.abs(days - 91) < 10) return { label: 'Quarterly', color: 'text-amber-600', badgeColor: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' };
  if (Math.abs(days - 365) < 15) return { label: 'Yearly', color: 'text-brand-600', badgeColor: 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-800' };
  return { label: `Every ${days}d`, color: 'text-slate-600', badgeColor: 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600' };
};

const getMonthlyEquivalent = (amount: number, frequencyDays: number): number => {
  return (amount / frequencyDays) * 30.44;
};

export const RecurringView = () => {
  useEffect(() => { logEvent(EVENTS.FEATURE_RECURRING_OPENED); }, []);
  const { transactions, currency, plan } = useApp();

  const [sortBy, setSortBy] = useState<'amount' | 'frequency' | 'confidence'>('amount');

  const recurring = useMemo(() => detectRecurring(transactions), [transactions]);
  const monthlyByCategory = useMemo(() => estimateMonthlyByCategory(transactions), [transactions]);
  const monthlyBaseline = useMemo(
    () => monthlyByCategory.reduce((s, c) => s + c.avgMonthly, 0),
    [monthlyByCategory]
  );

  const sorted = useMemo(() => {
    const list = [...recurring];
    if (sortBy === 'amount') list.sort((a, b) => b.avgAmount - a.avgAmount);
    else if (sortBy === 'frequency') list.sort((a, b) => a.frequency - b.frequency);
    else list.sort((a, b) => b.confidence - a.confidence);
    return list;
  }, [recurring, sortBy]);

  const totalMonthlyBurn = useMemo(() =>
    recurring.reduce((sum, r) => sum + getMonthlyEquivalent(r.avgAmount, r.frequency), 0),
    [recurring]
  );

  const totalYearlyBurn = totalMonthlyBurn * 12;

  if (transactions.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <Icon name="chart" className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">No transactions yet</p>
        <p className="text-sm">Upload a statement to detect recurring expenses.</p>
      </div>
    );
  }

  if (!canAccessFeature(plan, 'recurring_detection')) {
    return <UpgradePrompt feature="Recurring Expenses" description="Auto-detect subscriptions and recurring charges" />;
  }

  const hasRecurring = recurring.length > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {!hasRecurring && (
        <div className="card p-6 text-center text-slate-500 dark:text-slate-400">
          <Icon name="search" className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-base font-medium text-slate-700 dark:text-slate-200">No recurring expenses detected</p>
          <p className="text-sm mt-1">Upload at least 2–3 months of data — recurring patterns like subscriptions and monthly bills will appear here automatically.</p>
        </div>
      )}
      {hasRecurring && (
      <>
      {/* Header Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Recurring Bills Found</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{recurring.length}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Monthly Recurring</p>
          <p className="text-2xl font-bold text-red-500">{formatAmount(Math.round(totalMonthlyBurn), currency)}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Yearly Recurring</p>
          <p className="text-2xl font-bold text-red-400">{formatAmount(Math.round(totalYearlyBurn), currency)}</p>
        </div>
      </div>

      {/* Sort Controls */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Detected Recurring Expenses</h2>
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
          {(['amount', 'frequency', 'confidence'] as const).map(opt => (
            <button
              key={opt}
              onClick={() => setSortBy(opt)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                sortBy === opt ? 'bg-white dark:bg-slate-600 text-brand-600 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {opt === 'amount' ? 'By Amount' : opt === 'frequency' ? 'By Frequency' : 'By Confidence'}
            </button>
          ))}
        </div>
      </div>

      {/* Recurring Items List */}
      <div className="space-y-3">
        {sorted.map((item, idx) => {
          const freq = getFrequencyLabel(item.frequency);
          const monthlyEq = getMonthlyEquivalent(item.avgAmount, item.frequency);
          const confidenceColor = item.confidence > 80 ? 'text-green-600' : item.confidence > 50 ? 'text-amber-500' : 'text-slate-400';

          return (
            <div key={idx} className="card p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100 truncate">{item.name}</h3>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${freq.badgeColor}`}>
                      {freq.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span>Last charged: {item.lastDate}</span>
                    <span className={confidenceColor}>
                      {item.confidence.toFixed(0)}% confidence
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    {formatAmount(item.avgAmount, currency)}
                    <span className="text-xs text-slate-400 font-normal ml-1">/{freq.label.toLowerCase()}</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    ~{formatAmount(Math.round(monthlyEq), currency)}/mo
                  </p>
                </div>
              </div>

              {/* Confidence bar */}
              <div className="mt-3">
                <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      item.confidence > 80 ? 'bg-green-500' : item.confidence > 50 ? 'bg-amber-400' : 'bg-slate-300'
                    }`}
                    style={{ width: `${Math.min(100, item.confidence)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Insight Footer */}
      <div className="card p-4 bg-brand-50 dark:bg-brand-900/20 border-brand-100 dark:border-brand-800">
        <p className="text-sm text-brand-700 dark:text-brand-300">
          <strong>Tip:</strong> Your recurring expenses account for approximately{' '}
          <strong>
            {formatAmount(Math.round(totalMonthlyBurn), currency)}/month
          </strong>{' '}
          ({formatAmount(Math.round(totalYearlyBurn), currency)}/year). Review these regularly to find subscriptions you no longer use.
        </p>
      </div>
      </>
      )}

      {/* Estimated monthly spend by category */}
      {monthlyByCategory.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Estimated monthly spend</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">How much each category costs you per month, based on your history.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {monthlyByCategory.map(c => {
              const trendIcon = c.trend === 'up' ? '▲' : c.trend === 'down' ? '▼' : '—';
              const trendClass = c.trend === 'up'
                ? 'text-red-500'
                : c.trend === 'down'
                ? 'text-green-600'
                : 'text-slate-400';
              return (
                <div key={c.category} className="card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{c.category}</p>
                    <span className={`text-sm font-bold ${trendClass}`} title={`${c.trend === 'stable' ? 'Stable' : c.trend === 'up' ? 'Trending up' : 'Trending down'} — last 3 months vs overall`}>
                      {trendIcon}
                    </span>
                  </div>
                  <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">
                    ~{formatAmount(c.avgMonthly, currency)}
                    <span className="text-xs text-slate-400 font-normal">/mo</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">based on {c.monthsOfData} month{c.monthsOfData !== 1 ? 's' : ''}</p>
                </div>
              );
            })}
          </div>
          <div className="card p-4 bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Estimated monthly baseline</span>
            <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{formatAmount(Math.round(monthlyBaseline), currency)}<span className="text-xs text-slate-400 font-normal">/mo</span></span>
          </div>
        </div>
      )}
    </div>
  );
};
