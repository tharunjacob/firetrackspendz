import { getSupabase } from '@/services/supabase';
import type { AssetSnapshot, NetAssetConfig, MonthlyNetWorth, CategoryReturn, AssetFileMapping } from '@/types/assets';
import { DEFAULT_TIERS, DEFAULT_CATEGORIES } from '@/types/assets';
import { TABLES } from '@/config/database';

// ============================================================
// Asset Storage Service
// Handles CRUD for asset snapshots + config persistence
// ============================================================

const DB_NAME = 'TrackSpendzAssetsDB';
const DB_VERSION = 1;
const STORE_NAME = 'asset_snapshots';
const CONFIG_KEY = 'net_asset_config';

// ---- IndexedDB (local storage) ----

const openDB = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, DB_VERSION);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      store.createIndex('date', 'date');
      store.createIndex('owner', 'owner');
      store.createIndex('category', 'category');
    }
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

// ---- Config (localStorage for simplicity) ----

export const getConfig = (): NetAssetConfig => {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.warn('[assetStorage] Failed to parse config from localStorage:', e); }
  return { owners: [{ name: 'Me', relation: 'Self' }], categories: DEFAULT_CATEGORIES, tiers: DEFAULT_TIERS };
};

export const saveConfig = (config: NetAssetConfig): void => {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
};

// ---- CRUD Operations ----

export const saveSnapshots = async (snapshots: AssetSnapshot[], userId?: string): Promise<void> => {
  // Local
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  for (const s of snapshots) store.put(s);
  await new Promise<void>((res, rej) => {
    tx.oncomplete = () => { db.close(); res(); };
    tx.onerror = () => { db.close(); rej(tx.error); };
  });

  // Cloud (if logged in)
  if (userId) {
    try {
      const rows = snapshots.map(s => ({
        id: s.id, user_id: userId, date: s.date, owner: s.owner,
        category: s.category, accessibility_tier: s.accessibility_tier,
        principal: s.principal, current_value: s.current_value,
        currency: s.currency, notes: s.notes || null,
      }));
      const batchSize = 500;
      for (let i = 0; i < rows.length; i += batchSize) {
        await getSupabase().from(TABLES.ASSET_SNAPSHOTS).upsert(rows.slice(i, i + batchSize));
      }
    } catch (e) { console.warn('Cloud save failed:', e); }
  }
};

export const loadSnapshots = async (userId?: string): Promise<AssetSnapshot[]> => {
  // Try cloud first
  if (userId) {
    try {
      const all: AssetSnapshot[] = [];
      let page = 0;
      const pageSize = 5000;
      const MAX_PAGES = 100;
      let pageCount = 0;
      while (pageCount < MAX_PAGES) {
        pageCount++;
        const { data, error } = await getSupabase()
          .from(TABLES.ASSET_SNAPSHOTS)
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: true })
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
        page++;
      }
      if (all.length > 0) return all;
    } catch (e) { console.warn('Cloud load failed, using local:', e); }
  }

  // Fall back to local
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => { db.close(); resolve(req.result || []); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
};

export const deleteSnapshots = async (ids: string[], userId?: string): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  for (const id of ids) store.delete(id);
  await new Promise<void>((res, rej) => {
    tx.oncomplete = () => { db.close(); res(); };
    tx.onerror = () => { db.close(); rej(tx.error); };
  });

  if (userId) {
    try {
      for (let i = 0; i < ids.length; i += 100) {
        await getSupabase().from(TABLES.ASSET_SNAPSHOTS).delete().in('id', ids.slice(i, i + 100));
      }
    } catch (e) { console.warn('Cloud delete failed:', e); }
  }
};

export const deleteSnapshotsByDate = async (date: string, userId?: string): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const idx = store.index('date');
  const req = idx.openCursor(IDBKeyRange.only(date));
  const ids: string[] = [];
  req.onsuccess = () => {
    const cursor = req.result;
    if (cursor) { ids.push(cursor.value.id); cursor.delete(); cursor.continue(); }
  };
  await new Promise<void>((res, rej) => {
    tx.oncomplete = () => { db.close(); res(); };
    tx.onerror = () => { db.close(); rej(tx.error); };
  });

  if (userId && ids.length > 0) {
    try { await getSupabase().from(TABLES.ASSET_SNAPSHOTS).delete().in('id', ids); } catch (e) { console.error('[assetStorage] Failed to delete cloud snapshots:', e); }
  }
};

// ---- Analytics ----

