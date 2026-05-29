import { Link } from 'react-router-dom';
import { usePageMeta } from '@/hooks/usePageMeta';
import { LEGAL } from '@/config/legal';

const RefundPolicyPage = () => {
  usePageMeta({ title: 'Cancellation & Refund Policy | TrackSpendZ', description: 'How to cancel your TrackSpendZ subscription and our refund policy for Pro and Enterprise plans.', canonical: '/refund-policy' });

  return (
  <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
      <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mb-8">Cancellation &amp; Refund Policy</h1>

      <div className="prose prose-slate max-w-none space-y-6 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        <p><strong>Last updated:</strong> {LEGAL.lastUpdated}</p>

        <p>
          This policy explains how cancellations and refunds work for paid {LEGAL.brandName}
          subscriptions (Pro and Enterprise). Our free plan never charges you, so this policy
          applies only to paid plans.
        </p>

        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-8">Cancelling Your Subscription</h2>
        <p>
          You can cancel your subscription at any time from <strong>Settings → Subscription</strong>
          inside your account. Cancellation stops future renewals — you keep access to paid
          features until the end of the billing period you've already paid for. No further
          amount is charged after you cancel.
        </p>

        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-8">Refunds</h2>
        <p>
          If you were charged in error, charged twice, or are unhappy with a paid plan, you may
          request a refund within <strong>{LEGAL.refundWindowDays} days</strong> of the charge by
          emailing <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a> from the email
          address on your account. Approved refunds are issued to your original payment method via
          Razorpay, typically within 5–7 business days (your bank may take additional time to post it).
        </p>
        <p>
          Because {LEGAL.brandName} is a digital subscription service with immediate access, refunds
          for periods you've already used are handled on a case-by-case basis. We aim to be fair —
          if the product didn't work as described, we'll make it right.
        </p>

        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-8">What's Not Refundable</h2>
        <p>
          Renewal charges after a billing period has begun, and partial periods after the
          {' '}{LEGAL.refundWindowDays}-day window, are generally non-refundable unless required by law.
        </p>

        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-8">How to Reach Us</h2>
        <p>
          For any cancellation or refund request, email <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a>.
          We respond during our support hours: {LEGAL.supportHours}. See our{' '}
          <Link to="/contact" className="text-brand-600 hover:underline">Contact page</Link> for full details.
        </p>
      </div>

      <div className="mt-12">
        <Link to="/" className="text-sm text-brand-600 hover:underline">&larr; Back to Home</Link>
      </div>
    </div>
  </div>
  );
};

export default RefundPolicyPage;
