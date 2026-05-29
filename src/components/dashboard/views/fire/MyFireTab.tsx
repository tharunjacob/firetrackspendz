import { useMemo, useState, useCallback } from 'react';
import type { Transaction, Currency } from '@/types';
import { formatAmount } from '@/utils/constants';
import { calculateFireMetrics, detectRecurring } from '@/services/analysis';
import { FireProgressBar } from './FireProgressBar';
import {
  InfoTooltip,
  BigTicketExpense,
  computeFutureValue,
  RETURN_ON_CAPITAL,
} from './shared';

interface Props {
  fire: ReturnType<typeof calculateFireMetrics>;
  recurring: ReturnType<typeof detectRecurring>;
  transactions: Transaction[];
  currency: Currency;
  multiplier: number;
  netWorthTotal: number | null;
}

const PROJECTION_YEARS = [1, 5, 7, 10, 15];

export const MyFireTab = ({ fire, recurring, transactions, currency, multiplier, netWorthTotal }: Props) => {
  const [editableMonthly, setEditableMonthly] = useState<number | null>(null);
  const [editableInflation, setEditableInflation] = useState<number | null>(null);
  const [editableNetWorth, setEditableNetWorth] = useState<number | null>(null);

  const effectiveMonthly = editableMonthly ?? fire.avgMonthlyExpense;
  const effectiveInflation = editableInflation ?? (fire.personalInflation * 100);
  const effectiveFireNumber = effectiveMonthly * 12 * multiplier;

  const [bigTickets, setBigTickets] = useState<BigTicketExpense[]>([]);
  const addBigTicket = useCallback(() => setBigTickets(prev => [...prev, { id: Date.now().toString(), name: '', currentValue: 0, yearsFromNow: 5, expectedInflation: 6 }]), []);
  const updateBigTicket = useCallback((id: string, field: keyof BigTicketExpense, value: string | number) =>
    setBigTickets(prev => prev.map(bt => bt.id === id ? { ...bt, [field]: value } : bt)), []);
  const removeBigTicket = useCallback((id: string) => setBigTickets(prev => prev.filter(bt => bt.id !== id)), []);

  const bigTicketCorpus = useMemo(
    () => bigTickets.reduce((sum, bt) => sum + computeFutureValue(bt.currentValue, bt.yearsFromNow, bt.expectedInflation), 0),
    [bigTickets]
  );

  const effectiveProjections = useMemo(
    () => PROJECTION_YEARS.map(yr => ({
      year: yr,
      value: effectiveMonthly * 12 * multiplier * Math.pow(1 + effectiveInflation / 100, yr),
    })),
    [effectiveMonthly, multiplier, effectiveInflation]
  );

  const recurringTotal = useMemo(() => recurring.reduce((s, r) => s + r.avgAmount, 0), [recurring]);

  const realIncomeGrowth = useMemo(() => {
    if (fire.annualIncomeGrowth === undefined) return null;
    return (fire.annualIncomeGrowth * 100) - (fire.personalInflation * 100);
  }, [fire]);

  const balancedSpender = useMemo(() => {
    const dayOfWeek = new Map<number, number>();
    transactions.filter(t => t.type === 'Expense').forEach(t => {
      try { const dow = new Date(t.date + 'T00:00:00').getDay(); dayOfWeek.set(dow, (dayOfWeek.get(dow) || 0) + t.amount); } catch {}
    });
    if (dayOfWeek.size < 3) return 'Unknown';
    const values = [...dayOfWeek.values()];
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / values.length);
    const cv = stdDev / avg;
    return cv < 0.3 ? 'Stable' : cv < 0.6 ? 'Moderate' : 'Volatile';
  }, [transactions]);

  const netWorthSource: 'asset' | 'manual' | 'none' = netWorthTotal !== null ? 'asset' : editableNetWorth !== null ? 'manual' : 'none';
  const progressSavings = netWorthTotal ?? editableNetWorth ?? 0;

  return (
    <>
      <FireProgressBar
        currentSavings={progressSavings}
        fireNumber={effectiveFireNumber + bigTicketCorpus}
        currency={currency}
        netWorthSource={netWorthSource}
      />

      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-8 text-white">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Financial Freedom</span>
              <span className="text-slate-400 text-sm">Target Corpus ({multiplier}x Living + Liabilities)</span>
            </div>
            <p className="text-5xl font-black mb-2">{formatAmount(effectiveFireNumber + bigTicketCorpus, currency)}</p>
            <p className="text-slate-400">Your "Freedom Number" to retire today.</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-slate-700/50 rounded-xl p-4 min-w-[160px]">
              <p className="text-xs text-slate-400 uppercase font-bold mb-1">Avg Monthly Spend</p>
              <input type="number" value={Math.round(effectiveMonthly)} onChange={e => setEditableMonthly(Number(e.target.value))}
                className="bg-transparent text-2xl font-bold text-white w-full outline-none border-b border-slate-600 focus:border-blue-400 transition" />
              <p className="text-xs text-slate-500 mt-1">Estimated Living Cost</p>
            </div>
            <div className="bg-slate-700/50 rounded-xl p-4 min-w-[160px]">
              <p className="text-xs text-slate-400 uppercase font-bold mb-1">Personal Inflation</p>
              <div className="flex items-baseline">
                <input type="number" step="0.1" value={effectiveInflation.toFixed(1)} onChange={e => setEditableInflation(Number(e.target.value))}
                  className="bg-transparent text-2xl font-bold text-white w-20 outline-none border-b border-slate-600 focus:border-blue-400 transition" />
                <span className="text-xl text-slate-400 ml-1">%</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Affects future projections</p>
            </div>
            {netWorthTotal === null && (
              <div className="bg-slate-700/50 rounded-xl p-4 min-w-[160px]">
                <p className="text-xs text-slate-400 uppercase font-bold mb-1">Starting Net Worth</p>
                <div className="flex items-baseline">
                  <span className="text-xl text-slate-400 mr-1">{currency === 'INR' ? '₹' : '$'}</span>
                  <input type="number" value={editableNetWorth ?? ''} placeholder="0" onChange={e => setEditableNetWorth(e.target.value ? Number(e.target.value) : null)}
                    className="bg-transparent text-2xl font-bold text-white w-24 outline-none border-b border-slate-600 focus:border-blue-400 transition" />
                </div>
                <p className="text-xs text-slate-500 mt-1">Manual corpus</p>
              </div>
            )}
          </div>
        </div>
        <div className="mt-8">
          <p className="text-sm text-slate-400 uppercase font-bold tracking-wider mb-4">
            Required Capital if Retiring in...
            <InfoTooltip text="Nominal = future money needed. 'Today's money' shows the same figure in current purchasing power (discounted by inflation)." />
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {effectiveProjections.map(p => (
              <div key={p.year} className="bg-slate-700/40 rounded-xl p-4 border border-slate-600/50">
                <p className="text-sm font-bold text-blue-300">{p.year} Year{p.year > 1 ? 's' : ''}</p>
                <p className="text-xl font-bold mt-1">{formatAmount(Math.round(p.value + bigTicketCorpus), currency)}</p>
                <p className="text-xs text-slate-500 mt-1">nominal</p>
                <p className="text-xs text-blue-400/70 mt-0.5">
                  {formatAmount(Math.round(effectiveFireNumber + bigTicketCorpus), currency)} real
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">🎯</span>
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Big Ticket Expenses</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">One-time future costs (Weddings, Education, Home)</p>
          </div>
        </div>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500 dark:text-slate-400 border-b dark:border-slate-700">
              <tr>
                <th className="text-left px-4 py-3">Expense</th>
                <th className="text-right px-4 py-3">Current Value</th>
                <th className="text-right px-4 py-3">How Many Years</th>
                <th className="text-right px-4 py-3">Expected Inflation</th>
                <th className="text-right px-4 py-3">Future Value</th>
                <th className="text-right px-4 py-3">Corpus Needed</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {bigTickets.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">No big expenses added yet. Add items like a home down payment or wedding.</td></tr>
              ) : bigTickets.map(bt => {
                const fv = computeFutureValue(bt.currentValue, bt.yearsFromNow, bt.expectedInflation);
                return (
                  <tr key={bt.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                    <td className="px-4 py-3"><input type="text" value={bt.name} placeholder="e.g. Home Down Payment" onChange={e => updateBigTicket(bt.id, 'name', e.target.value)} className="w-full bg-transparent border-b border-slate-200 dark:border-slate-600 focus:border-blue-400 outline-none py-1 text-sm dark:text-slate-200 dark:placeholder:text-slate-500" /></td>
                    <td className="px-4 py-3 text-right"><input type="number" value={bt.currentValue} onChange={e => updateBigTicket(bt.id, 'currentValue', Number(e.target.value))} className="w-24 bg-transparent border-b border-slate-200 dark:border-slate-600 focus:border-blue-400 outline-none text-right py-1 text-sm dark:text-slate-200" /></td>
                    <td className="px-4 py-3 text-right"><input type="number" value={bt.yearsFromNow} onChange={e => updateBigTicket(bt.id, 'yearsFromNow', Number(e.target.value))} className="w-16 bg-transparent border-b border-slate-200 dark:border-slate-600 focus:border-blue-400 outline-none text-right py-1 text-sm dark:text-slate-200" /></td>
                    <td className="px-4 py-3 text-right"><input type="number" step="0.5" value={bt.expectedInflation} onChange={e => updateBigTicket(bt.id, 'expectedInflation', Number(e.target.value))} className="w-16 bg-transparent border-b border-slate-200 dark:border-slate-600 focus:border-blue-400 outline-none text-right py-1 text-sm dark:text-slate-200" /></td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-200">{formatAmount(Math.round(fv), currency)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-800 dark:text-slate-100">{formatAmount(Math.round(fv / 0.04), currency)}</td>
                    <td className="px-4 py-3 text-center"><button onClick={() => removeBigTicket(bt.id)} className="text-red-400 hover:text-red-600 text-lg">✕</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button onClick={addBigTicket} className="mt-4 px-4 py-2 text-sm font-medium text-blue-600 border border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition">+ Add Expense</button>
        <p className="text-xs text-slate-400 mt-4 text-right">* Future Value uses {RETURN_ON_CAPITAL}% return. Corpus Needed assumes 4% Safe Withdrawal Rate (25× rule).</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Recurring Commitments</h3>
            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full font-bold">{recurring.length} Found</span>
          </div>
          <p className="text-3xl font-black text-slate-800 dark:text-slate-100">{formatAmount(recurringTotal, currency)}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">/ month estimated fixed cost</p>
          <div className="space-y-2 max-h-64 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {recurring.map((r, i) => {
              const freqLabel = Math.abs(r.frequency - 7) < 2 ? 'Weekly'
                : Math.abs(r.frequency - 30.5) < 5 ? 'Monthly'
                : Math.abs(r.frequency - 91) < 8 ? 'Quarterly'
                : Math.abs(r.frequency - 365) < 15 ? 'Yearly'
                : `Every ${r.frequency}d`;
              const icon = /rent|housing/i.test(r.name) ? '🏠'
                : /emi|loan|mortgage/i.test(r.name) ? '💳'
                : /insurance/i.test(r.name) ? '🛡️'
                : /electric|water|gas|utilities|maintenance/i.test(r.name) ? '⚡'
                : /internet|broadband|wifi/i.test(r.name) ? '🌐'
                : /phone|mobile|telecom|recharge/i.test(r.name) ? '📱'
                : /education|school|college|tuition|fees/i.test(r.name) ? '🎓'
                : /gym|fitness|yoga|pilates/i.test(r.name) ? '💪'
                : '📺';
              return (
                <div key={i} className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-700 last:border-0 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base shrink-0">{icon}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{r.name}</p>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">{freqLabel}</span>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 shrink-0">{formatAmount(r.avgAmount, currency)}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 flex flex-col items-center justify-center">
          <span className="text-3xl mb-3">📈</span>
          {realIncomeGrowth !== null && (
            <span className={`text-xs font-bold px-3 py-1 rounded-full mb-2 ${realIncomeGrowth >= 0 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>
              {realIncomeGrowth >= 0 ? 'Positive' : 'Losing'}
            </span>
          )}
          <p className="text-xs uppercase text-slate-400 font-bold tracking-wider">Real Income Growth</p>
          <p className={`text-4xl font-black ${realIncomeGrowth !== null && realIncomeGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {realIncomeGrowth !== null ? `${realIncomeGrowth.toFixed(1)}%` : 'N/A'}
          </p>
          {fire.annualIncomeGrowth !== undefined && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 text-center">
              Income grew by {(fire.annualIncomeGrowth * 100).toFixed(1)}%. Adjusted for inflation ({(fire.personalInflation * 100).toFixed(1)}%), real buying power change is <span className="font-bold">{realIncomeGrowth?.toFixed(1)}%</span>.
            </p>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 flex flex-col items-center justify-center">
          <span className="text-3xl mb-3">✅</span>
          <span className={`text-xs font-bold px-3 py-1 rounded-full mb-2 ${balancedSpender === 'Stable' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : balancedSpender === 'Moderate' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>
            {balancedSpender === 'Stable' ? 'Positive' : balancedSpender === 'Moderate' ? 'Moderate' : 'Warning'}
          </span>
          <p className="text-xs uppercase text-slate-400 font-bold tracking-wider">Balanced Spender</p>
          <p className={`text-4xl font-black ${balancedSpender === 'Stable' ? 'text-green-600' : balancedSpender === 'Moderate' ? 'text-amber-600' : 'text-red-600'}`}>
            {balancedSpender}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 text-center">
            Your spending is {balancedSpender === 'Stable' ? 'evenly distributed throughout the week, avoiding weekend binges.' : balancedSpender === 'Moderate' ? 'moderately balanced across the week.' : 'concentrated on specific days.'}
          </p>
        </div>
      </div>
    </>
  );
};
