import React, { useState, useMemo } from 'react';
import { Icon } from '@/components/common/Icons';
import type { AssetSnapshot, NetAssetConfig, AssetCategory } from '@/types/assets';
import { OWNER_RELATIONS } from '@/types/assets';

interface Props {
  config: NetAssetConfig;
  onSave: (snapshots: AssetSnapshot[]) => void;
  onConfigChange: (config: NetAssetConfig) => void;
  existingDates: string[];
  currency: string;
}

export const AssetEntryForm: React.FC<Props> = ({ config, onSave, onConfigChange, existingDates, currency }) => {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0].replace(/-\d{2}$/, '-01'));
  const [entries, setEntries] = useState<Record<string, Record<string, { principal: string; currentValue: string; notes: string }>>>({});
  const [showSettings, setShowSettings] = useState(false);

  // Initialize entry grid: owner → category → { principal, currentValue }
  const initEntries = () => {
    const grid: typeof entries = {};
    for (const owner of config.owners) {
      grid[owner.name] = {};
      for (const cat of config.categories) {
        grid[owner.name][cat.name] = { principal: '', currentValue: '', notes: '' };
      }
    }
    return grid;
  };

  const currentEntries = useMemo(() => {
    if (Object.keys(entries).length === 0) return initEntries();
    return entries;
  }, [entries, config]);

  const updateEntry = (owner: string, category: string, field: 'principal' | 'currentValue' | 'notes', value: string) => {
    setEntries(prev => {
      const next = { ...prev };
      if (!next[owner]) next[owner] = {};
      if (!next[owner][category]) next[owner][category] = { principal: '', currentValue: '', notes: '' };
      next[owner][category] = { ...next[owner][category], [field]: value };
      return next;
    });
  };

  const handleSave = () => {
    const snapshots: AssetSnapshot[] = [];
    const now = new Date().toISOString();

    for (const owner of config.owners) {
      for (const cat of config.categories) {
        const e = currentEntries[owner.name]?.[cat.name];
        const principal = parseFloat(e?.principal || '0') || 0;
        const currentValue = parseFloat(e?.currentValue || '0') || 0;
        if (principal === 0 && currentValue === 0) continue;

        snapshots.push({
          id: `${date}_${owner.name}_${cat.name}`.replace(/\s+/g, '-').toLowerCase(),
          user_id: '',  // filled by caller
          date,
          owner: owner.name,
          category: cat.name,
          accessibility_tier: cat.tier,
          principal,
          current_value: currentValue,
          currency,
          notes: e?.notes || '',
          created_at: now,
        });
      }
    }

    if (snapshots.length === 0) return;
    onSave(snapshots);
    setEntries(initEntries());
  };

  const tierGroups = useMemo(() => {
    const groups = new Map<string, AssetCategory[]>();
    for (const cat of config.categories) {
      const arr = groups.get(cat.tier) || [];
      arr.push(cat);
      groups.set(cat.tier, arr);
    }
    return groups;
  }, [config.categories]);

  const dateAlreadyExists = existingDates.includes(date);

  return (
    <div className="space-y-6">
      {/* Date + Controls */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Snapshot Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-field" />
        </div>
        {dateAlreadyExists && (
          <span className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
            Data exists for this date — saving will overwrite
          </span>
        )}
        <button onClick={() => setShowSettings(!showSettings)} className="btn-secondary text-sm px-4 py-2 flex items-center gap-1.5">
          <Icon name="cog" className="w-4 h-4" /> Customize
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <ConfigPanel config={config} onChange={onConfigChange} onClose={() => setShowSettings(false)} />
      )}

      {/* Entry Grid */}
      {config.owners.map(owner => (
        <div key={owner.name} className="card overflow-hidden">
          <div className="bg-slate-50 dark:bg-slate-700 px-4 py-3 border-b border-slate-100 dark:border-slate-600 flex items-center justify-between">
            <div>
              <span className="font-semibold text-slate-700">{owner.name}</span>
              <span className="text-xs text-slate-500 ml-2">{owner.relation}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/50 dark:bg-slate-700/50 text-xs text-slate-500 dark:text-slate-400 uppercase">
                <tr>
                  <th className="px-4 py-2 text-left w-[180px]">Category</th>
                  <th className="px-4 py-2 text-left">Tier</th>
                  <th className="px-4 py-2 text-right w-[160px]">Invested / Principal</th>
                  <th className="px-4 py-2 text-right w-[160px]">Current Value</th>
                  <th className="px-4 py-2 text-right w-[100px]">Gain/Loss</th>
                  <th className="px-4 py-2 text-left w-[120px]">Notes</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(tierGroups.entries()).map(([tierName, cats]) => (
                  <React.Fragment key={tierName}>
                    <tr className="bg-slate-50/30 dark:bg-slate-700/30">
                      <td colSpan={6} className="px-4 py-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">{tierName}</td>
                    </tr>
                    {cats.map(cat => {
                      const e = currentEntries[owner.name]?.[cat.name] || { principal: '', currentValue: '', notes: '' };
                      const p = parseFloat(e.principal) || 0;
                      const c = parseFloat(e.currentValue) || 0;
                      const gain = c - p;
                      return (
                        <tr key={cat.name} className="border-t border-slate-50 dark:border-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                          <td className="px-4 py-2 font-medium text-slate-700">
                            <span className="mr-2">{cat.icon}</span>{cat.name}
                          </td>
                          <td className="px-4 py-2 text-xs text-slate-500">{cat.tier}</td>
                          <td className="px-4 py-2">
                            <input
                              type="number" step="0.01" placeholder="0.00"
                              value={e.principal}
                              onChange={ev => updateEntry(owner.name, cat.name, 'principal', ev.target.value)}
                              className="w-full text-right text-sm py-1 px-2 border border-slate-200 rounded-lg focus:border-brand-400 focus:ring-1 focus:ring-brand-200 outline-none"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number" step="0.01" placeholder="0.00"
                              value={e.currentValue}
                              onChange={ev => updateEntry(owner.name, cat.name, 'currentValue', ev.target.value)}
                              className="w-full text-right text-sm py-1 px-2 border border-slate-200 rounded-lg focus:border-brand-400 focus:ring-1 focus:ring-brand-200 outline-none"
                            />
                          </td>
                          <td className={`px-4 py-2 text-right text-xs font-medium ${gain > 0 ? 'text-green-600' : gain < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                            {p > 0 || c > 0 ? (gain >= 0 ? '+' : '') + gain.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="text" placeholder="—"
                              value={e.notes}
                              onChange={ev => updateEntry(owner.name, cat.name, 'notes', ev.target.value)}
                              className="w-full text-sm py-1 px-2 border border-slate-200 rounded-lg focus:border-brand-400 focus:ring-1 focus:ring-brand-200 outline-none"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="flex justify-end">
        <button onClick={handleSave} className="btn-primary px-8 py-3 text-sm font-semibold">
          Save Monthly Snapshot
        </button>
      </div>
    </div>
  );
};

// ---- Config Panel ----

const ConfigPanel: React.FC<{ config: NetAssetConfig; onChange: (c: NetAssetConfig) => void; onClose: () => void }> = ({ config, onChange, onClose }) => {
  const [newOwner, setNewOwner] = useState('');
  const [newRelation, setNewRelation] = useState<string>('Self');
  const [newCatName, setNewCatName] = useState('');
  const [newCatTier, setNewCatTier] = useState(config.tiers[0]?.name || 'Investment');
  const [newTierName, setNewTierName] = useState('');

  const addOwner = () => {
    if (!newOwner.trim()) return;
    onChange({ ...config, owners: [...config.owners, { name: newOwner.trim(), relation: newRelation }] });
    setNewOwner('');
  };

  const removeOwner = (name: string) => {
    onChange({ ...config, owners: config.owners.filter(o => o.name !== name) });
  };

  const addCategory = () => {
    if (!newCatName.trim()) return;
    const id = newCatName.trim().toLowerCase().replace(/\s+/g, '-');
    onChange({
      ...config,
      categories: [...config.categories, { id, name: newCatName.trim(), tier: newCatTier, sortOrder: config.categories.length + 1 }],
    });
    setNewCatName('');
  };

  const removeCategory = (id: string) => {
    onChange({ ...config, categories: config.categories.filter(c => c.id !== id) });
  };

  const addTier = () => {
    if (!newTierName.trim()) return;
    const id = newTierName.trim().toLowerCase().replace(/\s+/g, '-');
    onChange({
      ...config,
      tiers: [...config.tiers, { id, name: newTierName.trim(), description: '', color: '#2563eb', sortOrder: config.tiers.length + 1 }],
    });
    setNewTierName('');
  };

  const removeTier = (id: string) => {
    onChange({ ...config, tiers: config.tiers.filter(t => t.id !== id) });
  };

  return (
    <div className="card p-5 space-y-6 border-2 border-brand-100">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-700">Customize Your Tracker</h3>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-600">
          <Icon name="close" className="w-5 h-5" />
        </button>
      </div>

      {/* Owners */}
      <div>
        <h4 className="text-sm font-semibold text-slate-600 mb-2">Household Members</h4>
        <div className="flex flex-wrap gap-2 mb-2">
          {config.owners.map(o => (
            <span key={o.name} className="bg-brand-50 text-brand-700 px-3 py-1 rounded-full text-sm flex items-center gap-2">
              {o.name} <span className="text-brand-400 text-xs">({o.relation})</span>
              {config.owners.length > 1 && (
                <button onClick={() => removeOwner(o.name)} className="text-brand-300 hover:text-red-500">&times;</button>
              )}
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newOwner} onChange={e => setNewOwner(e.target.value)} placeholder="Name" className="input-field flex-1 text-sm" />
          <select value={newRelation} onChange={e => setNewRelation(e.target.value)} className="input-field text-sm w-32">
            {OWNER_RELATIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button onClick={addOwner} className="btn-primary text-sm px-4">Add</button>
        </div>
      </div>

      {/* Accessibility Tiers */}
      <div>
        <h4 className="text-sm font-semibold text-slate-600 mb-2">Accessibility Tiers</h4>
        <div className="flex flex-wrap gap-2 mb-2">
          {config.tiers.map(t => (
            <span key={t.id} className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
              {t.name}
              {config.tiers.length > 1 && (
                <button onClick={() => removeTier(t.id)} className="text-slate-300 hover:text-red-500">&times;</button>
              )}
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newTierName} onChange={e => setNewTierName(e.target.value)} placeholder="New tier name" className="input-field flex-1 text-sm" />
          <button onClick={addTier} className="btn-secondary text-sm px-4">Add Tier</button>
        </div>
      </div>

      {/* Asset Categories */}
      <div>
        <h4 className="text-sm font-semibold text-slate-600 mb-2">Asset Categories</h4>
        <div className="flex flex-wrap gap-2 mb-2">
          {config.categories.map(c => (
            <span key={c.id} className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs flex items-center gap-1.5">
              {c.icon} {c.name} <span className="text-slate-500">({c.tier})</span>
              <button onClick={() => removeCategory(c.id)} className="text-slate-300 hover:text-red-500">&times;</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Category name" className="input-field flex-1 text-sm" />
          <select value={newCatTier} onChange={e => setNewCatTier(e.target.value)} className="input-field text-sm w-40">
            {config.tiers.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
          <button onClick={addCategory} className="btn-secondary text-sm px-4">Add</button>
        </div>
      </div>
    </div>
  );
};
