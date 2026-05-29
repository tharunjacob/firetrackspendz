import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { Icon } from '@/components/common/Icons';
import { getSupabase } from '@/services/supabase';
import { TABLES } from '@/config/database';
import { STORAGE_KEYS } from '@/config/storage';
import { usePageMeta } from '@/hooks/usePageMeta';

// ============================================================
// Feedback Page — Bug reports, feature requests, general feedback
// ============================================================
//
// HOW IT WORKS:
// 1. User picks a category (bug, feature, question, other)
// 2. Fills in subject + message
// 3. We auto-collect context: plan, browser, txn count, screen size
// 4. If user is signed in → save to Supabase 'feedback' table
// 5. If anonymous → save to localStorage + show email fallback
// 6. Admin sees all feedback in AdminPage (future: add feedback tab)
//
// WHY NOT IN-APP CHAT:
// Chat requires real-time infra (WebSockets), constant monitoring,
// and if it breaks, customers can't reach us. Email is more reliable.
// This widget gives users a smooth in-app experience while routing
// to a durable backend (Supabase + email notification via webhook).
//
// DEPENDS ON: AppContext, supabase, config/database, config/storage
// CONSUMED BY: App.tsx (route), Navbar (link), FeedbackButton (FAB)
// ============================================================

type FeedbackCategory = 'bug' | 'feature' | 'question' | 'other';

interface FeedbackForm {
  category: FeedbackCategory;
  subject: string;
  message: string;
  email: string;
}

