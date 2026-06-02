import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/config/routes';

// ============================================================
// Floating Feedback Button — Always visible on every page
// ============================================================
//
// WHY THIS EXISTS:
// Users should always have a way to tell us something is broken
// or request a feature, no matter which page they're on.
//
// DESIGN:
// - Small pill on the right edge of the screen
// - Expands on hover to show "Feedback" text
// - Clicking navigates to /feedback page
// - Doesn't overlap with the mobile FAB in DashboardShell
//
// DEPENDS ON: config/routes
// CONSUMED BY: App.tsx (rendered globally)
// ============================================================

export const FeedbackButton = () => {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={() => navigate(ROUTES.FEEDBACK)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="fixed right-0 bottom-24 z-40 bg-slate-700 hover:bg-slate-800 text-white rounded-l-xl shadow-md transition-all duration-200 flex items-center gap-2 overflow-hidden group"
      style={{ padding: hovered ? '10px 16px 10px 12px' : '10px 10px' }}
      aria-label="Send feedback"
    >
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
      <span
        className="text-xs font-semibold whitespace-nowrap transition-all duration-200"
        style={{ width: hovered ? 'auto' : 0, opacity: hovered ? 1 : 0 }}
      >
        Feedback
      </span>
    </button>
  );
};
