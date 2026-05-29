import type { Transaction } from '@/types';
import { STORAGE_KEYS } from '@/config/storage';

// ============================================================
// IndexedDB Local Repository
// ============================================================

const DB_VERSION = 2;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(STORAGE_KEYS.TXN_DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORAGE_KEYS.TXN_STORE_NAME)) {
        const store = db.createObjectStore(STORAGE_KEYS.TXN_STORE_NAME, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('owner', 'owner', { unique: false });
        store.createIndex('category', 'category', { unique: false });
      }
    };
  });
};

/** Writes transactions to IndexedDB. `put` upserts by `id`, so re-saves overwrite. */
export const localSave = async (transactions: Transaction[]): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORAGE_KEYS.TXN_STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORAGE_KEYS.TXN_STORE_NAME);
    transactions.forEach(t => store.put(t));
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
};

/** Loads all local transactions. Returns `[]` if IndexedDB is unavailable (e.g. private mode). */
export const localLoad = async (): Promise<Transaction[]> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORAGE_KEYS.TXN_STORE_NAME], 'readonly');
      const store = tx.objectStore(STORAGE_KEYS.TXN_STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => { db.close(); resolve(request.result || []); };
      request.onerror = () => { db.close(); reject(request.error); };
    });
  } catch { return []; }
};

/** Deletes transactions by id from IndexedDB. Silent on missing ids. */
export const localDelete = async (ids: string[]): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORAGE_KEYS.TXN_STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORAGE_KEYS.TXN_STORE_NAME);
    ids.forEach(id => store.delete(id));
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
};

/** Drops the entire IndexedDB database. Used by "Reset all data" in Settings. */
export const localReset = async (): Promise<void> => {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(STORAGE_KEYS.TXN_DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
  });
};

/** Fast count of locally-stored transactions, without loading the rows. Returns 0 on error. */
export const localCount = async (): Promise<number> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORAGE_KEYS.TXN_STORE_NAME], 'readonly');
      const store = tx.objectStore(STORAGE_KEYS.TXN_STORE_NAME);
      const request = store.count();
      request.onsuccess = () => { db.close(); resolve(request.result); };
      request.onerror = () => { db.close(); reject(request.error); };
    });
  } catch { return 0; }
};
