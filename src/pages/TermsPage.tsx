import { Link } from 'react-router-dom';
import { usePageMeta } from '@/hooks/usePageMeta';
import { LEGAL } from '@/config/legal';

const TermsPage = () => {
  usePageMeta({ title: 'Terms of Service | TrackSpendZ', description: 'TrackSpendZ terms of service. Usage conditions, subscription terms, and data handling policies.', canonical: '/terms' });

  return (
  <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
      <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mb-8">Terms of Service</h1>

      <div className="prose prose-slate max-w-none space-y-6 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        <p><strong>Last updated:</strong> {LEGAL.lastUpdated}</p>

        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-8">Acceptance of Terms</h2>
        <p>
          By using TrackSpendZ, you agree to these terms. If you don't agree, please don't use the service.
        </p>

        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-8">Service Description</h2>
        <p>
          TrackSpendZ is a personal finance tracking tool. You upload bank/credit card statements,
          and we help you categorize, analyze, and understand your spending. We are not a bank,
          financial advisor, or fiduciary. All insights are informational only.
        </p>

        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-8">Your Account</h2>
        <p>
          You're responsible for your account security. Use a strong password and don't share
          your credentials. Notify us immediately if you suspect unauthorized access.
        </p>

        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-8">Acceptable Use</h2>
        <p>
          Use TrackSpendZ for personal finance tracking. Don't use it to process other people's
          financial data without their consent, or for any illegal purpose.
        </p>

        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-8">Subscriptions &amp; Payments</h2>
        <p>
          Free accounts have usage limits. Paid subscriptions (Pro and Enterprise) are billed
          on a monthly or yearly basis via Razorpay, our payment processor. You can cancel anytime
          from Settings — access continues until the end of your current billing period.
          Cancellations and refunds are governed by our{' '}
          <Link to="/refund-policy" className="text-brand-600 hover:underline">Cancellation &amp; Refund Policy</Link>.
        </p>

        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-8">Limitation of Liability</h2>
        <p>
          TrackSpendZ is provided "as is." We do our best to provide accurate categorization
          and analysis, but we make no guarantees. We are not liable for financial decisions
          made based on our insights. Always consult a qualified financial advisor.
        </p>

        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-8">Changes to Terms</h2>
        <p>
          We may update these terms. Continued use after changes constitutes acceptance.
          We'll notify you of significant changes via email.
        </p>

        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-8">Contact</h2>
        <p>
          Questions? Email us at{' '}
          <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a>, or see our{' '}
          <Link to="/contact" className="text-brand-600 hover:underline">Contact page</Link>.
        </p>
      </div>

      <div className="mt-12">
        <Link to="/" className="text-sm text-brand-600 hover:underline">&larr; Back to Home</Link>
      </div>
    </div>
  </div>
  );
};

export default TermsPage;
