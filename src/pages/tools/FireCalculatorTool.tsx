import React, { useState, useEffect } from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { formatAmount, CURRENCIES } from '@/utils/constants';
import { Currency } from '@/types';
import { useApp } from '@/contexts/AppContext';

interface Results {
  fireNumber: number;
  yearsToFire: number;
  savingsRate: number;
  monthlySavings: number;
  leanFire: number;
  regularFire: number;
  fatFire: number;
}

const FAQ_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is the FIRE number?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Your FIRE number is the amount of money you need invested so that the returns cover your annual expenses. It is typically calculated as your annual expenses multiplied by 25, based on the 4% safe withdrawal rate.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is the difference between Lean FIRE, Regular FIRE, and Fat FIRE?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Lean FIRE covers only essential expenses (roughly 60% of current spending). Regular FIRE covers your full current expenses. Fat FIRE provides a larger cushion, covering about 133% of your current expenses, for a more comfortable retirement.',
      },
    },
    {
      '@type': 'Question',
      name: 'What withdrawal rate should I use?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The most commonly used withdrawal rate is 4%, based on the Trinity Study. Conservative planners may use 3.5% or 3%, while more aggressive planners might use 4.5%. The right rate depends on your risk tolerance and retirement timeline.',
      },
    },
    {
      '@type': 'Question',
      name: 'How accurate is this FIRE calculator?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'This calculator provides a useful estimate based on constant returns and expenses. Real-world factors like inflation, market volatility, tax changes, and lifestyle shifts will affect your actual timeline. Use it as a starting point for planning.',
      },
    },
  ],
};