export const computeMonthlyNetWorth = (snapshots: AssetSnapshot[]): MonthlyNetWorth[] => {
  const byDate = new Map<string, AssetSnapshot[]>();
  for (const s of snapshots) {
    const arr = byDate.get(s.date) || [];
    arr.push(s);
    byDate.set(s.date, arr);
  }

  const dates = Array.from(byDate.keys()).sort();
  const results: MonthlyNetWorth[] = [];
  let prevTotal = 0;

  for (const date of dates) {
    const entries = byDate.get(date)!;
    let totalPrincipal = 0, totalCurrentValue = 0;
    const byOwner: Record<string, { principal: number; currentValue: number }> = {};
    const byCategory: Record<string, { principal: number; currentValue: number }> = {};
    const byTier: Record<string, { principal: number; currentValue: number }> = {};

    for (const e of entries) {
      totalPrincipal += e.principal || 0;
      totalCurrentValue += e.current_value || 0;

      // By owner
      if (!byOwner[e.owner]) byOwner[e.owner] = { principal: 0, currentValue: 0 };
      byOwner[e.owner].principal += e.principal || 0;
      byOwner[e.owner].currentValue += e.current_value || 0;

      // By category
      if (!byCategory[e.category]) byCategory[e.category] = { principal: 0, currentValue: 0 };
      byCategory[e.category].principal += e.principal || 0;
      byCategory[e.category].currentValue += e.current_value || 0;

      // By tier
      if (!byTier[e.accessibility_tier]) byTier[e.accessibility_tier] = { principal: 0, currentValue: 0 };
      byTier[e.accessibility_tier].principal += e.principal || 0;
      byTier[e.accessibility_tier].currentValue += e.current_value || 0;
    }

    const totalGain = totalCurrentValue - totalPrincipal;
    const gainPercent = totalPrincipal > 0 ? totalGain / totalPrincipal : 0;
    const momChange = prevTotal > 0 ? (totalCurrentValue - prevTotal) / prevTotal : 0;

    results.push({ date, totalPrincipal, totalCurrentValue, totalGain, gainPercent, momChange, byOwner, byCategory, byTier });
    prevTotal = totalCurrentValue;
  }

  return results;
};

export const computeCategoryReturns = (snapshots: AssetSnapshot[], latestDate?: string): CategoryReturn[] => {
  const date = latestDate || [...new Set(snapshots.map(s => s.date))].sort().pop();
  if (!date) return [];

  const latest = snapshots.filter(s => s.date === date);
  const prevDates = [...new Set(snapshots.map(s => s.date))].sort();
  const prevDate = prevDates[prevDates.indexOf(date) - 1];
  const prev = prevDate ? snapshots.filter(s => s.date === prevDate) : [];

  const byCat = new Map<string, { tier: string; principal: number; currentValue: number }>();
  for (const e of latest) {
    const cur = byCat.get(e.category) || { tier: e.accessibility_tier, principal: 0, currentValue: 0 };
    cur.principal += e.principal || 0;
    cur.currentValue += e.current_value || 0;
    byCat.set(e.category, cur);
  }

  const prevByCat = new Map<string, number>();
  for (const e of prev) {
    prevByCat.set(e.category, (prevByCat.get(e.category) || 0) + (e.current_value || 0));
  }

  return Array.from(byCat.entries()).map(([category, { tier, principal, currentValue }]) => {
    const gainLoss = currentValue - principal;
    const returnPercent = principal > 0 ? gainLoss / principal : 0;
    const prevVal = prevByCat.get(category) || 0;
    const momChange = prevVal > 0 ? (currentValue - prevVal) / prevVal : 0;
    return { category, tier, principal, currentValue, gainLoss, returnPercent, momChange };
  }).sort((a, b) => b.currentValue - a.currentValue);
};

const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
};

