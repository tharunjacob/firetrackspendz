import React, { useState } from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { formatAmount, CURRENCIES } from '@/utils/constants';
import { Currency } from '@/types';
import { useApp } from '@/contexts/AppContext';

interface Results {
  savingsRate: number;
  monthlySavings: number;
  annualSavings: number;
  interpretation: { label: string; color: string; description: string };
}

const getInterpretation = (rate: number) => {
  if (rate < 0) {
    return {
      label: 'Negative',
      color: 'text-red-600',
      description: 'You are spending more than you earn. Review your expenses to find areas to cut back.',
    };
  }
  if (rate < 10) {
    return {
      label: 'Needs Improvement',
      color: 'text-red-500',
      description:
        'A savings rate below 10% leaves little room for emergencies or long-term goals. Try to reduce discretionary spending.',
    };
  }
  if (rate < 25) {
    return {
      label: 'Good',
      color: 'text-yellow-600',
      description:
        'You are saving at a solid rate. Keep it up and look for opportunities to increase it further.',
    };
  }
  if (rate < 50) {
    return {
      label: 'Great \u2014 On FIRE Track',
      color: 'text-green-600',
      description:
        'Excellent! A 25-50% savings rate puts you firmly on the path to financial independence.',
    };
  }
  return {
    label: 'Exceptional',
    color: 'text-emerald-600',
    description:
      'Outstanding savings rate! At this pace you could reach financial independence in under 15 years.',
  };
};

const NATIONAL_AVG = 5;
const FIRE_COMMUNITY_AVG = 40;

