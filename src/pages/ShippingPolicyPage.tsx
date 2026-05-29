import { Link } from 'react-router-dom';
import { usePageMeta } from '@/hooks/usePageMeta';
import { LEGAL } from '@/config/legal';

const ShippingPolicyPage = () => {
  usePageMeta({ title: 'Shipping & Delivery Policy | TrackSpendZ', description: 'TrackSpendZ is a digital service. How and when access to paid features is delivered.', canonical: '/shipping-policy' });

  return (
  <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
      <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mb-8">Shipping &amp; Delivery Policy</h1>

      <div className="prose prose-slate max-w-none space-y-6 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        <p><strong>Last updated:</strong> {LEGAL.lastUpdated}</p>

        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-8">Digital Service — No Physical Shipping</h2>
        <p>
          {LEGAL.brandName} is a 100% digital, cloud-based software service. There are no physical
          goods to ship. Nothing will be mailed or couriered to you.
        </p>

        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-8">How Access Is Delivered</h2>
        <p>
          Access to {LEGAL.brandName} is delivered instantly through your web browser at
          {' '}<strong>trackspendz.com</strong>. The free plan is available immediately — no payment
          required. When you upgrade to a paid plan (Pro or Enterprise), your account is upgraded
          automatically and paid features unlock within a few moments of a successful payment.
        </p>

        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-8">If Access Doesn't Unlock</h2>
        <p>
          In the rare case that a successful payment doesn't unlock your plan, your access will
          reconcile automatically once our payment provider (Razorpay) confirms the charge. If it
          still doesn't update within a few minutes, email{' '}
          <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a> and we'll resolve it
          promptly during our support hours ({LEGAL.supportHours}).
        </p>

        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-8">Questions</h2>
        <p>
          For anything related to access or delivery, see our{' '}
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

export default ShippingPolicyPage;
