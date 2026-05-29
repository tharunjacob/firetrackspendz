import { Link } from 'react-router-dom';
import { usePageMeta } from '@/hooks/usePageMeta';
import { LEGAL } from '@/config/legal';

const ContactPage = () => {
  usePageMeta({ title: 'Contact Us | TrackSpendZ', description: 'Get in touch with the TrackSpendZ team. Support email, phone, business address, and hours.', canonical: '/contact' });

  return (
  <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-8">Contact Us</h1>

      <div className="prose prose-slate max-w-none space-y-6 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        <p>
          We'd love to hear from you. Whether it's a question, a billing issue, or feedback on
          {' '}{LEGAL.brandName}, reach us using the details below and we'll get back to you during
          our support hours.
        </p>

        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-8">Business Details</h2>
        <p>
          <strong>{LEGAL.businessName}</strong><br />
          {LEGAL.address.split('\n').map((line, i) => (
            <span key={i}>{line}<br /></span>
          ))}
        </p>

        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-8">Get in Touch</h2>
        <p>
          <strong>Support email:</strong>{' '}
          <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a><br />
          <strong>Privacy enquiries:</strong>{' '}
          <a href={`mailto:${LEGAL.privacyEmail}`}>{LEGAL.privacyEmail}</a><br />
          <strong>Phone:</strong> {LEGAL.phone}<br />
          <strong>Support hours:</strong> {LEGAL.supportHours}
        </p>

        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-8">Other Ways to Reach Us</h2>
        <p>
          You can also send feedback or report a bug any time from our{' '}
          <Link to="/feedback" className="text-brand-600 hover:underline">Feedback page</Link>.
          For billing and refunds, see our{' '}
          <Link to="/refund-policy" className="text-brand-600 hover:underline">Cancellation &amp; Refund Policy</Link>.
        </p>
      </div>

      <div className="mt-12">
        <Link to="/" className="text-sm text-brand-600 hover:underline">&larr; Back to Home</Link>
      </div>
    </div>
  </div>
  );
};

export default ContactPage;
