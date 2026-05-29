import { useMemo, useState, useEffect } from 'react';
import { logEvent, EVENTS } from '@/services/logger';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { canAccessFeature } from '@/config/plans';
import { loadSnapshots, computeMonthlyNetWorth } from '@/services/assetStorage';
import { calculateFireMetrics, detectRecurring } from '@/services/analysis';
import { FIRE_MULTIPLIER, FireTab, LockedFeature } from './shared';
import { MyFireTab } from './MyFireTab';
import { ScenariosTab } from './ScenariosTab';
import { MonteCarloTab } from './MonteCarloTab';
import type { Transaction } from '@/types';

interface FireViewProps { data?: Transaction[]; }

export const FireView = ({ data }: FireViewProps = {}) => {
  useEffect(() => { logEvent(EVENTS.FEATURE_FIRE_OPENED); }, []);
  const { transactions: allTransactions, currency, plan } = useApp();
  const transactions = data ?? allTransactions;
  const { userId } = useAuth();
  const multiplier = FIRE_MULTIPLIER[currency] || 25;
  const fire = useMemo(() => calculateFireMetrics(transactions, multiplier), [transactions, multiplier]);
  const recurring = useMemo(() => detectRecurring(transactions), [transactions]);

  const [activeFireTab, setActiveFireTab] = useState<FireTab>('my-fire');
  const [netWorthTotal, setNetWorthTotal] = useState<number | null>(null);

  useEffect(() => {
    loadSnapshots(userId ?? undefined).then(snapshots => {
      if (snapshots.length === 0) return;
      const monthly = computeMonthlyNetWorth(snapshots);
      if (monthly.length > 0) {
        setNetWorthTotal(monthly[monthly.length - 1].totalCurrentValue);
      }
    }).catch(() => {});
  }, [userId]);

  const canScenarios = canAccessFeature(plan, 'fire_scenarios');
  const canMonteCarlo = canAccessFeature(plan, 'fire_monte_carlo');

  const FIRE_TABS: { key: FireTab; label: string; icon: string; locked: boolean }[] = [
    { key: 'my-fire', label: 'My FIRE', icon: '🔥', locked: false },
    { key: 'scenarios', label: 'Scenarios', icon: '📊', locked: !canScenarios },
    { key: 'monte-carlo', label: 'Monte Carlo', icon: '🎲', locked: !canMonteCarlo },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 pb-px">
        {FIRE_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveFireTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
              activeFireTab === tab.key
                ? 'border-b-2 border-brand-600 text-brand-700 bg-white dark:bg-slate-800'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.locked && <span className="text-xs">🔒</span>}
          </button>
        ))}
      </div>

      {activeFireTab === 'my-fire' && (
        <MyFireTab
          fire={fire}
          recurring={recurring}
          transactions={transactions}
          currency={currency}
          multiplier={multiplier}
          netWorthTotal={netWorthTotal}
        />
      )}

      {activeFireTab === 'scenarios' && (
        canScenarios
          ? <ScenariosTab fire={fire} currency={currency} multiplier={multiplier} transactions={transactions} netWorthTotal={netWorthTotal} />
          : <LockedFeature feature="FIRE Scenarios — Coast, Barista, Lean & Fat FIRE" />
      )}

      {activeFireTab === 'monte-carlo' && (
        canMonteCarlo
          ? <MonteCarloTab fire={fire} currency={currency} multiplier={multiplier} netWorthTotal={netWorthTotal} />
          : <LockedFeature feature="Monte Carlo Retirement Simulation" />
      )}
    </div>
  );
};