const FireCalculatorTool: React.FC = () => {
  const { currency: appCurrency } = useApp();

  usePageMeta({
    title: 'FIRE Calculator \u2014 When Can I Retire? | TrackSpendZ',
    description:
      'Free FIRE calculator. Enter your income, expenses, and savings to find out when you can achieve financial independence. Supports Coast FIRE, Lean FIRE, and Fat FIRE.',
    canonical: '/tools/fire-calculator',
  });

  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [monthlyExpenses, setMonthlyExpenses] = useState('');
  const [currentSavings, setCurrentSavings] = useState('');
  const [expectedReturn, setExpectedReturn] = useState('8');
  const [withdrawalRate, setWithdrawalRate] = useState('4');
  const [currency, setCurrency] = useState<Currency>(() => (appCurrency as Currency) || 'USD');
  const [results, setResults] = useState<Results | null>(null);

  // Currency-appropriate example values for placeholders
  const placeholders = {
    INR: { income: 'e.g. 75,000', expenses: 'e.g. 50,000', savings: 'e.g. 5,00,000' },
    JPY: { income: 'e.g. 350,000', expenses: 'e.g. 220,000', savings: 'e.g. 30,00,000' },
    GBP: { income: 'e.g. 4,000', expenses: 'e.g. 2,500', savings: 'e.g. 40,000' },
    EUR: { income: 'e.g. 4,000', expenses: 'e.g. 2,500', savings: 'e.g. 40,000' },
    SGD: { income: 'e.g. 6,000', expenses: 'e.g. 4,000', savings: 'e.g. 60,000' },
    AUD: { income: 'e.g. 7,000', expenses: 'e.g. 4,500', savings: 'e.g. 70,000' },
    CAD: { income: 'e.g. 6,500', expenses: 'e.g. 4,000', savings: 'e.g. 65,000' },
    AED: { income: 'e.g. 18,000', expenses: 'e.g. 11,000', savings: 'e.g. 1,80,000' },
    USD: { income: 'e.g. 5,000', expenses: 'e.g. 3,000', savings: 'e.g. 50,000' },
  } as const;
  const ph = placeholders[currency] ?? placeholders.USD;

  // Inject JSON-LD
  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'fire-faq-jsonld';
    script.textContent = JSON.stringify(FAQ_JSON_LD);
    document.head.appendChild(script);
    return () => {
      const el = document.getElementById('fire-faq-jsonld');
      if (el) el.remove();
    };
  }, []);

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();

    const income = parseFloat(monthlyIncome) || 0;
    const expenses = parseFloat(monthlyExpenses) || 0;
    const savings = parseFloat(currentSavings) || 0;
    const annualReturn = (parseFloat(expectedReturn) || 8) / 100;
    const wr = (parseFloat(withdrawalRate) || 4) / 100;

    if (income <= 0 || expenses <= 0) return;

    const annualExpenses = expenses * 12;
    const monthlySavings = income - expenses;
    const savingsRate = (monthlySavings / income) * 100;

    const fireNumber = annualExpenses / wr;
    const leanFire = (annualExpenses * 0.6) / wr;
    const fatFire = annualExpenses / 0.03; // ~33x expenses

    // Years to FIRE using future value of annuity + current savings growth
    // FV = savings * (1+r)^n + monthlySavings * ((1+r)^n - 1) / r  where r is monthly
    let yearsToFire = 0;
    if (monthlySavings <= 0) {
      yearsToFire = Infinity;
    } else {
      const monthlyReturn = annualReturn / 12;
      const targetAmount = fireNumber;
      // Iterative approach for accuracy
      let balance = savings;
      let months = 0;
      while (balance < targetAmount && months < 1200) {
        balance = balance * (1 + monthlyReturn) + monthlySavings;
        months++;
      }
      yearsToFire = months >= 1200 ? 99 : months / 12;
    }

    setResults({
      fireNumber,
      yearsToFire,
      savingsRate,
      monthlySavings,
      leanFire,
      regularFire: fireNumber,
      fatFire,
    });
  };

  const inputClass =
    'w-full rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2.5 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-700 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 outline-none transition-colors';
  const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1';

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-600 to-brand-800 text-white py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">FIRE Calculator</h1>
          <p className="text-lg text-white/80">
            Find out when you can achieve Financial Independence, Retire Early
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
            <div>
              <label htmlFor="currentSavings" className={labelClass}>
                Current Savings / Investments
              </label>
              <input
                id="currentSavings"
                type="number"
                min="0"
                className={inputClass}
                placeholder={ph.savings}
                value={currentSavings}
                onChange={(e) => setCurrentSavings(e.target.value)}
                required
              />
            </div>
            <div>
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
            <div>
              <label htmlFor="expectedReturn" className={labelClass}>
                Expected Annual Return (%)
              </label>
              <input
                id="expectedReturn"
                type="number"
                step="0.1"
                min="0"
                max="30"
                className={inputClass}
                value={expectedReturn}
                onChange={(e) => setExpectedReturn(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="withdrawalRate" className={labelClass}>
                Safe Withdrawal Rate (%)
              </label>
              <input
                id="withdrawalRate"
                type="number"
                step="0.1"
                min="1"
                max="10"
                className={inputClass}
                value={withdrawalRate}
                onChange={(e) => setWithdrawalRate(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            Calculate My FIRE Number
          </button>
        </form>

        {/* Results */}
        {results && (
          <div className="mt-10 space-y-8">
            {/* Primary results */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">FIRE Number</p>
                <p className="text-3xl font-bold text-brand-600">
                  {formatAmount(results.fireNumber, currency)}
                </p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Years to FIRE</p>
                <p className="text-3xl font-bold text-brand-600">
                  {results.yearsToFire === Infinity
                    ? 'Never'
                    : results.yearsToFire >= 99
                    ? '99+'
                    : results.yearsToFire.toFixed(1)}
                </p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Savings Rate</p>
                <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                  {results.savingsRate.toFixed(1)}%
                </p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Monthly Savings</p>
                <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                  {formatAmount(results.monthlySavings, currency)}
                </p>
              </div>
            </div>

            {/* FIRE Variants */}
            <div>
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-4">FIRE Variants</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-green-200 dark:border-green-800 p-6 text-center">
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Lean FIRE</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Essential expenses only (60%)</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatAmount(results.leanFire, currency)}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-brand-200 dark:border-brand-800 p-6 text-center">
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Regular FIRE</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Full current expenses (25x)</p>
                  <p className="text-2xl font-bold text-brand-600">
                    {formatAmount(results.regularFire, currency)}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-brand-200 dark:border-brand-800 p-6 text-center">
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Fat FIRE</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Comfortable cushion (33x)</p>
                  <p className="text-2xl font-bold text-brand-600">
                    {formatAmount(results.fatFire, currency)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-12 bg-brand-50 dark:bg-brand-950 rounded-2xl border border-brand-200 dark:border-brand-800 p-8 text-center">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
            Want AI-powered analysis from your actual bank statements?
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Upload your statements and get personalized FIRE projections, spending breakdowns, and
            actionable insights.
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

export default FireCalculatorTool;