const CATEGORIES: { key: FeedbackCategory; label: string; icon: string; desc: string; color: string }[] = [
  { key: 'bug', label: 'Bug Report', icon: 'warning', desc: 'Something isn\'t working right', color: 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' },
  { key: 'feature', label: 'Feature Request', icon: 'flash', desc: 'I wish TrackSpendZ could...', color: 'text-brand-600 bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800' },
  { key: 'question', label: 'Question', icon: 'search', desc: 'I need help with something', color: 'text-brand-600 bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800' },
  { key: 'other', label: 'Other', icon: 'mail', desc: 'General feedback or suggestion', color: 'text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600' },
];

const FeedbackPage = () => {
  const { userId, userEmail, plan, transactions } = useApp();

  usePageMeta({ title: 'Send Feedback | TrackSpendZ', description: 'Report bugs, request features, or ask questions. We read every message and respond within 24 hours.', canonical: '/feedback' });

  const [form, setForm] = useState<FeedbackForm>({
    category: 'bug',
    subject: '',
    message: '',
    email: userEmail || '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Past submissions from this session (localStorage)
  const pastSubmissions = useMemo(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.FEEDBACK_SUBMISSIONS);
      return raw ? JSON.parse(raw) as { date: string; subject: string; category: string }[] : [];
    } catch { return []; }
  }, [submitted]);

  /** Collect diagnostic context automatically */
  const collectContext = () => ({
    plan,
    transactionCount: transactions.length,
    userAgent: navigator.userAgent,
    screenSize: `${window.innerWidth}x${window.innerHeight}`,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    isAuthenticated: !!userId,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) {
      setError('Please fill in the subject and message.');
      return;
    }
    if (!form.email.trim() || !form.email.includes('@')) {
      setError('Please provide a valid email so we can respond to you.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      user_id: userId || null,
      email: form.email.trim(),
      category: form.category,
      subject: form.subject.trim(),
      message: form.message.trim(),
      context: collectContext(),
      status: 'open',
      created_at: new Date().toISOString(),
    };

    try {
      // Save to Supabase if possible
      const { error: dbError } = await getSupabase().from(TABLES.FEEDBACK).insert([payload]);

      if (dbError) {
        console.warn('[FeedbackPage] Supabase save failed, saving locally:', dbError);
        // Fall back to localStorage
        saveFeedbackLocally(payload);
      }

      // Also save to localStorage as receipt
      saveFeedbackLocally(payload);

      setSubmitted(true);
      setForm({ category: 'bug', subject: '', message: '', email: form.email });
    } catch (err) {
      console.error('[FeedbackPage] Submit failed:', err);
      // Save locally as backup
      saveFeedbackLocally(payload);
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  const saveFeedbackLocally = (payload: Record<string, unknown>) => {
    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEYS.FEEDBACK_SUBMISSIONS) || '[]');
      existing.push({ date: payload.created_at, subject: payload.subject, category: payload.category });
      localStorage.setItem(STORAGE_KEYS.FEEDBACK_SUBMISSIONS, JSON.stringify(existing.slice(-50)));
    } catch (e) { console.warn('[FeedbackPage] localStorage save failed:', e); }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="max-w-xl mx-auto px-4 sm:px-6 pt-20 pb-16 text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <Icon name="check" className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-3">Thank you for your feedback!</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-8">
            We&rsquo;ve received your {form.category === 'bug' ? 'bug report' : form.category === 'feature' ? 'feature request' : 'message'} and will get back to you at <strong>{form.email}</strong> within 24 hours.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => setSubmitted(false)} className="btn-secondary px-6 py-2 text-sm">
              Send Another
            </button>
            <Link to="/dashboard" className="btn-primary px-6 py-2 text-sm">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-12 pb-20">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Send Us Feedback</h1>
          <p className="text-slate-500 dark:text-slate-400">Found a bug? Have an idea? We read every message and respond within 24 hours.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Category Selector */}
          <div>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-3">What&rsquo;s this about?</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, category: cat.key }))}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    form.category === cat.key
                      ? cat.color + ' border-current shadow-sm'
                      : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-slate-200 dark:hover:border-slate-600'
                  }`}
                >
                  <Icon name={cat.icon} className="w-5 h-5 mx-auto mb-1" />
                  <p className="text-xs font-semibold">{cat.label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Email (pre-filled if logged in) */}
          <div>
            <label htmlFor="fb-email" className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">Your email</label>
            <input
              id="fb-email"
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="you@example.com"
              className="input-field w-full"
              required
            />
            <p className="text-xs text-slate-400 mt-1">So we can respond to you. We never share your email.</p>
          </div>

          {/* Subject */}
          <div>
            <label htmlFor="fb-subject" className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">Subject</label>
            <input
              id="fb-subject"
              type="text"
              value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              placeholder={
                form.category === 'bug' ? 'e.g., Chart not loading after file upload' :
                form.category === 'feature' ? 'e.g., Support for joint bank accounts' :
                form.category === 'question' ? 'e.g., How do I import from HDFC?' :
                'Your subject here'
              }
              className="input-field w-full"
              required
              maxLength={200}
            />
          </div>

          {/* Message */}
          <div>
            <label htmlFor="fb-message" className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
              {form.category === 'bug' ? 'What happened? (steps to reproduce help us fix it faster)' :
               form.category === 'feature' ? 'Describe what you\'d like and why it matters to you' :
               'Your message'}
            </label>
            <textarea
              id="fb-message"
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              placeholder={
                form.category === 'bug'
                  ? '1. I uploaded a PDF statement from HDFC\n2. Clicked Analyze\n3. The chart shows no data but I can see transactions in the Data tab'
                  : 'Tell us more...'
              }
              rows={6}
              className="input-field w-full resize-none"
              required
              maxLength={5000}
            />
            <p className="text-xs text-slate-400 mt-1 text-right">{form.message.length}/5000</p>
          </div>

          {/* Auto-collected context info */}
          <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Diagnostic info (sent automatically to help us debug):</p>
            <div className="flex flex-wrap gap-2">
              {[
                `Plan: ${plan}`,
                `Transactions: ${transactions.length}`,
                `Screen: ${window.innerWidth}x${window.innerHeight}`,
                userId ? 'Signed in' : 'Anonymous',
              ].map(tag => (
                <span key={tag} className="text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md">{tag}</span>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full py-3 text-sm"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Sending...
              </span>
            ) : 'Send Feedback'}
          </button>
        </form>

        {/* Previous submissions */}
        {pastSubmissions.length > 0 && (
          <div className="mt-10">
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3">Your recent submissions</h3>
            <div className="space-y-2">
              {pastSubmissions.slice(-5).reverse().map((s, i) => (
                <div key={i} className="flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm">
                  <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${
                    s.category === 'bug' ? 'bg-red-50 dark:bg-red-900/20 text-red-600' :
                    s.category === 'feature' ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600' :
                    'bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                  }`}>{s.category}</span>
                  <span className="text-slate-700 dark:text-slate-200 flex-1 truncate">{s.subject}</span>
                  <span className="text-xs text-slate-400">{new Date(s.date).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alternative: Email directly */}
        <div className="text-center mt-8 pt-6 border-t border-slate-100 dark:border-slate-700">
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Prefer email? Write to us at{' '}
            <a href="mailto:support@trackspendz.com" className="text-brand-600 hover:underline">support@trackspendz.com</a>
          </p>
        </div>

        <div className="text-center mt-6">
          <Link to="/" className="text-sm text-brand-600 hover:underline">&larr; Back to Home</Link>
        </div>
      </div>
    </div>
  );
};

export default FeedbackPage;
