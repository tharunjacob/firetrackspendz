import type { Transaction } from '@/types';

// ============================================================
// Data Export Service — CSV & JSON export
// ============================================================

export const exportToCSV = (transactions: Transaction[], filename?: string): void => {
  const headers = ['Date', 'Description', 'Amount', 'Type', 'Category', 'Sub Category', 'Owner', 'Notes', 'Currency'];
  const rows = transactions.map(t => [
    t.date, t.notes || t.original_description || '',
    t.amount.toString(), t.type, t.category, t.subCategory || '',
    t.owner || '', t.notes || '', '',
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"`).join(','))].join('\n');
  downloadFile(csv, filename || `trackspendz_export_${dateStamp()}.csv`, 'text/csv');
};

export const exportToJSON = (transactions: Transaction[], filename?: string): void => {
  const json = JSON.stringify(transactions, null, 2);
  downloadFile(json, filename || `trackspendz_export_${dateStamp()}.json`, 'application/json');
};

export const exportAssetSnapshotsToCSV = (snapshots: any[], filename?: string): void => {
  const headers = ['Date', 'Owner', 'Category', 'Accessibility', 'Principal', 'Current Value', 'Currency', 'Notes'];
  const rows = snapshots.map(s => [
    s.date, s.owner, s.category, s.accessibility_tier,
    s.principal.toString(), s.current_value.toString(), s.currency || '', s.notes || '',
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"`).join(','))].join('\n');
  downloadFile(csv, filename || `trackspendz_assets_${dateStamp()}.csv`, 'text/csv');
};

const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const dateStamp = () => new Date().toISOString().split('T')[0];
