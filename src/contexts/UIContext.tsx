import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import type { Currency, DashboardTab } from '@/types';
import { detectUserCurrency } from '@/utils/constants';

// ============================================================
// UI Context — Handles UI-only state
// ============================================================

interface UIState {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  activeTab: DashboardTab;
  setActiveTab: (t: DashboardTab) => void;
  toast: { message: string; visible: boolean; type: 'success' | 'error' | 'info' };
  showToast: (message: string, type?: 'success' | 'error' | 'info', duration?: number) => void;
  hideToast: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const UIContext = createContext<UIState | null>(null);

export const useUI = () => {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
};

export const useTheme = () => {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useTheme must be used within UIProvider');
  return { theme: ctx.theme, toggleTheme: ctx.toggleTheme };
};

export const UIProvider = ({ children }: { children: ReactNode }) => {
  const [currency, setCurrency] = useState<Currency>(detectUserCurrency());
  const [activeTab, setActiveTab] = useState<DashboardTab>('Summary');
  const [toast, setToast] = useState<{ message: string; visible: boolean; type: 'success' | 'error' | 'info' }>({ message: '', visible: false, type: 'success' });

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('tsz_theme');
    if (saved === 'dark' || saved === 'light') return saved as 'light' | 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('tsz_theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success', duration?: number) => {
    const ms = duration ?? (type === 'error' ? 6000 : 3000);
    setToast({ message, visible: true, type });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), ms);
  }, []);

  const hideToast = useCallback(() => {
    setToast(prev => ({ ...prev, visible: false }));
  }, []);

  const value = useMemo(
    () => ({
      currency,
      setCurrency,
      activeTab,
      setActiveTab,
      toast,
      showToast,
      hideToast,
      theme,
      toggleTheme,
    }),
    [currency, activeTab, toast, showToast, hideToast, theme, toggleTheme]
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};