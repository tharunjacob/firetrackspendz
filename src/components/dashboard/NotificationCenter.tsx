import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Icon } from '@/components/common/Icons';
import { generateNotifications } from '@/services/notifications';

export const NotificationCenter = () => {
  const { transactions } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('tsz_dismissed_notifications');
      return new Set(stored ? JSON.parse(stored) : []);
    } catch { return new Set(); }
  });

  const allNotifications = useMemo(() => generateNotifications(transactions), [transactions]);
  const notifications = allNotifications.filter(n => !dismissed.has(n.id));
  const highPriority = notifications.filter(n => n.severity === 'high');

  useEffect(() => {
    try {
      localStorage.setItem('tsz_dismissed_notifications', JSON.stringify([...dismissed]));
    } catch (e) { console.warn('[NotificationCenter] Failed to save dismissed notifications:', e); }
  }, [dismissed]);

  const dismiss = (id: string) => {
    setDismissed(prev => new Set([...prev, id]));
  };

  const dismissAll = () => {
    setDismissed(prev => new Set([...prev, ...notifications.map(n => n.id)]));
    setIsOpen(false);
  };

  const typeConfig: Record<string, { color: string; bg: string; icon: string }> = {
    warning:     { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', icon: 'warning' },
    anomaly:     { color: 'text-red-600 dark:text-red-400',     bg: 'bg-red-500/10',   icon: 'flash' },
    achievement: { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-500/10', icon: 'check' },
    tip:         { color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-500/10',  icon: 'ai' },
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        title={`${notifications.length} notification${notifications.length !== 1 ? 's' : ''}`}
      >
        <Icon name="bell" className={`w-5 h-5 ${notifications.length > 0 ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`} />
        {notifications.length > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 w-4.5 h-4.5 flex items-center justify-center text-[10px] font-bold text-white rounded-full ${
            highPriority.length > 0 ? 'bg-red-500 animate-pulse' : 'bg-brand-600'
          }`} style={{ minWidth: '18px', height: '18px' }}>
            {notifications.length}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-96 max-h-[480px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Notifications</h3>
              {notifications.length > 0 && (
                <button onClick={dismissAll} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                  Dismiss all
                </button>
              )}
            </div>

            {/* List */}
            <div className="overflow-y-auto max-h-[400px]">
              {notifications.length === 0 ? (
                <div className="py-12 text-center">
                  <Icon name="check" className="w-8 h-8 text-green-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">All caught up!</p>
                  <p className="text-xs text-slate-400 mt-1">No new notifications</p>
                </div>
              ) : (
                notifications.map(n => {
                  const config = typeConfig[n.type] || typeConfig.tip;
                  return (
                    <div key={n.id} className={`px-4 py-3 border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors ${n.severity === 'high' ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}>
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${config.bg}`}>
                          <Icon name={config.icon} className={`w-4 h-4 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{n.title}</p>
                            <button onClick={() => dismiss(n.id)}
                              className="text-slate-300 hover:text-slate-500 transition-colors shrink-0 mt-0.5">
                              <Icon name="close" className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{n.message}</p>
                          {n.category && (
                            <span className="inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">{n.category}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
