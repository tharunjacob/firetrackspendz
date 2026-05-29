
export const StatCard = ({ label, value, color }: { label: string; value: string | number; color?: string }) => (
  <div className="card p-4">
    <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
    <p className={`text-2xl font-bold mt-1 ${color || 'text-slate-800'}`}>{value}</p>
  </div>
);

export const MiniStat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3">
    <p className="text-xs text-slate-400 dark:text-slate-400">{label}</p>
    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{value}</p>
  </div>
);