const SavingsRateTool: React.FC = () => {
  const { currency: appCurrency } = useApp();

  usePageMeta({
    title: 'Savings Rate Calculator \u2014 Are You On Track? | TrackSpendZ',
    description:
      'Free savings rate calculator. Enter your income and expenses to see your savings rate and how it compares. Essential for FIRE planning.',
    canonical: '/tools/savings-rate',
  });

  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [monthlyExpenses, setMonthlyExpenses] = useState('');
  const [currency, setCurrency] = useState<Currency>(() => (appCurrency as Currency) || 'USD');
  const [results, setResults] = useState<Results | null>(null);

  const placeholders = {
    INR: { income: 'e.g. 75,000', expenses: 'e.g. 50,000' },
    JPY: { income: 'e.g. 350,000', expenses: 'e.g. 220,000' },
    GBP: { income: 'e.g. 4,000', expenses: 'e.g. 2,500' },
    EUR: { income: 'e.g. 4,000', expenses: 'e.g. 2,500' },
    SGD: { income: 'e.g. 6,000', expenses: 'e.g. 4,000' },
    AUD: { income: 'e.g. 7,000', expenses: 'e.g. 4,500' },
    CAD: { income: 'e.g. 6,500', expenses: 'e.g. 4,000' },
    AED: { income: 'e.g. 18,000', expenses: 'e.g. 11,000' },
    USD: { income: 'e.g. 5,000', expenses: 'e.g. 3,000' },
  } as const;
  const ph = placeholders[currency] ?? placeholders.USD;

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();

    const income = parseFloat(monthlyIncome) || 0;
    const expenses = parseFloat(monthlyExpenses) || 0;

    if (income <= 0) return;

    const monthlySavings = income - expenses;
    const savingsRate = (monthlySavings / income) * 100;
    const annualSavings = monthlySavings * 12;
    const interpretation = getInterpretation(savingsRate);

    setResults({ savingsRate, monthlySavings, annualSavings, interpretation });
  };

  const inputClass =
    'w-full rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2.5 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-700 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 outline-none transition-colors';
  const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1';

  // For the benchmark bar, clamp display between 0 and 100
  const barPosition = results ? Math.max(0, Math.min(100, results.savingsRate)) : 0;

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-600 to-brand-800 text-white py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">Savings Rate Calculator</h1>
          <p className="text-lg text-white/80">
            Find out how much you save and how it compares to national and FIRE community averages
          </p>
        </div>
      </section>

      {/* Calculator */}
      <section className="max-w-3xl mx-auto px-4 py-12">
        <form
          onSubmit={handleCalculate}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 sm:p-8 space-y-5"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="monthlyIncome" className={labelClass}>
                Monthly Income
              </label>
              <input
                id="monthlyIncome"
                type="number"
                min="0"
                className={inputClass}
                placeholder={ph.income}
                value={monthlyIncome}
                onChange={(e) => setMonthlyIncome(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="monthlyExpenses" className={labelClass}>
                Monthly Expenses
              </label>
              <input
                id="monthlyExpenses"
                type="number"
                min="0"
                className={inputClass}
                placeholder={ph.expenses}
                value={monthlyExpenses}
                onChange={(e) => setMonthlyExpenses(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="max-w-xs">
            <label htmlFor="currency" className={labelClass}>
              Currency
            </label>
            <select
              id="currency"
              className={inputClass}
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
            >
              {(Object.keys(CURRENCIES) as Currency[]).map((c) => (
                <option key={c} value={c}>
                  {CURRENCIES[c].symbol} {c} - {CURRENCIES[c].name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            Calculate Savings Rate
          </button>
        </form>

        {/* Results */}
        {results && (
          <div className="mt-10 space-y-8">
            {/* Primary results */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Savings Rate</p>
                <p className="text-3xl font-bold text-brand-600">
                  {results.savingsRate.toFixed(1)}%
                </p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Monthly Savings</p>
                <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                  {formatAmount(results.monthlySavings, currency)}
                </p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Annual Savings</p>
                <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                  {formatAmount(results.annualSavings, currency)}
                </p>
              </div>
            </div>

            {/* Interpretation */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Assessment</p>
              <p className={`text-2xl font-bold mb-2 ${results.interpretation.color}`}>
                {results.interpretation.label}
              </p>
              <p className="text-slate-600 dark:text-slate-400">{results.interpretation.description}</p>
            </div>

            {/* Benchmark comparison bar */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
                How You Compare
              </h2>
              <div className="relative h-8 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                {/* Filled bar */}
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-brand-400 to-brand-600 rounded-full transition-all duration-500"
                  style={{ width: `${barPosition}%` }}
                />
              </div>

              {/* Markers */}
              <div className="relative mt-2 h-16">
                {/* National average marker */}
                <div
                  className="absolute flex flex-col items-center"
                  style={{ left: `${NATIONAL_AVG}%`, transform: 'translateX(-50%)' }}
                >
                  <div className="w-0.5 h-3 bg-red-400" />
                  <span className="text-xs text-red-500 font-medium whitespace-nowrap mt-0.5">
                    National Avg ({NATIONAL_AVG}%)
                  </span>
                </div>

                {/* FIRE community marker */}
                <div
                  className="absolute flex flex-col items-center"
                  style={{ left: `${FIRE_COMMUNITY_AVG}%`, transform: 'translateX(-50%)' }}
                >
                  <div className="w-0.5 h-3 bg-green-500" />
                  <span className="text-xs text-green-600 font-medium whitespace-nowrap mt-0.5">
                    FIRE Avg ({FIRE_COMMUNITY_AVG}%)
                  </span>
                </div>

                {/* User marker */}
                <div
                  className="absolute flex flex-col items-center"
                  style={{ left: `${barPosition}%`, transform: 'translateX(-50%)' }}
                >
                  <div className="w-0.5 h-3 bg-brand-600" />
                  <span className="text-xs text-brand-700 font-semibold whitespace-nowrap mt-0.5">
                    You ({results.savingsRate.toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-12 bg-gradient-to-br from-brand-50 dark:from-brand-950 to-purple-50 dark:to-purple-900/20 rounded-2xl border border-brand-200 dark:border-brand-800 p-8 text-center">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
            Track your savings rate automatically from bank statements
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Upload your bank or credit card statements and TrackSpendZ will calculate your real
            savings rate with AI-powered categorization.
          </p>
          <Link
            to={ROUTES.DASHBOARD}
            className="inline-block bg-brand-600 hover:bg-brand-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
          >
            Try TrackSpendZ Free
          </Link>
        </div>
      </section>
    </main>
  );
};

export default SavingsRateTool;
