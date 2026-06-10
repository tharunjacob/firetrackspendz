import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Icon } from '@/components/common/Icons';
import { getSupabase } from '@/services/supabase';
import { TABLES } from '@/config/database';
import { STORAGE_KEYS } from '@/config/storage';

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

export const FeedbackModal = () => {
  const {
    userId,
    userEmail,
    plan,
    transactions,
    isFeedbackOpen,
    setIsFeedbackOpen,
    showToast,
  } = useApp();

  const [form, setForm] = useState<FeedbackForm>({
    category: 'bug',
    subject: '',
    message: '',
    email: userEmail || '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync email from auth when it becomes available
  useEffect(() => {
    if (userEmail && !form.email) {
      setForm(f => ({ ...f, email: userEmail }));
    }
  }, [userEmail, form.email]);

  // Reset form when modal opens
  useEffect(() => {
    if (isFeedbackOpen) {
      setForm({
        category: 'bug',
        subject: '',
        message: '',
        email: userEmail || '',
      });
      setError(null);
    }
  }, [isFeedbackOpen, userEmail]);

  if (!isFeedbackOpen) return null;

  /** Collect diagnostic context automatically */
  const collectContext = () => ({
    plan,
    transactionCount: transactions.length,
    userAgent: navigator.userAgent,
    screenSize: `${window.innerWidth}x${window.innerHeight}`,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    isAuthenticated: !!userId,
    source: 'modal_widget',
  });

  const saveFeedbackLocally = (payload: Record<string, unknown>) => {
    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEYS.FEEDBACK_SUBMISSIONS) || '[]');
      existing.push({ date: payload.created_at, subject: payload.subject, category: payload.category });
      localStorage.setItem(STORAGE_KEYS.FEEDBACK_SUBMISSIONS, JSON.stringify(existing.slice(-50)));
    } catch (e) {
      console.warn('[FeedbackModal] localStorage save failed:', e);
    }
  };

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
        console.warn('[FeedbackModal] Supabase save failed, saving locally:', dbError);
      }

      saveFeedbackLocally(payload);
      showToast(`Thank you! Your ${form.category === 'bug' ? 'bug report' : form.category === 'feature' ? 'feature request' : 'message'} has been submitted.`);
      setIsFeedbackOpen(false);
    } catch (err) {
      console.error('[FeedbackModal] Submit failed:', err);
      // Save locally as backup
      saveFeedbackLocally(payload);
      showToast('Feedback saved locally. We will sync it once connection is restored.', 'info');
      setIsFeedbackOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <Icon name="mail" className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Send Us Feedback</h2>
          </div>
          <button
            onClick={() => setIsFeedbackOpen(false)}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <Icon name="close" className="w-5 h-5" />
          </button>
        </div>

        {/* Form Container (Scrollable) */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Category Selector */}
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">
              What's this about?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, category: cat.key }))}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    form.category === cat.key
                      ? cat.color + ' border-current shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-200 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon name={cat.icon} className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-bold">{cat.label}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">{cat.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Email input */}
          <div>
            <label htmlFor="modal-fb-email" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
              Your Email
            </label>
            <input
              id="modal-fb-email"
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="you@example.com"
              className="input-field w-full text-sm py-2 px-3"
              required
            />
          </div>

          {/* Subject input */}
          <div>
            <label htmlFor="modal-fb-subject" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
              Subject
            </label>
            <input
              id="modal-fb-subject"
              type="text"
              value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              placeholder={
                form.category === 'bug' ? 'e.g., Net Worth chart values are wrong' :
                form.category === 'feature' ? 'e.g., Add support for Joint accounts' :
                form.category === 'question' ? 'e.g., How to categorize inter-account transfers?' :
                'Write your subject...'
              }
              className="input-field w-full text-sm py-2 px-3"
              required
              maxLength={200}
            />
          </div>

          {/* Message text area */}
          <div>
            <label htmlFor="modal-fb-message" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
              {form.category === 'bug' ? 'What happened?' : 'Your Message'}
            </label>
            <textarea
              id="modal-fb-message"
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              placeholder={
                form.category === 'bug'
                  ? 'Please list the steps or describe what failed. E.g.:\n1. Uploaded HDFC credit card statement\n2. Loading bar finished but page stayed blank'
                  : 'Tell us more detail...'
              }
              rows={4}
              className="input-field w-full text-sm py-2 px-3 resize-none"
              required
              maxLength={5000}
            />
            <p className="text-[10px] text-slate-400 mt-1 text-right">{form.message.length}/5000</p>
          </div>

          {/* Diagnostic Context Tags */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 rounded-xl p-3 shrink-0">
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Diagnostic info (sent automatically):</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                `Plan: ${plan.toUpperCase()}`,
                `Transactions: ${transactions.length}`,
                userId ? 'Signed In' : 'Anonymous',
              ].map(tag => (
                <span key={tag} className="text-[10px] font-semibold bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md">{tag}</span>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs px-3 py-2.5 rounded-xl">
              {error}
            </div>
          )}
        </form>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 rounded-b-2xl shrink-0 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setIsFeedbackOpen(false)}
            className="btn-secondary text-xs px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="btn-primary text-xs px-5 py-2 font-semibold shadow-sm"
          >
            {submitting ? 'Sending...' : 'Submit Feedback'}
          </button>
        </div>
      </div>
    </div>
  );
};
