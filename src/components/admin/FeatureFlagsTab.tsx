import { useEffect, useState } from 'react';
import { loadFeatureFlags, toggleFeatureFlag } from '@/services/featureFlags';
import { logAdminAction } from '@/services/adminAudit';
import type { FeatureFlag } from '@/types';

interface Props {
  adminId: string;
  adminEmail: string;
}

// ============================================================
// Feature Flags Tab — live toggle switches with audit trail
// ============================================================

export const FeatureFlagsTab = ({ adminId, adminEmail }: Props) => {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFeatureFlags()
      .then(setFlags)
      .catch(() => setError('Failed to load feature flags. Connect Supabase to enable this feature.'))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (flag: FeatureFlag) => {
    if (saving) return; // prevent double-click
    setSaving(flag.id);
    const newEnabled = !flag.enabled;
    try {
      await toggleFeatureFlag(flag.id, newEnabled, adminId);
      await logAdminAction(adminId, adminEmail, 'toggle_flag', 'feature_flag', flag.id, {
        flag_name: flag.name,
        from: flag.enabled,
        to: newEnabled,
      });
      setFlags(prev => prev.map(f =>
        f.id === flag.id
          ? { ...f, enabled: newEnabled, updated_by: adminId, updated_at: new Date().toISOString() }
          : f
      ));
    } catch {
      setError(`Failed to toggle flag "${flag.name}".`);
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-slate-500 text-sm">Loading feature flags...</div>
      </div>
    );
  }

  if (error && flags.length === 0) {
    return (
      <div className="card p-8 text-center border-2 border-dashed border-slate-200">
        <div className="text-4xl mb-3">🚩</div>
        <h3 className="text-lg font-bold text-slate-700 mb-2">Feature Flags</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">{error}</p>
      </div>
    );
  }

  if (flags.length === 0) {
    return (
      <div className="card p-8 text-center border-2 border-dashed border-slate-200">
        <div className="text-4xl mb-3">🚩</div>
        <h3 className="text-lg font-bold text-slate-700 mb-2">No Feature Flags Yet</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Insert rows into the <code className="font-mono bg-slate-100 px-1 rounded">feature_flags</code> table
          to manage flags here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-700">Feature Flags</h2>
          <p className="text-xs text-slate-500 mt-0.5">Every toggle is recorded in the admin audit log.</p>
        </div>
        <span className="text-xs text-slate-500">{flags.length} flag{flags.length !== 1 ? 's' : ''}</span>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {flags.map(flag => (
          <div key={flag.id} className="card p-5 flex items-start gap-4">
            {/* Toggle */}
            <button
              onClick={() => handleToggle(flag)}
              disabled={saving === flag.id}
              aria-label={`Toggle ${flag.name}`}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors mt-0.5 focus:outline-none ${
                flag.enabled ? 'bg-brand-600' : 'bg-slate-200'
              } ${saving === flag.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                flag.enabled ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-slate-800">{flag.name}</p>
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                  flag.enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {flag.enabled ? 'ON' : 'OFF'}
                </span>
                {saving === flag.id && (
                  <span className="text-xs text-slate-500">Saving...</span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{flag.description}</p>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="text-xs text-slate-300 font-mono">{flag.id}</span>
                {flag.updated_by && (
                  <span className="text-xs text-slate-500">
                    Updated by <span className="font-medium">{flag.updated_by.substring(0, 8)}…</span>
                  </span>
                )}
                {flag.updated_at && (
                  <span className="text-xs text-slate-300">
                    {new Date(flag.updated_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