export const parseCSVImport = (csvText: string): Partial<AssetSnapshot>[] => {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  const dateIdx = headers.findIndex(h => h === 'date');
  const ownerIdx = headers.findIndex(h => h === 'owner');
  const categoryIdx = headers.findIndex(h => h === 'category' || h === 'asset type');
  const tierIdx = headers.findIndex(h => h === 'accessibility' || h === 'tier' || h === 'type');
  const principalIdx = headers.findIndex(h => h === 'principal' || h === 'invested' || h === 'invested value');
  const currentIdx = headers.findIndex(h => h === 'total' || h === 'current value' || h === 'current' || h === 'market value');

  if (dateIdx === -1 || categoryIdx === -1 || currentIdx === -1) return [];

  return lines.slice(1).filter(l => l.trim()).map(line => {
    const cols = parseCSVLine(line).map(c => c.trim());
    const cleanNum = (s: string) => {
      // Remove commas, currency symbols, and spaces
      const cleaned = s.replace(/[^0-9.\-]/g, '');
      return parseFloat(cleaned) || 0;
    };

    // Parse date — handle multiple formats
    let dateStr = cols[dateIdx] || '';
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      dateStr = d.toISOString().split('T')[0];
    }

    return {
      date: dateStr,
      owner: cols[ownerIdx] || 'Me',
      category: cols[categoryIdx] || 'Other',
      accessibility_tier: cols[tierIdx] || 'Investment',
      principal: cleanNum(cols[principalIdx] || '0'),
      current_value: cleanNum(cols[currentIdx] || '0'),
    };
  });
};

// ---- Excel Parsing ----

export interface SheetData {
  name: string;
  rows: any[][];
}

export const parseExcelToSheets = async (buffer: ArrayBuffer): Promise<SheetData[]> => {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  return wb.SheetNames.map(name => {
    const sheet = wb.Sheets[name];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    return { name, rows };
  }).filter(s => s.rows.length > 1); // Skip empty sheets
};

/** Format a date value (JS Date, string, or number) to YYYY-MM-DD */
const formatDate = (val: any): string | null => {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().split('T')[0];
  }
  const s = String(val).trim();
  if (!s) return null;
  // Try direct parse
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  // Try DD/MM/YYYY or DD-MM-YYYY
  const parts = s.split(/[\/\-\.]/);
  if (parts.length === 3) {
    const [a, b, c] = parts.map(Number);
    if (c > 1900) { // DD/MM/YYYY
      const d2 = new Date(c, b - 1, a);
      if (!isNaN(d2.getTime())) return d2.toISOString().split('T')[0];
    }
  }
  return null;
};

/** Clean a numeric value from Excel (handle currency symbols, commas, etc.) */
const cleanNumber = (val: any): number => {
  if (typeof val === 'number') return Math.abs(val);
  const s = String(val || '').replace(/[^0-9.\-]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.abs(n);
};

/** Apply an AI-detected column mapping to raw rows, producing asset snapshots */
export const applyAssetMapping = (
  rows: any[][],
  headerIndex: number,
  mapping: AssetFileMapping
): Partial<AssetSnapshot>[] => {
  if (headerIndex < 0 || headerIndex >= rows.length) return [];

  const headers = rows[headerIndex].map((h: any) => String(h || '').trim());
  const colIdx = (colName?: string) => {
    if (!colName) return -1;
    const idx = headers.findIndex(h => h.toLowerCase() === colName.toLowerCase());
    if (idx !== -1) return idx;
    // Fuzzy fallback: partial match
    return headers.findIndex(h => h.toLowerCase().includes(colName.toLowerCase()));
  };

  const dateCol = colIdx(mapping.dateColumn);
  const valueCol = colIdx(mapping.currentValueColumn);
  if (dateCol === -1 || valueCol === -1) return [];

  const ownerCol = colIdx(mapping.ownerColumn);
  const catCol = colIdx(mapping.categoryColumn);
  const tierCol = colIdx(mapping.tierColumn);
  const principalCol = colIdx(mapping.principalColumn);
  const currencyCol = colIdx(mapping.currencyColumn);
  const notesCol = colIdx(mapping.notesColumn);

  const results: Partial<AssetSnapshot>[] = [];

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const dateStr = formatDate(row[dateCol]);
    if (!dateStr) continue;

    const currentValue = cleanNumber(row[valueCol]);
    if (currentValue === 0) continue;

    results.push({
      date: dateStr,
      owner: ownerCol >= 0 ? String(row[ownerCol] || 'Me').trim() : 'Me',
      category: catCol >= 0 ? String(row[catCol] || 'Other').trim() : 'Other',
      accessibility_tier: tierCol >= 0 ? String(row[tierCol] || 'Investment').trim() : 'Investment',
      principal: principalCol >= 0 ? cleanNumber(row[principalCol]) : currentValue,
      current_value: currentValue,
      currency: currencyCol >= 0 ? String(row[currencyCol] || '').trim() : undefined,
      notes: notesCol >= 0 ? String(row[notesCol] || '').trim() : undefined,
    });
  }

  return results;
};
