import { Link } from 'react-router-dom';
import { usePageMeta } from '@/hooks/usePageMeta';

const PrivacyPage = () => {
  usePageMeta({ title: 'Privacy Policy | TrackSpendZ', description: 'How TrackSpendZ protects your financial data. No Plaid, no screen-scraping, bank-level encryption, and full data deletion on request.', canonical: '/privacy' });

  return (
  <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
      <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mb-8">Privacy Policy</h1>

      <div className="prose prose-slate max-w-none space-y-6 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        <p><strong>Last updated:</strong> March 2026</p>

        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-8">Your Data, Your Control</h2>
        <p>
          TrackSpendZ is built on a simple principle: your financial data belongs to you.
          We never sell, share, or use your data for advertising. Your information is only
          used to provide you with the TrackSpendZ service.
        </p>

        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-8">What We Collect</h2>
        <p>
          We collect the minimum data necessary to provide our service: your email address for
          authentication, and financial transaction data that you explicitly upload. We do not
          scrape, aggregate, or collect data from any external sources.
        </p>

        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-8">How We Store It</h2>
        <p>
          Free tier users: your data is stored locally on your device using IndexedDB. It never
          leaves your browser unless you upgrade to Pro with cloud sync.
        </p>
        <p>
          Pro and Enterprise users: your data is encrypted at rest in our Supabase-powered database
          with row-level security. Each user can only access their own data.
        </p>

        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-8">AI Processing</h2>
        <p>
          When you use AI features (insights, chat advisor), a summary of your financial data
          is sent to Google's Gemini API for processing. We send aggregated summaries, not
          individual transaction details. Google's API data is not used for training.
        </p>

        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-8">Third-Party Services</h2>
        <p>
          We use Supabase for authentication and database, Google Gemini for AI features,
          and Stripe for payment processing. Each service has its own privacy policy.
        </p>

        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-8">Your Rights</h2>
        <p>
          You can export or delete all your data at any time from your dashboard settings.
          Account deletion permanently removes all your data from our systems.
        </p>

        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-8">Contact</h2>
        <p>
          Questions about privacy? Email us at privacy@trackspendz.com.
        </p>
      </div>

      <div className="mt-12">
        <Link to="/" className="text-sm text-brand-600 hover:underline">&larr; Back to Home</Link>
      </div>
    </div>
  </div>
  );
};

export default PrivacyPage;
