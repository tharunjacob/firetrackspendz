import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo, Icon } from '@/components/common/Icons';
import { NotificationCenter } from '@/components/dashboard/NotificationCenter';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/UIContext';
import { CURRENCIES } from '@/utils/constants';
import type { Currency } from '@/types';

export const Navbar = () => {
  const { userId, userEmail, plan, setIsAuthOpen, logout, currency, setCurrency, transactions } = useApp();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const hasData = transactions.length > 0;

  return (
    <nav className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 px-4 py-3 flex items-center justify-between shrink-0 relative z-40">
      <div className="flex items-center gap-6">
        <Link to="/">
          <Logo size="sm" />
        </Link>
        {userId ? (
          <div className="hidden md:flex items-center gap-4 text-sm font-medium text-slate-600 dark:text-slate-400">
            <Link to="/dashboard" className="hover:text-brand-600 transition-colors">Expenses</Link>
            <Link to="/assets" className="hover:text-brand-600 transition-colors">Net Assets</Link>
            {plan === 'enterprise' && <Link to="/family" className="hover:text-brand-600 transition-colors">Family</Link>}
            <Link to="/help" className="hover:text-brand-600 transition-colors">Help</Link>
          </div>
        ) : !hasData ? (
          <div className="hidden md:flex items-center gap-4 text-sm font-medium text-slate-600 dark:text-slate-400">
            <Link to="/features" className="hover:text-brand-600 transition-colors">Features</Link>
            <Link to="/pricing" className="hover:text-brand-600 transition-colors">Pricing</Link>
            <Link to="/help" className="hover:text-brand-600 transition-colors">Help</Link>
          </div>
        ) : (
          <div className="hidden md:flex items-center gap-4 text-sm font-medium text-slate-600 dark:text-slate-400">
            <Link to="/dashboard" className="hover:text-brand-600 transition-colors">Dashboard</Link>
            <Link to="/help" className="hover:text-brand-600 transition-colors">Help</Link>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="w-5 h-5" />
        </button>

        {/* Currency Selector */}
        <div className="relative">
          <button
            onClick={() => setCurrencyOpen(!currencyOpen)}
            className="px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            {CURRENCIES[currency].symbol} {currency}
          </button>
          {currencyOpen && (
            <div className="absolute right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-2 z-50 min-w-[160px]">
              {(Object.keys(CURRENCIES) as Currency[]).map(c => (
                <button
                  key={c}
                  onClick={() => { setCurrency(c); setCurrencyOpen(false); }}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex justify-between ${c === currency ? 'text-brand-600 font-semibold' : 'text-slate-700 dark:text-slate-200'}`}
                >
                  <span>{CURRENCIES[c].symbol} {c}</span>
                  <span className="text-slate-400">{CURRENCIES[c].name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {userId && <NotificationCenter />}

        {userId ? (
          <div className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <div className="w-8 h-8 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center font-bold text-sm">
                {(userEmail || 'U')[0].toUpperCase()}
              </div>
              <span className="hidden md:inline text-sm font-medium text-slate-700 dark:text-slate-200">{userEmail?.split('@')[0]}</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-2 z-50 min-w-[180px]">
                <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                  <p className="text-xs text-slate-400">Signed in as</p>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{userEmail}</p>
                </div>
                <Link to="/settings" onClick={() => setMenuOpen(false)} className="w-full px-4 py-2 text-left text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
                  <Icon name="cog" className="w-4 h-4" /> Settings
                </Link>
                <button
                  onClick={() => { logout(); setMenuOpen(false); }}
                  className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                >
                  <Icon name="logout" className="w-4 h-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setIsAuthOpen(true)}
            className="btn-primary text-sm py-1.5 px-4"
          >
            Sign in
          </button>
        )}
      </div>
    </nav>
  );
};