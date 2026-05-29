import { Link } from 'react-router-dom';
import { usePageMeta } from '@/hooks/usePageMeta';

const sections = [
  {
    title: 'Upload Any Statement',
    desc: 'Drop your bank or credit card statements in any format — Excel, CSV, or PDF. Our engine automatically detects columns, dates, and amounts. No manual mapping needed.',
    details: [
      '150+ merchant keyword patterns for instant categorization',
      'AI-powered column detection with fuzzy matching',
      'Support for encrypted PDFs (enter password once)',
      'Multi-account upload — track everything in one place',
      'Smart inter-account transfer detection',
    ],
    visual: '📄',
  },
  {
    title: 'AI-Powered Insights',
    desc: 'Our AI analyzes your spending patterns and gives you actionable advice. Not generic tips — insights based on YOUR actual financial data.',
    details: [
      'Chat with your AI CFO about any financial question',
      'Proactive alerts: "Your dining spend jumped 40% this month"',
      'Smart savings suggestions based on recurring expenses',
      'Anomaly detection catches unusual charges instantly',
      'Powered by Google Gemini 2.0 Flash',
    ],
    visual: '🤖',
  },
  {
    title: 'FIRE Planning',
    desc: 'Track your path to Financial Independence / Retire Early. See exactly when you can achieve freedom based on your real numbers.',
    details: [
      'Personal inflation rate calculated from YOUR expense growth',
      'Freedom number based on 25x annual expenses (4% SWR)',
      'Projection charts: 1 year to 20 years out',
      'Recurring expense tracker with confidence scoring',
      'Monthly runway calculation — how long can your savings last?',
    ],
    visual: '🔥',
  },
  {
    title: 'Net Worth Dashboard',
    desc: 'See your complete financial picture. Track savings, investments, property, crypto, and more — all in one unified view.',
    details: [
      'Auto-calculate savings from tracked transactions',
      'Add manual assets: property, stocks, crypto, vehicles',
      'Visual breakdown by asset type',
      'Track growth over time',
      'Multi-currency support (8 currencies)',
    ],
    visual: '💰',
  },
  {
    title: 'Budget Tracker',
    desc: 'Set monthly spending limits per category and get instant visual feedback. Know where you stand before it\'s too late.',
    details: [
      'Smart budget suggestions based on your spending history',
      'Real-time progress bars (green/amber/red)',
      'Over-budget alerts with remaining amount',
      'Category-level tracking for granular control',
      'Adjustable limits as your income changes',
    ],
    visual: '🎯',
  },
  {
    title: 'Deep Analytics',
    desc: 'From monthly breakdowns to multi-year trends — understand your money at every level of detail.',
    details: [
      'Monthly income vs expense with savings rate',
      'Category analysis with pie charts and tables',
      '3-month rolling averages for trend smoothing',
      'Multi-account comparison side-by-side',
      'Yearly summaries with YoY growth rates',
      'Cumulative savings tracking over time',
    ],
    visual: '📈',
  },
];

const FeaturesPage = () => {
  usePageMeta({ title: 'Features — Smart Categorization, FIRE Calculator, AI Advisor | TrackSpendZ', description: 'Explore 14 financial tools: AI-powered categorization, FIRE calculator, net worth tracking, budget alerts, trend analysis, recurring detection, and more.', canonical: '/features' });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-20 pb-12 text-center">
        <h1 className="text-4xl font-extrabold text-slate-900 dark:text-slate-100 mb-4">Built for People Who Care About Money</h1>
        <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
          Every feature designed to give you clarity, control, and confidence with your finances.
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-20 space-y-16">
        {sections.map((s, i) => (
          <div key={s.title} className={`flex flex-col ${i % 2 === 1 ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-8`}>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-3">{s.title}</h2>
              <p className="text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">{s.desc}</p>
              <ul className="space-y-2">
                {s.details.map(d => (
                  <li key={d} className="flex items-start gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <svg className="w-4 h-4 text-brand-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {d}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex-shrink-0 w-48 h-48 bg-brand-50 dark:bg-brand-950 rounded-2xl flex items-center justify-center">
              <span className="text-7xl">{s.visual}</span>
            </div>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="bg-white dark:bg-slate-800 py-16 text-center border-t border-slate-100 dark:border-slate-700">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">See It In Action</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8">Upload your first statement in under 2 minutes — no account needed.</p>
        <Link to="/dashboard" className="btn-primary text-lg px-8 py-3.5">
          Try It Free — No Signup
        </Link>
      </section>

      <div className="text-center py-8">
        <Link to="/" className="text-sm text-brand-600 hover:underline">&larr; Back to Home</Link>
      </div>
    </div>
  );
};

export default FeaturesPage;
