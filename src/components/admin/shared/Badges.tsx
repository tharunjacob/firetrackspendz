
export const PlanBadge = ({ plan }: { plan: string }) => (
  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
    plan === 'enterprise' ? 'bg-amber-100 text-amber-700' :
    plan === 'pro' ? 'bg-brand-100 text-brand-700' :
    'bg-slate-100 text-slate-600'
  }`}>
    {plan || 'free'}
  </span>
);

export const ScopeBadge = ({ scope }: { scope: string }) => (
  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
    scope === 'system' ? 'bg-green-100 text-green-700' :
    scope === 'admin' ? 'bg-amber-100 text-amber-700' :
    'bg-slate-100 text-slate-600'
  }`}>{scope}</span>
);

export const LevelBadge = ({ level }: { level: string }) => (
  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
    level === 'error' ? 'bg-red-100 text-red-700' :
    level === 'warn' ? 'bg-amber-100 text-amber-700' :
    'bg-brand-100 text-brand-700'
  }`}>{level.toUpperCase()}</span>
);

export const HealthCard = ({ label, value, status }: {
  label: string; value: string; status: 'healthy' | 'warning' | 'critical';
}) => (
  <div className={`card p-5 border-l-4 ${
    status === 'healthy' ? 'border-l-green-500' : status === 'warning' ? 'border-l-amber-500' : 'border-l-red-500'
  }`}>
    <div className="flex items-center gap-2 mb-1">
      <div className={`w-2.5 h-2.5 rounded-full ${
        status === 'healthy' ? 'bg-green-500' : status === 'warning' ? 'bg-amber-500' : 'bg-red-500'
      }`} />
      <p className="text-xs text-slate-500 uppercase">{label}</p>
    </div>
    <p className="text-2xl font-bold text-slate-800">{value}</p>
  </div>
);
