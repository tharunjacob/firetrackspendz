import { useState } from 'react';

interface Props {
  feedbackItems: any[];
  resolveFeedback: (id: string) => void;
}

export const FeedbackTab = ({ feedbackItems, resolveFeedback }: Props) => {
  const [feedbackFilter, setFeedbackFilter] = useState<'all' | 'open' | 'resolved'>('all');

  const filtered = feedbackItems.filter(f => feedbackFilter === 'all' || f.status === feedbackFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-700">Customer Feedback ({feedbackItems.length})</h3>
        <div className="flex gap-2">
          {(['all', 'open', 'resolved'] as const).map(f => (
            <button key={f} onClick={() => setFeedbackFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                feedbackFilter === f ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {filtered.map(fb => (
        <div key={fb.id} className={`card p-4 border-l-4 ${
          fb.status === 'resolved' ? 'border-l-green-400 opacity-60' :
          fb.category === 'bug' ? 'border-l-red-400' :
          fb.category === 'feature' ? 'border-l-purple-400' :
          'border-l-blue-400'
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${
                  fb.category === 'bug' ? 'bg-red-50 text-red-600' :
                  fb.category === 'feature' ? 'bg-purple-50 text-purple-600' :
                  fb.category === 'question' ? 'bg-blue-50 text-blue-600' :
                  'bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                }`}>{fb.category}</span>
                <span className={`text-xs font-medium ${fb.status === 'open' ? 'text-amber-600' : 'text-green-600'}`}>
                  {fb.status}
                </span>
                <span className="text-xs text-slate-400">{new Date(fb.created_at).toLocaleString()}</span>
              </div>
              <h4 className="font-semibold text-slate-800 text-sm">{fb.subject}</h4>
              <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{fb.message}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs text-slate-400">From: {fb.email}</span>
                {fb.user_id && <span className="text-xs text-slate-400">User ID: {fb.user_id.slice(0, 8)}...</span>}
                {fb.context?.plan && <span className="text-xs text-slate-400">Plan: {fb.context.plan}</span>}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              {fb.status === 'open' && (
                <button onClick={() => resolveFeedback(fb.id)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 font-medium">
                  Resolve
                </button>
              )}
              <a href={`mailto:${fb.email}?subject=Re: ${encodeURIComponent(fb.subject)}&body=${encodeURIComponent(`Hi,\n\nThank you for your feedback about "${fb.subject}".\n\n`)}`}
                className="text-xs px-3 py-1.5 rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 font-medium">
                Reply
              </a>
            </div>
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-slate-400 text-sm">No feedback in this category.</div>
      )}
    </div>
  );
};
