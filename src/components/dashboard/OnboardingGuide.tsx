import React from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/common/Icons';

interface Props {
  hasTransactions: boolean;
  hasAssets: boolean;
  onStartUpload: () => void;
}

const steps = [
  {
    id: 1,
    icon: 'document',
    title: 'Upload Your First Statement',
    desc: 'Grab any bank or credit card statement (Excel, CSV, or PDF) and drop it here. We auto-detect columns and categorize everything.',
    action: 'upload',
  },
  {
    id: 2,
    icon: 'pieChart',
    title: 'Explore Your Dashboard',
    desc: 'See where your money goes. Monthly trends, category breakdowns, savings rate — all calculated automatically from your data.',
    action: 'none',
  },
  {
    id: 3,
    icon: 'coins',
    title: 'Track Your Net Worth',
    desc: 'Go to Net Assets to record what you own — savings, investments, property, retirement. Watch your wealth grow month by month.',
    action: 'assets',
  },
  {
    id: 4,
    icon: 'fire',
    title: 'Calculate Your FIRE Number',
    desc: 'Once you have expenses and assets, the FIRE calculator shows exactly when you can achieve financial independence.',
    action: 'none',
  },
];

export const OnboardingGuide: React.FC<Props> = ({ hasTransactions, hasAssets, onStartUpload }) => {
  const completedSteps = (hasTransactions ? 2 : 0) + (hasAssets ? 1 : 0);

  if (completedSteps >= 3) return null; // User is past onboarding

  return (
    <div className="mb-8">
      <div className="card p-6 bg-brand-50 dark:bg-slate-800 border border-brand-100 dark:border-slate-700">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-brand-600 text-white rounded-lg flex items-center justify-center text-lg font-bold">
            {completedSteps}/{steps.length}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Welcome to TrackSpendZ</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Get set up in 5 minutes. Here's your roadmap.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {steps.map((step) => {
            const done = (step.id <= 2 && hasTransactions) || (step.id === 3 && hasAssets) || (step.id === 4 && hasTransactions && hasAssets);
            return (
              <div key={step.id} className={`flex gap-3 p-3 rounded-lg transition-colors ${done ? 'bg-green-50/80 dark:bg-green-950/30' : 'bg-white/80 dark:bg-slate-700/50'}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${done ? 'bg-green-100 dark:bg-green-900/40' : 'bg-slate-100 dark:bg-slate-600'}`}>
                  <Icon
                    name={done ? 'check' : step.icon}
                    className={`w-4 h-4 ${done ? 'text-green-600 dark:text-green-400' : 'text-brand-600 dark:text-brand-400'}`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${done ? 'text-green-700 dark:text-green-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{step.desc}</p>
                  {!done && step.action === 'upload' && (
                    <button onClick={onStartUpload} className="mt-2 text-xs font-medium text-brand-600 hover:underline">
                      Upload now →
                    </button>
                  )}
                  {!done && step.action === 'assets' && (
                    <Link to="/assets" className="mt-2 text-xs font-medium text-brand-600 hover:underline block">
                      Go to Net Assets →
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
