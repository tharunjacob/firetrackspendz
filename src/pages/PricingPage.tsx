import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthModal } from '@/components/auth/AuthModal';
import { Icon } from '@/components/common/Icons';
import { logEvent, EVENTS } from '@/services/logger';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useLocalPricing } from '@/hooks/useLocalPricing';
import { useApp } from '@/contexts/AppContext';
import { upgrade, isPaymentAvailable } from '@/services/paymentProvider';
import { getSupabase } from '@/services/supabase';
import { ROUTES } from '@/config/routes';
import { getMaxYearlySavingsPercent, type BillingPeriod } from '@/config/plans';

const PricingPage = () => {
  const [showAuth, setShowAuth] = useState(false);
  const [upgrading, setUpgrading] = useState<null | 'pro' | 'enterprise'>(null);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('yearly');
  const pricing = useLocalPricing();
  const navigate = useNavigate();
  const { user, profile, showToast } = useApp();

  const handleUpgrade = async (targetPlan: 'pro' | 'enterprise') => {
    if (!user) return;
    if (!isPaymentAvailable()) {
      showToast?.('Payments are being set up — please try again soon.', 'error');
      return;
    }
    setUpgrading(targetPlan);
    try {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const result = await upgrade({
        tier: targetPlan,
        currency: pricing.currency,
        period: billingPeriod,
        accessToken: session.access_token,
        user: {
          id: user.id,
          email: user.email,
          name: profile?.full_name,
        },
      });

      if (result.success) {
        logEvent(EVENTS.UPGRADE_CLICKED, { plan: targetPlan, period: billingPeriod, status: 'success' });
        window.location.href = `/dashboard?payment=success&plan=${targetPlan}`;
      } else if (result.dismissed) {
        // Silent — user closed the modal intentionally.
      } else {
        showToast?.(result.error || 'Upgrade failed', 'error');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upgrade failed';
      showToast?.(msg, 'error');
    } finally {
      setUpgrading(null);
    }
  };

  useEffect(() => { logEvent(EVENTS.PRICING_PAGE_VIEWED); }, []);

  usePageMeta({
    title: 'Pricing — Free Forever, Pro | TrackSpendZ',
    description: 'Compare TrackSpendZ plans. Free forever with basic tracking, Pro with AI advisor and FIRE calculator, Enterprise with family accounts.',
    canonical: '/pricing',
  });

  const proTier = pricing.pro[billingPeriod];
  const maxYearlySavings = getMaxYearlySavingsPercent(pricing.currency);

  const plans = [
    {
      key: 'free' as const,
      name: 'Free',
      price: pricing.isIndia ? '₹0' : '$0',
      period: 'forever',
      sub: null,
      desc: 'Perfect for getting started with expense tracking.',
      features: [
        'Upload up to 500 transactions',
        'Basic categorization (150+ patterns)',
        'Monthly & category breakdowns',
        'Multi-file upload supported',
        'Local storage (your device)',
      ],
      cta: 'Start Free',
      popular: false,
    },
    {
      key: 'pro' as const,
      name: 'Pro',
      price: proTier.price,
      period: proTier.period,
      sub: proTier.sub,
      desc: 'For individuals serious about financial independence.',
      features: [
        'Unlimited transactions',
        'AI-powered insights & chat advisor',
        'FIRE calculator & projections',
        'Net worth tracking',
        'Budget tracker with alerts',
        'Multi-account support',
        'Cloud sync across devices',
        'Trend analysis & anomaly detection',
        'Priority support',
      ],
      cta: 'Get Pro',
      popular: true,
    },
    {
      key: 'enterprise' as const,
      name: 'Enterprise',
      price: 'Coming Soon',
      period: '',
      sub: null,
      desc: 'For families and power users.',
      features: [
        'Everything in Pro',
        'Household profiles (up to 5 profiles)',
        'Consolidated budgets & goals',
        'Custom category rules engine',
        'CSV & JSON data exports',
        'Dedicated support',
        'Custom categories & rules',
      ],
      cta: 'Coming Soon',
      popular: false,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-16 text-center">
        <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">Simple, Transparent Pricing</h1>
        <p className="text-lg text-slate-500 dark:text-slate-400 max-w-xl mx-auto mb-8">
          Start free. Upgrade when you need AI insights, cloud sync, and advanced features.
        </p>

        {/* Monthly / Yearly toggle */}
        <div className="inline-flex items-center bg-slate-200 dark:bg-slate-800 rounded-full p-1 mb-12">
          <button
            onClick={() => setBillingPeriod('monthly')}
            aria-pressed={billingPeriod === 'monthly'}
            className={`px-5 py-2 text-sm font-semibold rounded-full transition-all ${
              billingPeriod === 'monthly'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingPeriod('yearly')}
            aria-pressed={billingPeriod === 'yearly'}
            className={`px-5 py-2 text-sm font-semibold rounded-full transition-all flex items-center gap-2 ${
              billingPeriod === 'yearly'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Yearly
            <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded">Save up to {maxYearlySavings}%</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map(plan => (
            <div key={plan.key} className={`card p-6 relative flex flex-col ${
              plan.popular ? 'border-2 border-brand-500 shadow-xl shadow-brand-100/50 dark:shadow-brand-900/30' : ''
            } ${
              plan.key === 'enterprise' ? 'border border-dashed border-slate-300 dark:border-slate-700 opacity-90' : ''
            }`}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                  Most Popular
                </div>
              )}
              {plan.key === 'enterprise' && (
                <div className="absolute top-3 right-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded">
                  Coming Soon
                </div>
              )}
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-1">{plan.name}</h3>
              <div className="mb-1">
                <span className="text-4xl font-bold text-slate-900 dark:text-slate-100">{plan.price}</span>
                {plan.period && <span className="text-slate-500 dark:text-slate-400 text-sm">{plan.period}</span>}
              </div>
              {plan.sub && (
                <p className="text-xs text-brand-600 font-medium mb-3">{plan.sub}</p>
              )}
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{plan.desc}</p>

              <ul className="space-y-3 mb-8 flex-1 text-left">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Icon name="check" className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                disabled={plan.key === 'enterprise' || !!upgrading}
                onClick={() => {
                  if (plan.key === 'enterprise') return;
                  logEvent(EVENTS.UPGRADE_CLICKED, { plan: plan.key, period: billingPeriod, cta: plan.cta });
                  if (plan.key === 'free') {
                    navigate(ROUTES.DASHBOARD);
                  } else if (!user) {
                    setShowAuth(true);
                  } else {
                    handleUpgrade(plan.key);
                  }
                }}
                className={`w-full py-3 rounded-lg font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                  plan.key === 'enterprise'
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                    : plan.popular
                    ? 'bg-brand-600 text-white hover:bg-brand-700'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {upgrading === plan.key ? 'Opening checkout...' : plan.cta}
              </button>
            </div>
          ))}
        </div>

        <p className="mt-8 text-xs text-slate-400 dark:text-slate-500 max-w-lg mx-auto leading-relaxed">
          🔒 Payments are securely processed via Razorpay. Your bank statement or card transaction descriptor will show charges under the name <strong>"Krexo LLP"</strong> (the parent entity behind TrackSpendZ).
        </p>

      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 text-center mb-8">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {[
            { q: 'Can I try the app before signing up?', a: 'Yes! You can upload a statement and explore your full dashboard without an account. Sign up free to unlock cloud sync and save your data across devices. No credit card required.' },
            { q: 'Which banks do you support?', a: 'Any bank that lets you download statements as CSV, Excel, or PDF. We support 150+ column formats and AI-powered mapping for new formats.' },
            { q: 'Is my financial data safe?', a: 'Your data is secure. In transit, data is encrypted using HTTPS/SSL. Cloud data is stored securely on Supabase with row-level security so only you can access it. Free users store data locally on their device\'s IndexedDB.' },
            { q: 'Can I cancel anytime?', a: 'Absolutely. Cancel your subscription anytime from Settings → Subscription. You keep Pro features until the end of your current billing period.' },
            { q: 'What payment methods do you accept?', a: 'Razorpay supports UPI, credit/debit cards (Visa, Mastercard, RuPay, AMEX), net banking, and wallets in India. International cards are accepted and billed in INR.' },
            { q: 'Do you sell my data?', a: 'Never. Your financial data is yours. We don\'t sell, share, or use your data for advertising. Period.' },
          ].map(faq => (
            <details key={faq.q} className="card p-5 group">
              <summary className="font-semibold text-slate-700 dark:text-slate-200 cursor-pointer list-none flex items-center justify-between">
                {faq.q}
                <svg className="w-5 h-5 text-slate-500 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="text-center pb-12">
        <Link to="/" className="text-sm text-brand-600 hover:underline">&larr; Back to Home</Link>
      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
};

export default PricingPage;
