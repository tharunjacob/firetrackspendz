import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Logo, Icon } from '@/components/common/Icons';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useLocalPricing } from '@/hooks/useLocalPricing';

const LandingPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pricing = useLocalPricing();

  usePageMeta({
    title: 'TrackSpendZ — See Exactly Where Your Money Goes',
    description: 'Upload your bank statement and get instant spending insights, auto-categorization, FIRE planning, and AI-powered advice. No signup needed. Works with any bank.',
    canonical: '/',
  });

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) localStorage.setItem('tsz_referral_code', ref);
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 dark:from-slate-900 via-white dark:via-slate-900 to-brand-50 dark:to-brand-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-12 sm:pt-24 sm:pb-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* Left — copy */}
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300 px-4 py-1.5 rounded-full text-sm font-medium mb-6 border border-brand-100 dark:border-brand-800">
                <span className="w-2 h-2 bg-brand-500 rounded-full animate-pulse" />
                No signup required · Free to start
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-bold text-slate-900 dark:text-slate-100 leading-[1.1] mb-5">
                See exactly where<br />
                <span className="text-gradient">your money goes</span>
              </h1>

              <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-400 leading-relaxed mb-8 max-w-lg mx-auto lg:mx-0">
                Upload your bank statement. Get instant spending insights.{' '}
                <strong className="text-slate-800 dark:text-slate-200 font-semibold">No signup needed.</strong>
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mb-8">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="btn-primary text-base px-8 py-3.5 shadow-md shadow-brand-200/60 w-full sm:w-auto"
                >
                  Upload Your Statement — Free
                </button>
              </div>

              {/* Trust badges */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Icon name="shield" className="w-4 h-4 text-green-500" />
                  Secure cloud storage (SSL & RLS)
                </span>
                <span className="flex items-center gap-1.5">
                  <Icon name="shield" className="w-4 h-4 text-green-500" />
                  Your data stays private
                </span>
              </div>
            </div>

            {/* Right — dashboard mockup */}
            <div id="demo" className="relative mx-auto w-full max-w-lg">
              <div className="absolute -inset-4 bg-brand-100 rounded-2xl blur-2xl opacity-60" />
              <div className="relative rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden bg-white dark:bg-slate-800">
                {/* Browser chrome */}
                <div className="bg-slate-800 px-4 py-2.5 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                    <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 mx-3 bg-slate-700 rounded text-xs text-slate-500 px-2 py-0.5">
                    trackspendz.com/dashboard
                  </div>
                </div>

                {/* Dashboard content */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-900 space-y-3">
                  {/* Metric cards */}
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { label: 'Monthly Spend', value: '₹42,380', sub: '↑ 8% vs last mo', subColor: 'text-red-500' },
                      { label: 'Savings Rate', value: '34%', sub: '↑ On track!', subColor: 'text-green-600' },
                      { label: 'FIRE Progress', value: '18%', sub: '₹4.2L / ₹23L', subColor: 'text-slate-500' },
                    ].map(m => (
                      <div key={m.label} className="bg-white dark:bg-slate-800 rounded-lg p-2.5 shadow-sm border border-slate-100 dark:border-slate-700">
                        <p className="text-[10px] text-slate-500 mb-0.5">{m.label}</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{m.value}</p>
                        <p className={`text-[10px] ${m.subColor}`}>{m.sub}</p>
                      </div>
                    ))}
                  </div>

                  {/* Spending chart */}
                  <div className="bg-white dark:bg-slate-800 rounded-lg p-3 shadow-sm border border-slate-100 dark:border-slate-700">
                    <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-2.5">Spending by Category</p>
                    <div className="flex items-center gap-3">
                      <svg viewBox="0 0 36 36" className="w-20 h-20 flex-shrink-0 -rotate-90">
                        <circle cx="18" cy="18" r="14" fill="none" stroke="#dbeafe" strokeWidth="4" />
                        <circle cx="18" cy="14" r="14" fill="none" stroke="#2563eb" strokeWidth="4"
                          strokeDasharray="30.8 57.8" strokeDashoffset="0" />
                        <circle cx="18" cy="14" r="14" fill="none" stroke="#93c5fd" strokeWidth="4"
                          strokeDasharray="17.3 71.3" strokeDashoffset="-30.8" />
                        <circle cx="18" cy="14" r="14" fill="none" stroke="#22c55e" strokeWidth="4"
                          strokeDasharray="12.3 76.3" strokeDashoffset="-48.1" />
                        <circle cx="18" cy="14" r="14" fill="none" stroke="#fbbf24" strokeWidth="4"
                          strokeDasharray="9.7 78.9" strokeDashoffset="-60.4" />
                      </svg>
                      <div className="space-y-1.5 flex-1 min-w-0">
                        {[
                          { dot: 'bg-brand-600', label: 'Food & Dining', pct: '35%' },
                          { dot: 'bg-brand-300', label: 'Shopping', pct: '20%' },
                          { dot: 'bg-green-500', label: 'Transport', pct: '15%' },
                          { dot: 'bg-amber-400', label: 'Entertainment', pct: '12%' },
                        ].map(c => (
                          <div key={c.label} className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 flex-1 truncate">{c.label}</span>
                            <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-200">{c.pct}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Recent transactions */}
                  <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                    <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 px-3 py-2 border-b border-slate-50 dark:border-slate-700">
                      Recent Transactions
                    </p>
                    {[
                      { name: 'Swiggy', cat: 'Food & Dining', amt: '−₹485', amtColor: 'text-red-500' },
                      { name: 'Amazon', cat: 'Shopping', amt: '−₹1,299', amtColor: 'text-red-500' },
                      { name: 'Salary', cat: 'Income', amt: '+₹65,000', amtColor: 'text-green-600' },
                    ].map((tx, i) => (
                      <div key={i} className="flex items-center px-3 py-1.5 border-b border-slate-50 dark:border-slate-700 last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium text-slate-800 dark:text-slate-100">{tx.name}</p>
                          <p className="text-[10px] text-slate-500">{tx.cat}</p>
                        </div>
                        <p className={`text-[11px] font-semibold ${tx.amtColor}`}>{tx.amt}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
      <section className="bg-white dark:bg-slate-900 py-20 border-t border-slate-100 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">Up and running in 60 seconds</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-14">No account. No setup. Just results.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connector line (desktop only) */}
            <div className="hidden md:block absolute top-8 left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] h-px bg-gradient-to-r from-brand-200 via-brand-300 to-brand-200" />

            {[
              {
                icon: 'upload',
                step: '01',
                title: 'Upload your statement',
                desc: 'Drop any file from any bank — Excel, CSV, or PDF. Indian and international banks all work.',
              },
              {
                icon: 'ai',
                step: '02',
                title: 'AI categorizes everything',
                desc: '150+ merchants recognized automatically. Corrections you make teach it your personal patterns.',
              },
              {
                icon: 'chart',
                step: '03',
                title: 'Explore your insights',
                desc: 'Spending breakdowns, trends, budgets, FIRE number — 15 dashboards ready instantly.',
              },
            ].map(s => (
              <div key={s.step} className="relative flex flex-col items-center">
                <div className="relative z-10 w-16 h-16 bg-brand-600 text-white rounded-2xl flex items-center justify-center mb-5 shadow-md shadow-brand-200/50">
                  <Icon name={s.icon} className="w-7 h-7" />
                </div>
                <div className="text-xs font-bold text-brand-400 mb-1 tracking-widest">{s.step}</div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">{s.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs">{s.desc}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => navigate('/dashboard')}
            className="btn-primary mt-12 text-base px-8 py-3 shadow-md shadow-brand-200/50"
          >
            Try It Now — No Signup
          </button>
        </div>
      </section>

      {/* ── FEATURE HIGHLIGHTS ───────────────────────────────────────── */}
      <section className="bg-slate-50 dark:bg-slate-800 py-20 border-t border-slate-100 dark:border-slate-700">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">Built for serious money management</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
              Not just pie charts. TrackSpendZ gives you the full picture — across months, accounts, and life goals.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: 'ai',
                color: 'bg-brand-50 dark:bg-brand-950 text-brand-600',
                title: 'Smart categorization that learns',
                desc: 'Correct a category once and TrackSpendZ remembers it forever. Over time it becomes tuned to your exact spending habits.',
              },
              {
                icon: 'fire',
                color: 'bg-orange-50 dark:bg-orange-900/20 text-orange-500',
                title: 'FIRE calculator with Monte Carlo',
                desc: 'Input your savings rate and investments. Get a probabilistic range of retirement dates — not just one optimistic number.',
              },
              {
                icon: 'wallet',
                color: 'bg-green-50 dark:bg-green-900/20 text-green-600',
                title: 'Works with any bank',
                desc: 'HDFC, SBI, ICICI, Axis, or international banks — upload any exported statement and columns are auto-detected.',
              },
              {
                icon: 'chart',
                color: 'bg-brand-50 dark:bg-brand-900/20 text-brand-600',
                title: 'Multiple accounts, one view',
                desc: 'Merge statements from all your banks and cards. See your complete financial picture in a single dashboard.',
              },
              {
                icon: 'flash',
                color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600',
                title: 'AI financial advisor',
                desc: 'Chat with Gemini about your actual transactions. Ask "where can I cut spending?" and get answers grounded in your data.',
              },
            ].map(f => (
              <div key={f.title} className="card p-6 hover:shadow-md transition-shadow">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${f.color}`}>
                  <Icon name={f.icon} className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}

            {/* CTA card */}
            <div className="card p-6 bg-brand-600 text-white flex flex-col justify-between">
              <div>
                <p className="text-sm font-semibold text-brand-200 mb-2">And much more</p>
                <p className="text-base font-bold mb-2">15 dashboards total</p>
                <p className="text-sm text-brand-100">Net worth, goals, budgets, recurring charges, year-in-review, and more.</p>
              </div>
              <Link to="/features" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-white underline underline-offset-2">
                See all features →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── VS CHATGPT ───────────────────────────────────────────────── */}
      <section className="bg-white dark:bg-slate-900 py-20 border-t border-slate-100 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">
              Built for your finances, not a blank chat box
            </h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
              AI chat is great for quick questions. TrackSpendZ remembers every
              statement and turns it into a system you can act on.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5 mb-10">
            {/* TrackSpendZ side — lead with what we do */}
            <div className="rounded-2xl border-2 border-brand-500 p-6 relative">
              <div className="absolute -top-3 left-6 bg-brand-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                Built for this
              </div>
              <div className="flex items-center gap-3 mb-5">
                <Logo size="sm" />
              </div>
              <ul className="space-y-3">
                {[
                  'Upload once — all history is always there',
                  'Learns your patterns over months',
                  '15 dashboards with interactive charts',
                  'Advice grounded in your actual transactions',
                  'Gets smarter with every correction you make',
                ].map(item => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-200">
                    <Icon name="check" className="w-4 h-4 text-brand-500 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Generic AI chat side */}
            <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                  <Icon name="ai" className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                </div>
                <span className="font-bold text-slate-700 dark:text-slate-200">A generic AI chat</span>
              </div>
              <ul className="space-y-3">
                {[
                  'Paste your data manually every single time',
                  "No memory of last month's conversation",
                  'No charts, no visual breakdowns',
                  'Generic advice, not based on your patterns',
                  'Starts from zero each session',
                ].map(item => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-slate-500 dark:text-slate-400">
                    <Icon name="close" className="w-4 h-4 text-slate-300 dark:text-slate-600 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="text-center text-slate-600 dark:text-slate-400 font-medium text-lg">
            Free AI models give you a snapshot.{' '}
            <span className="text-gradient font-bold">TrackSpendZ gives you a system.</span>
          </p>
        </div>
      </section>

      {/* ── PRICING PREVIEW ──────────────────────────────────────────── */}
      <section className="bg-slate-50 dark:bg-slate-800 py-20 border-t border-slate-100 dark:border-slate-700">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">Start free, upgrade when you're ready</h2>
            <p className="text-slate-500 dark:text-slate-400">No credit card needed to get started.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
            {/* Free */}
            <div className="card p-6">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Free</p>
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-1">₹0</div>
              <p className="text-xs text-slate-500 mb-5">Forever free</p>
              <ul className="space-y-2 mb-6">
                {['Up to 500 transactions', 'Unlimited file uploads', 'Core dashboards (5 views)', 'Local storage only'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Icon name="check" className="w-4 h-4 text-green-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button onClick={() => navigate('/dashboard')} className="btn-secondary w-full text-sm py-2.5">
                Get started
              </button>
            </div>

            {/* Pro */}
            <div className="card p-6 border-2 border-brand-500 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                Most popular
              </div>
              <p className="text-xs font-bold text-brand-500 uppercase tracking-widest mb-3">Pro</p>
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-1">{pricing.pro.price}<span className="text-base font-normal text-slate-500">{pricing.pro.period}</span></div>
              <p className="text-xs text-slate-500 mb-5">{pricing.isIndia ? 'Billed monthly' : 'Billed annually'}</p>
              <ul className="space-y-2 mb-6">
                {[
                  'Unlimited transactions',
                  'Unlimited file uploads',
                  'AI financial advisor',
                  'FIRE calculator',
                  'Cloud sync across devices',
                  'Budget tracking',
                ].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Icon name="check" className="w-4 h-4 text-brand-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/pricing" className="btn-primary block text-center w-full text-sm py-2.5">
                View Pro plan
              </Link>
            </div>

            {/* Enterprise */}
            <div className="card p-6 border border-dashed border-slate-300 dark:border-slate-700 opacity-90 relative overflow-hidden">
              <div className="absolute top-2 right-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded">
                Coming Soon
              </div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Enterprise</p>
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-1">Coming Soon</div>
              <p className="text-xs text-slate-500 mb-5">Household & family profiles</p>
              <ul className="space-y-2 mb-6">
                {[
                  'Everything in Pro',
                  'Household tracking (5 profiles)',
                  'Consolidated dashboard',
                  'Custom category rules',
                  'Priority support',
                ].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Icon name="check" className="w-4 h-4 text-green-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button disabled className="w-full bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-sm py-2.5 rounded-lg font-semibold cursor-not-allowed">
                Coming Soon
              </button>
            </div>
          </div>

          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            Full details on the{' '}
            <Link to="/pricing" className="text-brand-600 font-medium hover:underline">pricing page</Link>
            . Cancel any time.
          </p>
        </div>
      </section>

      {/* ── BOTTOM CTA ───────────────────────────────────────────────── */}
      <section className="bg-white dark:bg-slate-900 py-16 border-t border-slate-100 dark:border-slate-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="bg-brand-600 rounded-2xl p-10 text-white text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Stop guessing. Start knowing.</h2>
            <p className="text-brand-100 mb-7 max-w-md mx-auto">
              Upload your first statement in under 2 minutes and see your spending instantly — no account required.
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-white text-brand-700 font-bold px-8 py-3.5 rounded-lg hover:bg-brand-50 transition-colors text-base"
            >
              Upload Your Statement — Free
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 dark:border-slate-700 py-8 bg-white dark:bg-slate-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <Logo />
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
              <Link to="/pricing" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">Pricing</Link>
              <Link to="/features" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">Features</Link>
              <Link to="/help" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">Help</Link>
              <Link to="/privacy" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">Terms</Link>
              <Link to="/refund-policy" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">Refunds</Link>
              <Link to="/shipping-policy" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">Delivery</Link>
              <Link to="/contact" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">Contact</Link>
            </div>
            <div className="text-xs text-slate-500 text-center">
              <span>Built by </span>
              <a href="https://krexo.in" target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:text-brand-600 font-medium">
                Krexo
              </a>
              <span> · © {new Date().getFullYear()} TrackSpendZ</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
