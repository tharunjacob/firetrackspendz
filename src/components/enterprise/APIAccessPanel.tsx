import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Icon } from '@/components/common/Icons';

// ============================================================
// API Access Panel â€” Enterprise Feature
// Manage API keys for programmatic access to TrackSpendZ data
// ============================================================

interface APIKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsed: string | null;
  isActive: boolean;
}

const STORAGE_KEY = 'tsz_api_keys';

export const APIAccessPanel = () => {
  const { plan, showToast } = useApp();
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setKeys(JSON.parse(stored));
    } catch (e) { console.warn('[APIAccessPanel] Failed to load API keys from localStorage:', e); }
  }, []);

  const save = (k: APIKey[]) => {
    setKeys(k);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(k));
  };

  const generateKey = () => {
    if (!newKeyName.trim()) return;
    if (keys.length >= 5) {
      showToast('Maximum 5 API keys allowed', 'error');
      return;
    }

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const randomPart = Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const key: APIKey = {
      id: crypto.randomUUID?.() || Date.now().toString(),
      name: newKeyName.trim(),
      key: `tsz_${randomPart}`,
      createdAt: new Date().toISOString(),
      lastUsed: null,
      isActive: true,
    };

    save([...keys, key]);
    setNewKeyName('');
    setRevealedKey(key.id);
    showToast('API key created');
  };

  const revokeKey = (id: string) => {
    if (!confirm('Revoke this API key? This cannot be undone.')) return;
    save(keys.map(k => k.id === id ? { ...k, isActive: false } : k));
    showToast('API key revoked');
  };

  const deleteKey = (id: string) => {
    if (!confirm('Permanently delete this API key?')) return;
    save(keys.filter(k => k.id !== id));
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    showToast('API key copied to clipboard');
  };

  const isEnterprise = plan === 'enterprise';

  if (!isEnterprise) {
    return (
      <div className="card p-8 text-center max-w-lg mx-auto">
        <Icon name="shield" className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-700 mb-2">API Access</h3>
        <p className="text-sm text-slate-500 mb-4">
          Programmatically access your financial data via REST API.
          Export transactions, categories, and analytics to integrate with your own tools.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
          <p className="text-xs text-amber-700">Enterprise plan required for API access.</p>
        </div>
        <a href="/pricing" className="text-sm text-brand-600 hover:underline">View Plans</a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-800">API Keys</h3>
        <p className="text-sm text-slate-500">Create and manage API keys for programmatic access to your data.</p>
      </div>

      {/* Create new key */}
      <div className="card p-5">
        <h4 className="text-sm font-bold text-slate-700 mb-3">Create New Key</h4>
        <div className="flex gap-2">
          <input type="text" value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g., My Script)" className="input-field flex-1" maxLength={50} />
          <button onClick={generateKey} disabled={!newKeyName.trim() || keys.length >= 5}
            className="btn-primary px-6 disabled:opacity-50">Generate</button>
        </div>
        <p className="text-xs text-slate-400 mt-2">{5 - keys.length} key{5 - keys.length !== 1 ? 's' : ''} remaining</p>
      </div>

      {/* Keys list */}
      <div className="space-y-3">
        {keys.map(k => (
          <div key={k.id} className={`card p-4 ${!k.isActive ? 'opacity-60' : ''}`}>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-slate-800">{k.name}</p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${k.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {k.isActive ? 'Active' : 'Revoked'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-xs bg-slate-100 px-2 py-1 rounded font-mono text-slate-600">
                    {revealedKey === k.id ? k.key : `tsz_${'â€¢'.repeat(28)}`}
                  </code>
                  {k.isActive && (
                    <>
                      <button onClick={() => setRevealedKey(revealedKey === k.id ? null : k.id)}
                        className="text-xs text-brand-600 hover:underline">
                        {revealedKey === k.id ? 'Hide' : 'Reveal'}
                      </button>
                      <button onClick={() => copyKey(k.key)} className="text-xs text-brand-600 hover:underline">Copy</button>
                    </>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Created {new Date(k.createdAt).toLocaleDateString()}
                  {k.lastUsed ? ` Â· Last used ${new Date(k.lastUsed).toLocaleDateString()}` : ' Â· Never used'}
                </p>
              </div>
              <div className="flex gap-2">
                {k.isActive && (
                  <button onClick={() => revokeKey(k.id)} className="text-xs text-amber-600 hover:underline">Revoke</button>
                )}
                {!k.isActive && (
                  <button onClick={() => deleteKey(k.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {keys.length === 0 && (
        <div className="text-center py-8 text-slate-400">
          <p className="text-sm">No API keys yet. Create one to get started.</p>
        </div>
      )}

      {/* API Coming Soon Notice */}
      <div className="card p-5 bg-amber-50 border border-amber-200">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full uppercase tracking-wide">Coming Soon</span>
          <h4 className="text-sm font-bold text-slate-700">REST API</h4>
        </div>
        <p className="text-sm text-slate-600 mb-3">The REST API is currently in development. Enterprise subscribers will receive early access first.</p>
        <p className="text-xs text-slate-500">Planned: GET /transactions, GET /analytics/monthly, GET /export â€” with Bearer token auth and up to 5 revocable keys per account.</p>
        <a href="mailto:support@trackspendz.com" className="text-xs text-brand-600 hover:underline mt-3 inline-block">Join the API waitlist â†’</a>
      </div>
    </div>
  );
};
