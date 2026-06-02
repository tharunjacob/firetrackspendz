import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icon } from '@/components/common/Icons';
import { usePageMeta } from '@/hooks/usePageMeta';

// ============================================================
// Help & Documentation Page
// Comprehensive guides for all TrackSpendZ features
// ============================================================

interface HelpSection {
  id: string;
  icon: string;
  title: string;
  summary: string;
  content: React.ReactNode;
}

const sections: HelpSection[] = [
  {
    id: 'getting-started',
    icon: 'upload',
    title: 'Getting Started',
    summary: 'Upload your first statement and explore your finances in seconds.',
    content: (
      <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        <p><strong className="text-slate-800 dark:text-slate-200">1. Upload a bank statement</strong> — Click &ldquo;Upload Your Statements&rdquo; on the dashboard. You can drag and drop Excel (.xlsx, .xls), CSV, TSV, or PDF files. TrackSpendZ recognises 150+ column formats automatically.</p>
        <p><strong className="text-slate-800 dark:text-slate-200">2. Name the account</strong> — Enter a label like &ldquo;HDFC Savings&rdquo; or &ldquo;Amex Credit Card&rdquo; so you can filter by account later.</p>
        <p><strong className="text-slate-800 dark:text-slate-200">3. Add more files</strong> — Click &ldquo;Add Another File&rdquo; to upload statements from multiple banks or accounts in one go.</p>
        <p><strong className="text-slate-800 dark:text-slate-200">4. Hit Analyze</strong> — TrackSpendZ will parse every row, categorise transactions, detect inter-account transfers, and take you straight to your Summary dashboard.</p>
        <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg p-4 mt-2">
          <p className="text-brand-800 dark:text-brand-300 text-xs font-medium">Tip: You can try the dashboard without signing up. Upload a file and explore — sign up only when you want to save your data.</p>
        </div>
      </div>
    ),
  },
  {
    id: 'password-files',
    icon: 'shield',
    title: 'Password-Protected Files',
    summary: 'Open encrypted PDFs right in the browser.',
    content: (
      <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        <p>Many banks email password-protected PDF statements. TrackSpendZ detects encryption automatically and shows a password field next to the file.</p>
        <p><strong className="text-slate-800 dark:text-slate-200">How it works:</strong> When you select a PDF, we check its header. If it&rsquo;s encrypted, a password input appears with a lock icon. Enter the password your bank specified (often your date of birth or PAN) and proceed as normal.</p>
        <p>Your password is used locally in the browser to decrypt the file — it is never sent to any server.</p>
      </div>
    ),
  },
  {
    id: 'dashboard',
    icon: 'chart',
    title: 'Dashboard & Views',
    summary: 'Navigate your financial data with 15 interactive views.',
    content: (
      <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        <p>After uploading, the tab bar at the top lets you switch between views. The 15 views are organised into three groups:</p>
        <div className="space-y-5 mt-2">
          {[
            {
              label: 'Analyze',
              blurb: 'Understand where your money is going.',
              tabs: [
                ['Summary', 'High-level income, expenses, savings, top categories, and recent transactions at a glance.'],
                ['Yearly Analysis', 'Year-over-year income, expenses, and savings comparison.'],
                ['Monthly Analysis', 'Month-by-month bars, cumulative savings trend, and savings rate chart.'],
                ['Categories', 'Drill into spending by category — see which areas consume the most.'],
                ['Trends', 'Multi-line trend charts for your top expense and income categories.'],
                ['Compare', 'Compare two months or two years side by side.'],
              ],
            },
            {
              label: 'Take control',
              blurb: 'Act on your data — edit, limit, and track.',
              tabs: [
                ['Data (Edit)', 'Search, filter, edit, or delete individual transactions. Edits auto-create learning rules for smarter future categorization.'],
                ['Budgets', 'Set monthly spending limits per category and get alerts at 80% and 100%.'],
                ['Goals', 'Set savings goals with target amounts and deadlines. Track contributions and progress.'],
                ['Recurring', 'Detects subscriptions and recurring bills, plus an estimated monthly baseline by category with trend indicators.'],
              ],
            },
            {
              label: 'Plan ahead',
              blurb: 'Long-term financial planning.',
              tabs: [
                ['FIRE Calculator', 'Estimate your financial independence date based on your actual spending patterns.'],
                ['Net Worth', 'Track assets and liabilities to see your full financial picture over time.'],
                ['Debt Payoff', 'Enter your debts, pick Snowball or Avalanche, and see your debt-free date plus a month-by-month payoff schedule. Pro+.'],
                ['AI Advisor', 'Chat with an AI trained on your financial data for personalised advice.'],
                ['Year Review', 'Your personal Financial Wrapped — top categories, savings rate trend, biggest win, and a shareable summary card.'],
              ],
            },
          ].map(group => (
            <div key={group.label}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{group.label}</p>
              <p className="text-xs text-slate-500 mb-2">{group.blurb}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {group.tabs.map(([name, desc]) => (
                  <div key={name} className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3 border border-slate-100 dark:border-slate-600">
                    <p className="font-semibold text-slate-800 dark:text-slate-100 text-xs">{name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2">All charts are fully interactive — hover for tooltips, drag the range slider to zoom, and click legend items to highlight series.</p>
      </div>
    ),
  },
  {
    id: 'notifications',
    icon: 'bell',
    title: 'Smart Notifications',
    summary: 'Proactive alerts for bills, budgets, anomalies, and achievements.',
    content: (
      <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        <p>The bell icon in the top bar shows real-time, intelligent notifications generated from your data:</p>
        <p><strong className="text-slate-800 dark:text-slate-200">Bill reminders</strong> — Detects recurring payments and warns you 5 days before the next expected charge.</p>
        <p><strong className="text-slate-800 dark:text-slate-200">Budget warnings</strong> — Alerts when you reach 80% or exceed your set budget limit.</p>
        <p><strong className="text-slate-800 dark:text-slate-200">Spending spikes</strong> — Flags when your current month&rsquo;s spending pace is 30%+ above your 3-month average.</p>
        <p><strong className="text-slate-800 dark:text-slate-200">Anomaly detection</strong> — Highlights unusually large transactions compared to your category averages.</p>
        <p><strong className="text-slate-800 dark:text-slate-200">Achievements</strong> — Celebrates when your savings improve or spending decreases month over month.</p>
      </div>
    ),
  },
  {
    id: 'budgets',
    icon: 'wallet',
    title: 'Budgets & Goals',
    summary: 'Set spending limits and savings targets to stay on track.',
    content: (
      <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        <p><strong className="text-slate-800 dark:text-slate-200">Budgets:</strong> Go to the Budgets tab, pick a spending category, and set a monthly limit. You&rsquo;ll see a progress bar and get notified when you approach or exceed the limit.</p>
        <p><strong className="text-slate-800 dark:text-slate-200">Goals:</strong> Go to the Goals tab to create savings goals. Enter a target amount, optional deadline, and monthly contribution. Track your progress visually with progress bars and bar charts. Use the quick-add buttons to log contributions.</p>
      </div>
    ),
  },
  {
    id: 'recurring',
    icon: 'chart',
    title: 'Recurring Transactions',
    summary: 'How TrackSpendZ detects subscriptions, bills, and recurring payments.',
    content: (
      <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        <p>The <strong className="text-slate-800 dark:text-slate-200">Recurring</strong> tab automatically detects transactions that repeat at regular intervals.</p>

        <p><strong className="text-slate-800 dark:text-slate-200">How detection works:</strong></p>
        <ul className="list-disc pl-4 space-y-1 text-xs">
          <li>Transactions are grouped by similar description (fuzzy matching ignores minor differences like reference numbers).</li>
          <li>For each group, the system calculates the average gap between consecutive occurrences.</li>
          <li>If the gap is consistent (low variance) and the group has at least <strong>3 occurrences</strong>, it&rsquo;s flagged as recurring.</li>
          <li>The amounts must also be reasonably consistent (within 20% variance) to qualify.</li>
        </ul>

        <p><strong className="text-slate-800 dark:text-slate-200">Frequency labels:</strong></p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {[
            ['Weekly', '~7 days'],
            ['Monthly', '~30 days'],
            ['Quarterly', '~91 days'],
            ['Yearly', '~365 days'],
          ].map(([label, gap]) => (
            <div key={label} className="bg-slate-50 dark:bg-slate-700 rounded px-3 py-2 text-center border border-slate-100 dark:border-slate-600">
              <p className="font-semibold text-slate-700 dark:text-slate-200">{label}</p>
              <p className="text-slate-500 dark:text-slate-400">{gap}</p>
            </div>
          ))}
        </div>

        <p><strong className="text-slate-800 dark:text-slate-200">FIRE integration:</strong> Recurring expenses form your baseline monthly cost on the FIRE Calculator&rsquo;s &ldquo;Recurring Commitments&rdquo; card, with smart category icons (🏠 Rent, 💳 EMIs, ⚡ Utilities, 🌐 Internet, etc.).</p>

        <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg p-4 mt-2">
          <p className="text-brand-800 dark:text-brand-300 text-xs font-medium">Tip: The Recurring tab also provides a baseline spending view &mdash; showing your estimated monthly fixed costs by category, with trend indicators showing if each category is rising or falling.</p>
        </div>
      </div>
    ),
  },
  {
    id: 'debt-payoff',
    icon: 'wallet',
    title: 'Debt Payoff Planner',
    summary: 'Snowball or Avalanche — find your fastest path to debt freedom.',
    content: (
      <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        <p>The <strong className="text-slate-800 dark:text-slate-200">Debt Payoff</strong> tab (Pro) helps you build a month-by-month repayment plan for multiple debts.</p>

        <p><strong className="text-slate-800 dark:text-slate-200">Two strategies:</strong></p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
          <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3 border border-slate-100 dark:border-slate-600">
            <p className="font-semibold text-slate-800 dark:text-slate-100 text-xs">❄️ Snowball</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Pay off the smallest balance first. Quick wins build motivation. Best for staying consistent.</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3 border border-slate-100 dark:border-slate-600">
            <p className="font-semibold text-slate-800 dark:text-slate-100 text-xs">🏔️ Avalanche</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Pay off the highest interest rate first. Mathematically optimal &mdash; saves the most in total interest.</p>
          </div>
        </div>

        <p><strong className="text-slate-800 dark:text-slate-200">How it works:</strong> Enter each debt (name, balance, interest rate, minimum payment). Set your total monthly budget for debt. The planner allocates minimum payments to all debts and directs the surplus to the priority debt. Once that debt is paid off, the surplus &ldquo;snowballs&rdquo; into the next.</p>

        <p>You&rsquo;ll see your debt-free date, total interest paid, and a full month-by-month schedule showing each debt&rsquo;s balance over time.</p>
      </div>
    ),
  },
  {
    id: 'fire',
    icon: 'fire',
    title: 'FIRE Calculator',
    summary: 'Calculate your path to financial independence with data-driven projections.',
    content: (
      <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        <p>The FIRE (Financial Independence, Retire Early) calculator estimates when you can stop working, based on your <em>actual</em> spending data&mdash;not generic averages.</p>

        <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg p-4">
          <p className="text-brand-800 dark:text-brand-300 text-xs font-medium mb-1">Quick summary & Multipliers</p>
          <p className="text-brand-700 dark:text-brand-300 text-xs">
            <strong>Freedom Number = Annual Expenses &times; Multiplier</strong>. This is the corpus needed so that returns alone cover your living costs.
          </p>
          <ul className="text-xs text-brand-700 dark:text-brand-300 mt-2 list-disc pl-4 space-y-1">
            <li><strong>INR (Indian Rupee):</strong> Applies a <strong>33× multiplier</strong> (approx. 3% Safe Withdrawal Rate) to account for India's historically higher inflation and lower real returns.</li>
            <li><strong>USD & Other Currencies:</strong> Applies a <strong>25× multiplier</strong> (classic 4% Safe Withdrawal Rate) based on developed-market historical benchmarks.</li>
          </ul>
        </div>

        <p><strong className="text-slate-800 dark:text-slate-200">Three tabs</strong> give you different lenses:</p>

        <div className="space-y-3 mt-2">
          <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3 border border-slate-100 dark:border-slate-600">
            <p className="font-semibold text-slate-800 dark:text-slate-100 text-xs">My FIRE &mdash; Your personalised dashboard</p>
            <ul className="text-xs text-slate-500 dark:text-slate-400 mt-1 space-y-1 list-disc pl-4">
              <li><strong>Freedom Number:</strong> Annual expenses &times; multiplier. Adjust your average monthly spend and the number recalculates instantly.</li>
              <li><strong>Personal Inflation:</strong> Calculated directly from your transaction history by comparing spending category-by-category across matching months in consecutive years (e.g. comparing Jan-May of last year to Jan-May of this year) to avoid seasonal/partial-year biases.</li>
              <li><strong>Required Capital projections:</strong> Shows what you&rsquo;d need in 1, 5, 7, 10, and 15 years (both nominal and today&rsquo;s-money values). Calculations project your wealth using a compound return rate (default 8% for INR, 7% for USD/others) adjusted by personal inflation.</li>
              <li><strong>Big Ticket Expenses:</strong> Add future one-off costs (wedding, home, education). Each is inflated to its future value and converted to the corpus needed using the 4% rule (25&times;).</li>
              <li><strong>Recurring Commitments:</strong> Auto-detected subscriptions and fixed bills that form your baseline monthly cost.</li>
              <li><strong>Real Income Growth:</strong> Your income growth minus personal inflation&mdash;shows whether your purchasing power is truly increasing.</li>
              <li><strong>Balanced Spender:</strong> Analyses spending distribution across weekdays. &ldquo;Stable&rdquo; means even spending; &ldquo;Volatile&rdquo; means it&rsquo;s concentrated on specific days.</li>
            </ul>
          </div>
          <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3 border border-slate-100 dark:border-slate-600">
            <p className="font-semibold text-slate-800 dark:text-slate-100 text-xs">Scenarios &mdash; What-if analysis</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Build multiple retirement scenarios by adjusting monthly savings, expected returns, and inflation. Compare them side-by-side to see how changes in lifestyle or investment strategy affect your FIRE date.</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3 border border-slate-100 dark:border-slate-600">
            <p className="font-semibold text-slate-800 dark:text-slate-100 text-xs">Monte Carlo &mdash; Stress-test your plan</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Runs 1,000 simulated market scenarios with randomised returns to show the probability of your corpus lasting through retirement. Results are shown as a probability chart and percentile bands (10th, 50th, 90th) so you can see best-case, median, and worst-case outcomes.</p>
          </div>
        </div>

        <p><strong className="text-slate-800 dark:text-slate-200">Progress bar:</strong> If you&rsquo;ve added assets in the Net Worth tab, your current net worth is automatically pulled into the FIRE progress bar. Otherwise, enter a manual &ldquo;Starting Net Worth&rdquo; figure on the My FIRE tab.</p>
      </div>
    ),
  },
  {
    id: 'net-worth',
    icon: 'wallet',
    title: 'Net Worth Tracking',
    summary: 'Track assets and liabilities to see your full financial picture over time.',
    content: (
      <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        <p>Navigate to the <strong className="text-slate-800 dark:text-slate-200">Net Worth</strong> tab to record what you own and owe. The dashboard calculates your net worth as <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">Total Assets &minus; Total Liabilities</code>.</p>

        <p><strong className="text-slate-800 dark:text-slate-200">Asset categories and accessibility:</strong></p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            ['🏦', 'Savings', 'Bank savings accounts, Cash, FDs, RDs (Liquid: instant access, zero penalty)'],
            ['📈', 'Investments', 'Mutual funds, Stocks, ETFs, Bonds (Investments: 2-3 days liquidation time)'],
            ['🏠', 'Real Estate', 'Property market valuation (Investments: long-term, illiquid)'],
            ['✨', 'Gold', 'Physical gold, gold ETFs, Sovereign Gold Bonds (Investments)'],
            ['₿', 'Crypto', 'Bitcoin, Ethereum, other crypto holdings (Investments)'],
            ['📦', 'Other Assets', 'Vehicles, collectibles, valuables (Investments)'],
            ['💳', 'Liabilities', 'Home loans, car loans, credit card balances, mortgages (Owed amounts)'],
          ].map(([icon, name, desc]) => (
            <div key={name} className="bg-slate-50 dark:bg-slate-700 rounded-lg p-2.5 border border-slate-100 dark:border-slate-600">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{icon} {name}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{desc}</p>
            </div>
          ))}
        </div>

        <p><strong className="text-slate-800 dark:text-slate-200">Accessibility Tiers:</strong> When managing assets via the Full Tracker, you can categorise wealth into accessibility tiers:</p>
        <ul className="text-xs text-slate-500 dark:text-slate-400 pl-4 list-disc space-y-1">
          <li><strong>Liquid:</strong> Funds you can access within 24–48 hours (e.g., cash, savings accounts).</li>
          <li><strong>Investment:</strong> Mid-to-long term wealth builders that can be liquidated but are subject to market volatility or moderate delay (e.g., Stocks, Mutual Funds, Real Estate).</li>
          <li><strong>Retirement:</strong> Locked or tax-restricted accounts (EPF, PPF, NPS, or 401k/IRA). Excluded from immediate liquid calculation but tracked for overall long-term net worth.</li>
        </ul>

        <p><strong className="text-slate-800 dark:text-slate-250">Monthly snapshots:</strong> Each time you save, a timestamped snapshot is recorded. Over time, these snapshots build a historical chart showing your net worth trajectory.</p>

        <p><strong className="text-slate-800 dark:text-slate-200">Inflation Baseline:</strong> The net worth chart plots a dashed "Inflation Baseline". Starting from your very first snapshot, it grows exponentially at your computed **Personal Inflation Rate**. If your actual net worth line is steeper than the baseline, you are growing your wealth in real purchasing power terms. If it falls below, inflation is eroding your wealth's purchasing power.</p>

        <p><strong className="text-slate-800 dark:text-slate-200">FIRE integration:</strong> Your total net worth automatically feeds into the FIRE Calculator&rsquo;s progress bar, so you can see how far you are from your Freedom Number without entering it manually.</p>

        <p><strong className="text-slate-800 dark:text-slate-200">Month-over-month change:</strong> Shown as both an absolute amount and a percentage, so you can track growth momentum at a glance.</p>
      </div>
    ),
  },
  {
    id: 'categories',
    icon: 'search',
    title: 'Smart Categorization & Rules',
    summary: 'Auto-categorization with 150+ built-in patterns, plus custom rules.',
    content: (
      <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        <p>TrackSpendZ matches transaction descriptions against 150+ keyword patterns to auto-assign categories like &ldquo;Groceries&rdquo;, &ldquo;Rent&rdquo;, &ldquo;Subscriptions&rdquo;, etc.</p>
        <p><strong className="text-slate-800 dark:text-slate-200">Custom rules:</strong> In the Data view, edit any transaction&rsquo;s category. The system learns from your corrections — if you recategorise &ldquo;ZOMATO&rdquo; from &ldquo;Other&rdquo; to &ldquo;Food Delivery&rdquo;, all future Zomato transactions will follow.</p>
        <p><strong className="text-slate-800 dark:text-slate-200">Admin rules (Enterprise):</strong> System-wide rules can be promoted by admins to apply across all users.</p>
      </div>
    ),
  },
  {
    id: 'export',
    icon: 'download',
    title: 'Export & Sharing',
    summary: 'Download your data as CSV or JSON anytime.',
    content: (
      <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        <p>Go to <strong className="text-slate-800 dark:text-slate-200">Settings → Export Data</strong> to download all your transactions as a CSV or JSON file.</p>
        <p>Enterprise users get advanced multi-member exports for consolidated accounting.</p>
      </div>
    ),
  },
  {
    id: 'plans',
    icon: 'shield',
    title: 'Plans & Pricing',
    summary: 'Free, Pro, and Enterprise — pick what fits.',
    content: (
      <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        <p><strong className="text-slate-800 dark:text-slate-200">Free:</strong> Up to 500 transactions, basic categorization, monthly breakdowns, local storage.</p>
        <p><strong className="text-slate-800 dark:text-slate-200">Pro ($49.99/year or ₹1,499/year):</strong> Unlimited transactions, AI advisor, FIRE calculator, net worth, budgets, cloud sync, trend analysis, anomaly detection.</p>
        <p><strong className="text-slate-800 dark:text-slate-200">Enterprise (Coming Soon):</strong> Everything in Pro plus household tracking (up to 5 profiles), consolidated budgets &amp; goals, custom categories &amp; rules, and CSV/JSON data exports.</p>
        <p>You can try the app free without signing up — upload a statement and explore all views instantly. <Link to="/pricing" className="text-brand-600 hover:underline">View full pricing →</Link></p>
      </div>
    ),
  },
  {
    id: 'family',
    icon: 'user',
    title: 'Family Dashboard (Enterprise)',
    summary: 'Manage household finances with up to 5 profiles.',
    content: (
      <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        <p>Enterprise users can create up to 5 household member profiles under their account.</p>
        <p><strong className="text-slate-800 dark:text-slate-200">What you get:</strong> Combined household stats, per-member contribution charts, multi-profile comparison tables, and consolidated budget tracking.</p>
        <p>Navigate to the <strong className="text-slate-800 dark:text-slate-200">Family Dashboard</strong> tab from the sidebar to manage your profiles.</p>
      </div>
    ),
  },
  {
    id: 'privacy',
    icon: 'shield',
    title: 'Privacy & Security',
    summary: 'Your financial data stays yours — always.',
    content: (
      <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        <p><strong className="text-slate-800 dark:text-slate-200">Local-first:</strong> Free users&rsquo; data is stored locally in the browser&rsquo;s IndexedDB and never leaves their device unless they sign up.</p>
        <p><strong className="text-slate-800 dark:text-slate-200">Secure Cloud Sync (Pro+):</strong> Data is transferred securely via HTTPS and stored in a private database managed by Supabase with strict Row-Level Security.</p>
        <p><strong className="text-slate-800 dark:text-slate-200">No ads, no data selling:</strong> We never sell, share, or monetise your financial data. <Link to="/privacy" className="text-brand-600 hover:underline">Read our privacy policy →</Link></p>
        <p><strong className="text-slate-800 dark:text-slate-200">Passwords:</strong> PDF passwords are used in-browser only and are never transmitted or stored.</p>
      </div>
    ),
  },
];

const HelpPage = () => {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const location = useLocation();

  usePageMeta({ title: 'Help Center — Guides & FAQ | TrackSpendZ', description: 'Learn how to upload bank statements, set budgets, use the FIRE calculator, and get the most out of TrackSpendZ. Step-by-step guides and FAQ.', canonical: '/help' });

  // Handle anchor links (e.g. /help#fire)
  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (hash) {
      setExpanded(hash);
      setTimeout(() => {
        document.getElementById(`help-${hash}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [location.hash]);

  const filtered = search.trim()
    ? sections.filter(s =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.summary.toLowerCase().includes(search.toLowerCase()) ||
        s.id.toLowerCase().includes(search.toLowerCase())
      )
    : sections;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-16 pb-6 text-center">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">Help Center</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-8">Everything you need to know about using TrackSpendZ.</p>

        {/* Search */}
        <div className="relative max-w-md mx-auto mb-10">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            placeholder="Search help articles..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-10 w-full"
          />
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-20">
        <div className="space-y-3">
          {filtered.map(section => (
            <div
              key={section.id}
              id={`help-${section.id}`}
              className="card overflow-hidden transition-shadow hover:shadow-md"
            >
              <button
                onClick={() => setExpanded(expanded === section.id ? null : section.id)}
                className="w-full px-5 py-4 flex items-center gap-4 text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-brand-50 dark:bg-brand-950 text-brand-600 flex items-center justify-center shrink-0">
                  <Icon name={section.icon} className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{section.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{section.summary}</p>
                </div>
                <svg
                  className={`w-5 h-5 text-slate-500 shrink-0 transition-transform duration-200 ${expanded === section.id ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {expanded === section.id && (
                <div className="px-5 pb-5 pt-0 border-t border-slate-100 dark:border-slate-700 animate-fade-in">
                  <div className="pt-4">{section.content}</div>
                </div>
              )}
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <p className="text-sm">No articles match &ldquo;{search}&rdquo;. Try a different search term.</p>
            </div>
          )}
        </div>

        {/* Contact Support */}
        <div className="card p-6 mt-10 text-center">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-2">Still need help?</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Can&rsquo;t find what you&rsquo;re looking for? Reach out to our support team.
          </p>
          <a
            href="mailto:support@trackspendz.com"
            className="btn-primary inline-flex items-center gap-2 px-6"
          >
            <Icon name="mail" className="w-4 h-4" /> Contact Support
          </a>
        </div>
      </section>

      <div className="text-center pb-8">
        <Link to="/" className="text-sm text-brand-600 hover:underline">&larr; Back to Home</Link>
      </div>
    </div>
  );
};

export default HelpPage;
