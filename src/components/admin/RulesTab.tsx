import { useMemo, useState } from 'react';
import { ScopeBadge } from './shared/Badges';
import type { LearningRule } from '@/types';

interface Props {
  rules: LearningRule[];
  promoteRule: (rule: LearningRule) => void;
  deleteRule: (rule: LearningRule) => void;
}

export const RulesTab = ({ rules, promoteRule, deleteRule }: Props) => {
  const [ruleSearch, setRuleSearch] = useState('');

  const filteredRules = useMemo(() => {
    const q = ruleSearch.toLowerCase();
    return rules.filter(r => !q || r.keyword.toLowerCase().includes(q) || r.value.toLowerCase().includes(q));
  }, [rules, ruleSearch]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <input type="text" value={ruleSearch} onChange={e => setRuleSearch(e.target.value)}
          placeholder="Search rules by keyword or category..." className="input-field flex-1" />
        <div className="text-sm text-slate-500 whitespace-nowrap">
          {filteredRules.length} rule{filteredRules.length !== 1 ? 's' : ''} ·{' '}
          {rules.filter(r => r.scope === 'system').length} system
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700 text-xs text-slate-500 dark:text-slate-400 uppercase sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left">Keyword</th>
                <th className="px-4 py-3 text-left">Maps To</th>
                <th className="px-4 py-3 text-left">Field</th>
                <th className="px-4 py-3 text-left">Scope</th>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRules.map(r => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-3 font-mono text-xs bg-slate-50 dark:bg-slate-700/50">{r.keyword}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">{r.value}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{r.target_field}</td>
                  <td className="px-4 py-3"><ScopeBadge scope={r.scope || r.source} /></td>
                  <td className="px-4 py-3 text-slate-500 text-xs font-mono">{r.user_id?.substring(0, 8) || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {r.scope !== 'system' && r.source !== 'system' && (
                        <button onClick={() => promoteRule(r)} className="text-xs text-brand-600 hover:underline">Promote</button>
                      )}
                      <button onClick={() => deleteRule(r)} className="text-xs text-red-500 hover:underline">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRules.length === 0 && (
            <p className="text-center text-sm text-slate-500 py-8">No rules found.</p>
          )}
        </div>
      </div>
    </div>
  );
};
