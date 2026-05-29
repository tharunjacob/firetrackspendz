import React, { useState, useMemo } from 'react';
import { Icon } from '@/components/common/Icons';
import { formatAmount } from '@/utils/constants';
import type { AssetSnapshot } from '@/types/assets';
import type { Currency } from '@/types';

interface Props {
  snapshots: AssetSnapshot[];
  currency: Currency;
  onDelete: (ids: string[]) => void;
  onDeleteMonth: (date: string) => void;
}

export const AssetDataTable: React.FC<Props> = ({ snapshots, currency, onDelete, onDeleteMonth }) => {
  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('All');
  const [sortField, setSortField] = useState<'date' | 'current_value'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const owners = useMemo(() => ['All', ...new Set(snapshots.map(s => s.owner))], [snapshots]);
  const dates = useMemo(() => [...new Set(snapshots.map(s => s.date))].sort().reverse(), [snapshots]);

  const filtered = useMemo(() => {
    let data = [...snapshots];
    if (ownerFilter !== 'All') data = data.filter(s => s.owner === ownerFilter);
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(s => s.category.toLowerCase().includes(q) || s.owner.toLowerCase().includes(q) || s.notes?.toLowerCase().includes(q));
    }
    data.sort((a, b) => {
      const av = sortField === 'date' ? a.date : a.current_value;
      const bv = sortField === 'date' ? b.date : b.current_value;
      return sortDir === 'asc' ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
    });
    return data;
  }, [snapshots, ownerFilter, search, sortField, sortDir]);

  const toggleSort = (field: 'date' | 'current_value') => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkDelete = () => {
    if (selected.size === 0) return;
    onDelete(Array.from(selected));
    setSelected(new Set());
  };

  const fmt = (n: number) => formatAmount(n, currency);
  const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Icon name="search" className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search categories, owners..."
            className="input-field pl-9 text-sm" />
        </div>
        <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} className="input-field text-sm w-36">
          {owners.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        {selected.size > 0 && (
          <button onClick={handleBulkDelete} className="btn-danger text-sm px-4 py-2 flex items-center gap-1.5">
            <Icon name="trash" className="w-4 h-4" /> Delete {selected.size}
          </button>
        )}
      </div>

      {/* Delete by month */}
      {dates.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-slate-500">Delete entire month:</span>
          {dates.slice(0, 12).map(d => (
            <button key={d} onClick={() => { if (confirm(`Delete all entries for ${fmtDate(d)}?`)) onDeleteMonth(d); }}
              className="text-xs px-2 py-1 bg-slate-100 text-slate-500 rounded hover:bg-red-50 hover:text-red-600 transition-colors">
              {fmtDate(d)}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700 text-xs text-slate-500 dark:text-slate-400 uppercase">
              <tr>
                <th className="px-3 py-3 w-8">
                  <input type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={() => setSelected(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(s => s.id)))}
                  />
                </th>
                <th className="px-3 py-3 text-left cursor-pointer hover:text-brand-600" onClick={() => toggleSort('date')}>
                  Date {sortField === 'date' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-3 py-3 text-left">Owner</th>
                <th className="px-3 py-3 text-left">Category</th>
                <th className="px-3 py-3 text-left">Tier</th>
                <th className="px-3 py-3 text-right">Principal</th>
                <th className="px-3 py-3 text-right cursor-pointer hover:text-brand-600" onClick={() => toggleSort('current_value')}>
                  Current Value {sortField === 'current_value' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-3 py-3 text-right">Gain/Loss</th>
                <th className="px-3 py-3 text-right">Return %</th>
                <th className="px-3 py-3 text-left">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.slice(0, 300).map(s => {
                const gain = s.current_value - s.principal;
                const ret = s.principal > 0 ? gain / s.principal : 0;
                return (
                  <tr key={s.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 ${selected.has(s.id) ? 'bg-brand-50/30 dark:bg-brand-950/20' : ''}`}>
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} />
                    </td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{fmtDate(s.date)}</td>
                    <td className="px-3 py-2 font-medium text-slate-700">{s.owner}</td>
                    <td className="px-3 py-2">{s.category}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{s.accessibility_tier}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{fmt(s.principal)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs font-medium">{fmt(s.current_value)}</td>
                    <td className={`px-3 py-2 text-right text-xs font-medium ${gain >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {gain >= 0 ? '+' : ''}{fmt(gain)}
                    </td>
                    <td className={`px-3 py-2 text-right text-xs ${ret >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {s.principal > 0 ? (ret * 100).toFixed(1) + '%' : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500 max-w-[150px] truncate">{s.notes || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-center text-sm text-slate-500 py-8">No entries found.</p>
          )}
          {filtered.length > 300 && (
            <p className="text-center text-xs text-slate-500 py-3">Showing 300 of {filtered.length} entries</p>
          )}
        </div>
      </div>
    </div>
  );
};
