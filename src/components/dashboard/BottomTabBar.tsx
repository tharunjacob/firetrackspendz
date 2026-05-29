import { Icon } from '@/components/common/Icons';
import { TAB_GROUPS, TAB_DISPLAY_NAMES, type DashboardTab } from '@/types';

const BOTTOM_TABS: { tab: DashboardTab; icon: string; label: string }[] = [
  { tab: 'Summary', icon: 'chart', label: 'Summary' },
  { tab: 'Monthly Analysis', icon: 'arrowUp', label: 'Monthly' },
  { tab: 'Categories', icon: 'wallet', label: 'Categories' },
  { tab: 'Data', icon: 'search', label: 'Data' },
  { tab: 'FIRE Calculator', icon: 'fire', label: 'FIRE' },
];

interface Props {
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
  moreSheetOpen: boolean;
  setMoreSheetOpen: (open: boolean) => void;
}

export const BottomTabBar = ({ activeTab, setActiveTab, moreSheetOpen, setMoreSheetOpen }: Props) => {
  const isBottomTabActive = BOTTOM_TABS.some(t => t.tab === activeTab);
  return (
    <>
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex items-stretch"
        style={{ height: '60px', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {BOTTOM_TABS.map(({ tab, icon, label }) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 transition-colors ${
                isActive ? 'text-brand-600' : 'text-slate-400 active:text-slate-600'
              }`}
            >
              <Icon name={icon} className="w-5 h-5" />
              <span className="text-[9px] font-semibold leading-none mt-0.5">{label}</span>
            </button>
          );
        })}
        <button
          onClick={() => setMoreSheetOpen(true)}
          className={`flex flex-col items-center justify-center gap-0.5 flex-1 transition-colors ${
            !isBottomTabActive ? 'text-brand-600' : 'text-slate-400 active:text-slate-600'
          }`}
        >
          <Icon name="menu" className="w-5 h-5" />
          <span className="text-[9px] font-semibold leading-none mt-0.5">More</span>
        </button>
      </nav>

      {moreSheetOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50 lg:hidden"
            onClick={() => setMoreSheetOpen(false)}
          />
          <div className="fixed bottom-0 inset-x-0 z-50 bg-white dark:bg-slate-800 rounded-t-2xl lg:hidden max-h-[72vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">All Views</h3>
              <button
                onClick={() => setMoreSheetOpen(false)}
                className="p-2 -mr-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <Icon name="close" className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              </button>
            </div>
            <div className="p-3 grid grid-cols-2 gap-2 pb-8">
              {TAB_GROUPS.map(group => (
                <div key={group.label} className="contents">
                  <div className="col-span-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-2 mb-1 px-1">
                    {group.label}
                  </div>
                  {group.tabs.map(tab => {
                    const t = tab as DashboardTab;
                    return (
                      <button
                        key={t}
                        onClick={() => { setActiveTab(t); setMoreSheetOpen(false); }}
                        className={`flex items-center px-3 py-3 rounded-xl text-sm font-medium transition-colors min-h-[44px] text-left ${
                          activeTab === t
                            ? 'bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800'
                            : 'bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 active:bg-slate-100 dark:active:bg-slate-600'
                        }`}
                      >
                        {TAB_DISPLAY_NAMES[t] ?? t}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
};
