import React, { useState, useEffect } from 'react';
import { signIn, signUp, signInWithGoogle, signInWithMagicLink } from '@/services/auth';
import { Logo, Icon } from '@/components/common/Icons';
import { logEvent, EVENTS } from '@/services/logger';

interface AuthModalProps {
  isOpen?: boolean;
  onClose: () => void;
}

export const AuthModal = ({ isOpen = true, onClose }: AuthModalProps) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'magic'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  // Log modal open once when it becomes visible
  useEffect(() => {
    if (isOpen) logEvent(EVENTS.AUTH_MODAL_OPENED, { mode });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'magic') {
        await signInWithMagicLink(email);
        setMagicLinkSent(true);
        logEvent(EVENTS.AUTH_MAGIC_LINK_SENT, { email });
      } else if (mode === 'signup') {
        logEvent(EVENTS.AUTH_SIGNUP_ATTEMPTED, { email });
        await signUp(email, password, fullName);
        logEvent(EVENTS.AUTH_SIGNUP_SUCCESS, { email });
        onClose();
      } else {
        logEvent(EVENTS.AUTH_LOGIN_ATTEMPTED, { email });
        await signIn(email, password);
        logEvent(EVENTS.AUTH_LOGIN_SUCCESS, { email });
        onClose();
      }
    } catch (err: any) {
      const errMsg = err.message || 'Authentication failed';
      setError(errMsg);
      if (mode === 'signup') {
        logEvent(EVENTS.AUTH_SIGNUP_FAILED, { email, error: errMsg }, 'warn');
      } else if (mode === 'login') {
        logEvent(EVENTS.AUTH_LOGIN_FAILED, { email, error: errMsg }, 'warn');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    logEvent(EVENTS.AUTH_OAUTH_INITIATED, { provider: 'google' });
    try {
      await signInWithGoogle();
      // Redirect-based, so the page will navigate away
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-8 animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <Logo size="sm" />
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <Icon name="close" className="w-6 h-6" />
          </button>
        </div>

        {magicLinkSent ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="check" className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Check your email</h3>
            <p className="text-slate-600 dark:text-slate-400">We sent a magic link to <strong>{email}</strong>. Click it to sign in.</p>
            <button onClick={() => { setMagicLinkSent(false); setMode('login'); }} className="mt-6 text-brand-600 hover:text-brand-700 font-medium">
              Back to login
            </button>
          </div>
        ) : (
          <>
            {/* Google Sign In */}
            <button
              onClick={handleGoogleSignIn}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors mb-4"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span className="font-medium text-slate-700 dark:text-slate-200">Continue with Google</span>
            </button>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700"></div>
              <span className="text-xs text-slate-400 uppercase">or</span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700"></div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <input
                  type="text" placeholder="Full Name" value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="input-field"
                />
              )}

              <input
                type="email" placeholder="Email address" required value={email}
                onChange={e => setEmail(e.target.value)}
                className="input-field"
              />

              {mode !== 'magic' && (
                <input
                  type="password" placeholder="Password" required value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input-field" minLength={6}
                />
              )}

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Magic Link'}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400 space-y-2">
              {mode === 'login' && (
                <>
                  <p>Don't have an account? <button onClick={() => setMode('signup')} className="text-brand-600 font-medium hover:text-brand-700">Sign up</button></p>
                  <p><button onClick={() => setMode('magic')} className="text-brand-600 font-medium hover:text-brand-700">Sign in with magic link</button></p>
                </>
              )}
              {mode === 'signup' && (
                <p>Already have an account? <button onClick={() => setMode('login')} className="text-brand-600 font-medium hover:text-brand-700">Sign in</button></p>
              )}
              {mode === 'magic' && (
                <p><button onClick={() => setMode('login')} className="text-brand-600 font-medium hover:text-brand-700">Back to password login</button></p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
