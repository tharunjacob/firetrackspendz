import { useEffect, useState, useCallback } from 'react';
import { getSupabase } from '@/services/supabase';
import { TABLES } from '@/config/database';

// ============================================================
// Format Presets Tab — admin review of community format library
// ============================================================
//
// Shows all format_presets rows (pending, verified, rejected).
// Admin can verify or reject pending entries.
// Pending presets auto-promote after 3 confirmed successes via RPC,
// but admin can also manually verify/reject from here.
// ============================================================

interface FormatPreset {
  id: string;
  header_sig: string;
  sample_headers: string[];
  mapping: Record<string, unknown>;
  status: 'pending' | 'verified' | 'rejected';
  successful_imports: number;
  failed_imports: number;
  created_at: string;
  updated_at: string;
}

export const FormatPresetsTab = () => {
  const [presets, setPresets] = useState<FormatPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');
  const [fileStats, setFileStats] = useState({ pdf: 0, excel: 0, csv: 0, total: 0 });

  const loadPresets = useCallback(async () => {
    setLoading(true);
    const supabase = getSupabase();
    
    const presetsQuery = supabase
      .from(TABLES.FORMAT_PRESETS)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    const filesQuery = supabase
      .from('user_files')
      .select('file_name, file_type');

    const [presetsRes, filesRes] = await Promise.all([presetsQuery, filesQuery]);

    setPresets((presetsRes.data as FormatPreset[]) || []);

    if (filesRes.data) {
      let pdfCount = 0;
      let csvCount = 0;
      let excelCount = 0;
      
      filesRes.data.forEach((file: any) => {
        const name = (file.file_name || '').toLowerCase();
        const type = (file.file_type || '').toLowerCase();
        
        if (name.endsWith('.pdf') || type.includes('pdf')) {
          pdfCount++;
        } else if (name.endsWith('.csv') || type.includes('csv')) {
          csvCount++;
        } else if (name.endsWith('.xls') || name.endsWith('.xlsx') || type.includes('excel') || type.includes('spreadsheet') || type.includes('officedocument')) {
          excelCount++;
        }
      });
      
      setFileStats({
        pdf: pdfCount,
        excel: excelCount,
        csv: csvCount,
        total: filesRes.data.length,
      });
    }

    setLoading(false);
  }, []);

  useEffect(() => { loadPresets(); }, [loadPresets]);

  const updateStatus = async (id: string, status: 'verified' | 'rejected') => {
    const supabase = getSupabase();
    const { error } = await supabase
      .from(TABLES.FORMAT_PRESETS)
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (!error) {
      setPresets(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    }
  };

  const filtered = statusFilter === 'all'
    ? presets
    : presets.filter(p => p.status === statusFilter);

  const statusBadge = (status: string) => {
    const base = 'inline-flex px-2 py-0.5 rounded-full text-xs font-semibold';
    if (status === 'verified')  return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400`;
    if (status === 'rejected') return `${base} bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400`;
    return `${base} bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400`;
  };

  const counts = {
    all: presets.length,
    pending: presets.filter(p => p.status === 'pending').length,
    verified: presets.filter(p => p.status === 'verified').length,
    rejected: presets.filter(p => p.status === 'rejected').length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Format Presets</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Community-contributed bank file column mappings. Verify to serve to all users; reject to exclude.
          </p>
        </div>
        <button
          onClick={loadPresets}
          disabled={loading}
          className="px-3 py-1.5 text-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* File Upload Statistics Dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2 mb-4">
        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Uploads</p>
          <p className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1">{fileStats.total} file{fileStats.total !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">PDFs (AI Reader)</p>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{fileStats.pdf}</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Excel Files (Mapped)</p>
          <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">{fileStats.excel}</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">CSV Files (Mapped)</p>
          <p className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-1">{fileStats.csv}</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'pending', 'verified', 'rejected'] as const).map(f => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === f
                ? 'bg-brand-600 text-white'
                : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading format presets…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500">No {statusFilter !== 'all' ? statusFilter : ''} presets found.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Sample Headers</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Confirmed</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Failed</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Created</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filtered.map(preset => (
                <tr key={preset.id} className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
                  <td className="px-4 py-3 max-w-xs">
                    <div className="flex flex-wrap gap-1">
                      {(preset.sample_headers || []).slice(0, 4).map((h, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs font-mono text-slate-600 dark:text-slate-300 truncate max-w-[120px]" title={h}>
                          {h}
                        </span>
                      ))}
                      {preset.sample_headers?.length > 4 && (
                        <span className="px-1.5 py-0.5 text-xs text-slate-500">+{preset.sample_headers.length - 4} more</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={statusBadge(preset.status)}>{preset.status}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">
                    {preset.successful_imports}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">
                    {preset.failed_imports}
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {new Date(preset.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {preset.status !== 'verified' && (
                        <button
                          onClick={() => updateStatus(preset.id, 'verified')}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                          Verify
                        </button>
                      )}
                      {preset.status !== 'rejected' && (
                        <button
                          onClick={() => updateStatus(preset.id, 'rejected')}
                          className="px-2.5 py-1 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 text-xs font-semibold rounded-lg transition-colors"
                        >
                          Reject
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
