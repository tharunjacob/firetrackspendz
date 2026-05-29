import { useMemo, useState, useEffect } from 'react';
import type { Transaction, Currency } from '@/types';
import { formatAmount } from '@/utils/constants';
import { calculateFireMetrics } from '@/services/analysis';
import { getCurrencyDefaults, InfoTooltip } from './shared';

interface ScenarioInputs {
  monthlySavings: number;
  expectedReturn: number;
  retirementAge: number;
  currentAge: number;
  inflationRate: number;
  partTimeIncome: number;
  currentSavings: number;
}

type ScenarioMode = 'simple' | 'advanced';

interface Props {
  fire: ReturnType<typeof calculateFireMetrics>;
  currency: Currency;
  multiplier: number;
  transactions: Transaction[];
  netWorthTotal: number | null;
}

export const ScenariosTab = ({ fire, currency, multiplier, transactions, netWorthTotal }: Props) => {
  const defaults = getCurrencyDefaults(currency);
  const annualExpense = fire.avgMonthlyExpense * 12;

  const annualIncome = useMemo(() => {
    const incomes = transactions.filter(t => t.type === 'Income');
    if (incomes.length === 0) return 0;
    const months = new Set(incomes.map(t => t.date.substring(0, 7))).size || 1;
    return (incomes.reduce((s, t) => s + t.amount, 0) / months) * 12;
  }, [transactions]);

  const autoMonthlySavings = Math.max(0, Math.round((annualIncome - annualExpense) / 12));

  const [mode, setMode] = useState<ScenarioMode>(() => {
    try { return (localStorage.getItem('fire_scenario_mode') as ScenarioMode) || 'advanced'; } catch { return 'advanced'; }
  });

  const switchMode = (m: ScenarioMode) => {
    setMode(m);
    try { localStorage.setItem('fire_scenario_mode', m); } catch {}
  };

  const [inputs, setInputs] = useState<ScenarioInputs>({
    monthlySavings: autoMonthlySavings,
    expectedReturn: defaults.returnRate,
    retirementAge: 50,
    currentAge: 30,
    inflationRate: fire.personalInflation * 100 || defaults.inflation,
    partTimeIncome: Math.round(fire.avgMonthlyExpense * 0.5),
    currentSavings: netWorthTotal ?? 0,
  });

  useEffect(() => {
    if (netWorthTotal !== null) {
      setInputs(prev => prev.currentSavings === 0 ? { ...prev, currentSavings: netWorthTotal } : prev);
    }
  }, [netWorthTotal]);

  const set = (key: keyof ScenarioInputs, val: number) =>
    setInputs(prev => ({ ...prev, [key]: val }));

  const scenarios = useMemo(() => {
    const { monthlySavings, expectedReturn, retirementAge, currentAge, partTimeIncome, currentSavings } = inputs;
    const yearsToRetire = Math.max(1, retirementAge - currentAge);
    const annualSavings = monthlySavings * 12;

    const leanExpense = annualExpense * 0.6;
    const regularExpense = annualExpense;
    const fatExpense = annualExpense * 1.3;

    const leanFire = leanExpense * 25;
    const regularFire = regularExpense * multiplier;
    const fatFire = fatExpense * 33;

    const coastFire = regularFire / Math.pow(1 + expectedReturn / 100, yearsToRetire);
    const gap = Math.max(0, regularExpense - partTimeIncome * 12);
    const baristaFire = gap * 25;

    const yearsTo = (target: number): number => {
      if (target <= currentSavings) return 0;
      if (annualSavings <= 0 && currentSavings < target) return 99;
      let bal = currentSavings;
      for (let y = 1; y <= 80; y++) {
        bal = (bal + annualSavings) * (1 + expectedReturn / 100);
        if (bal >= target) return y;
      }
      return 99;
    };

    const inflRate = inputs.inflationRate / 100;
    const realOf = (nominal: number, years: number) =>
      years > 0 ? nominal / Math.pow(1 + inflRate, years) : nominal;

    return [
      { variant: 'lean' as const, label: 'Lean FIRE', desc: 'Essentials only (60% of current spending)', fireNumber: leanFire, monthlyExpense: Math.round(leanExpense / 12), yearsToFire: yearsTo(leanFire), color: '#22c55e', realValue: realOf(leanFire, yearsTo(leanFire)) },
      { variant: 'regular' as const, label: 'Regular FIRE', desc: `Current lifestyle (${multiplier}x annual expenses)`, fireNumber: regularFire, monthlyExpense: Math.round(regularExpense / 12), yearsToFire: yearsTo(regularFire), color: '#3b82f6', realValue: realOf(regularFire, yearsTo(regularFire)) },
      { variant: 'fat' as const, label: 'Fat FIRE', desc: 'Comfortable lifestyle (33x, 30% buffer)', fireNumber: fatFire, monthlyExpense: Math.round(fatExpense / 12), yearsToFire: yearsTo(fatFire), color: '#0d9488', realValue: realOf(fatFire, yearsTo(fatFire)) },
      { variant: 'coast' as const, label: 'Coast FIRE', desc: 'Invest this much NOW, stop contributing, retire on time', fireNumber: coastFire, monthlyExpense: 0, yearsToFire: currentSavings >= coastFire ? 0 : yearsTo(coastFire), color: '#f59e0b', realValue: realOf(coastFire, yearsTo(coastFire)) },
      { variant: 'barista' as const, label: 'Barista FIRE', desc: `Part-time income covers gap (${formatAmount(partTimeIncome, currency)}/mo)`, fireNumber: baristaFire, monthlyExpense: Math.round(gap / 12), yearsToFire: yearsTo(baristaFire), color: '#ec4899', realValue: realOf(baristaFire, yearsTo(baristaFire)) },
    ];
  }, [inputs, annualExpense, multiplier, currency]);

  const simpleScenarios = useMemo(
    () => scenarios.filter(s => s.variant === 'lean' || s.variant === 'regular' || s.variant === 'fat'),
    [scenarios]
  );

  const displayScenarios = mode === 'simple' ? simpleScenarios : scenarios;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
          {(['simple', 'advanced'] as ScenarioMode[]).map(m => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
                mode === m ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        {mode === 'simple' && autoMonthlySavings > 0 && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Monthly savings auto-set from your transactions ({formatAmount(autoMonthlySavings, currency)}/mo)
          </p>
        )}
      </div>

      <div className="card p-6">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">
          {mode === 'simple' ? 'Your FIRE Inputs' : 'What-If Parameters'}
        </h3>

        {mode === 'simple' ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { key: 'currentAge', label: 'Current Age', min: 18, max: 65, unit: 'years' },
              { key: 'retirementAge', label: 'Retirement Age', min: 30, max: 70, unit: 'years' },
              { key: 'currentSavings', label: 'Current Savings', min: 0, max: 500000000, unit: '' },
            ].map(({ key, label, min, max }) => (
              <div key={key}>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">{label}</label>
                <input
                  type="number" min={min} max={max}
                  value={inputs[key as keyof ScenarioInputs]}
                  onChange={e => set(key as keyof ScenarioInputs, Number(e.target.value))}
                  className="input-field w-full text-sm"
                />
                {key === 'currentSavings' && netWorthTotal !== null && (
                  <p className="text-xs text-brand-600 mt-1">
                    Net worth: {formatAmount(Math.round(netWorthTotal), currency)}
                  </p>
                )}
              </div>
            ))}
            <div className="sm:col-span-3 text-xs text-slate-500 dark:text-slate-500 bg-slate-50 dark:bg-slate-700 rounded-lg px-4 py-2">
              Using {defaults.returnRate}% return · {inputs.inflationRate.toFixed(1)}% inflation · monthly savings: {formatAmount(inputs.monthlySavings, currency)}/mo from your data.
              <button onClick={() => switchMode('advanced')} className="ml-2 text-brand-600 hover:underline">Customise &rarr;</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { key: 'currentAge', label: 'Current Age', min: 18, max: 65, step: 1, unit: 'yrs' },
              { key: 'retirementAge', label: 'Target Retirement Age', min: 30, max: 70, step: 1, unit: 'yrs' },
              { key: 'currentSavings', label: 'Current Savings/Investments', min: 0, max: 50000000, step: 50000, unit: '' },
              { key: 'monthlySavings', label: 'Monthly Savings', min: 0, max: 1000000, step: 5000, unit: '/mo' },
              { key: 'expectedReturn', label: 'Expected Annual Return', min: 4, max: 15, step: 0.5, unit: '%' },
              { key: 'inflationRate', label: 'Inflation Rate', min: 2, max: 12, step: 0.5, unit: '%' },
              { key: 'partTimeIncome', label: 'Part-Time Income (Barista)', min: 0, max: 500000, step: 5000, unit: '/mo' },
            ].map(({ key, label, min, max, step, unit }) => (
              <div key={key}>
                <div className="flex justify-between mb-1">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</label>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {key === 'currentSavings' || key === 'monthlySavings' || key === 'partTimeIncome'
                      ? formatAmount(inputs[key as keyof ScenarioInputs], currency)
                      : `${inputs[key as keyof ScenarioInputs]}${unit}`}
                  </span>
                </div>
                <input
                  type="range" min={min} max={max} step={step}
                  value={inputs[key as keyof ScenarioInputs]}
                  onChange={e => set(key as keyof ScenarioInputs, Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-brand-600"
                />
                {key === 'currentSavings' && netWorthTotal !== null && (
                  <p className="text-xs text-brand-600 mt-0.5">
                    Net worth: {formatAmount(Math.round(netWorthTotal), currency)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={`grid grid-cols-1 gap-4 ${mode === 'simple' ? 'md:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-3'}`}>
        {displayScenarios.map(s => (
          <div key={s.variant} className="card p-5 border-l-4" style={{ borderLeftColor: s.color }}>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">{s.label}</h4>
            <p className="text-xs text-slate-500 mb-3">{s.desc}</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{formatAmount(Math.round(s.fireNumber), currency)}</p>
            {s.yearsToFire > 0 && s.yearsToFire < 99 && (
              <p className="text-xs text-slate-500 mt-0.5">
                nominal · {formatAmount(Math.round(s.realValue), currency)} in today's money
                <InfoTooltip text="Nominal = future amount needed. 'Today's money' discounts inflation so you can compare to current prices." />
              </p>
            )}
            {s.variant !== 'coast' && (
              <p className="text-xs text-slate-500 mt-1">
                {formatAmount(s.monthlyExpense, currency)}/mo withdrawal
              </p>
            )}
            <div className="mt-3 flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                s.yearsToFire <= 10 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                s.yearsToFire <= 20 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' :
                'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
              }`}>
                {s.yearsToFire >= 99 ? 'Not reachable' : s.yearsToFire === 0 ? 'Already there!' : `${s.yearsToFire} years`}
              </span>
              {s.yearsToFire > 0 && s.yearsToFire < 99 && (
                <span className="text-xs text-slate-500">
                  (age {inputs.currentAge + s.yearsToFire})
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {mode === 'advanced' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700 text-xs text-slate-500 dark:text-slate-400 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Scenario</th>
                <th className="px-4 py-3 text-right">FIRE Number</th>
                <th className="px-4 py-3 text-right">
                  Real (Today's $)
                  <InfoTooltip text="FIRE number discounted by inflation over years to FIRE, expressed in today's purchasing power." />
                </th>
                <th className="px-4 py-3 text-right">Monthly Spend</th>
                <th className="px-4 py-3 text-right">Years to FIRE</th>
                <th className="px-4 py-3 text-right">Retirement Age</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {scenarios.map(s => (
                <tr key={s.variant} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                  <td className="px-4 py-3">
                    <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ backgroundColor: s.color }} />
                    <span className="font-medium text-slate-800 dark:text-slate-100">{s.label}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{formatAmount(Math.round(s.fireNumber), currency)}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-500 dark:text-slate-400 text-xs">
                    {s.yearsToFire > 0 && s.yearsToFire < 99 ? formatAmount(Math.round(s.realValue), currency) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{s.variant === 'coast' ? '—' : formatAmount(s.monthlyExpense, currency)}</td>
                  <td className="px-4 py-3 text-right font-bold">{s.yearsToFire >= 99 ? '—' : s.yearsToFire === 0 ? '✓' : s.yearsToFire}</td>
                  <td className="px-4 py-3 text-right">{s.yearsToFire >= 99 ? '—' : s.yearsToFire === 0 ? 'Now' : inputs.currentAge + s.yearsToFire}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
