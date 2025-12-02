
import { Transaction } from '../types';

const DB_NAME = 'TrackSpendzDB';
const STORE_NAME = 'transactions';
const DB_VERSION = 1;

export const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject("Your browser doesn't support a stable version of IndexedDB.");
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error("IndexedDB error:", (event.target as any).error);
            reject("IndexedDB error: " + (event.target as any).error);
        };

        request.onsuccess = (event) => {
            resolve((event.target as IDBOpenDBRequest).result);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
};

export const saveToStorage = async (transactions: Transaction[]): Promise<void> => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            transactions.forEach(t => store.put(t));

            transaction.oncomplete = () => {
                db.close();
                console.log(`Saved ${transactions.length} transactions to storage.`);
                resolve();
            };
            
            transaction.onerror = (event) => {
                db.close();
                console.error("Transaction save error:", (event.target as any).error);
                reject((event.target as any).error);
            };
        });
    } catch (err) {
        console.error("Failed to save to storage", err);
        throw err;
    }
};

export const deleteFromStorage = async (ids: string[]): Promise<void> => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            ids.forEach(id => store.delete(id));

            transaction.oncomplete = () => {
                db.close();
                console.log(`Deleted ${ids.length} transactions from storage.`);
                resolve();
            };
            
            transaction.onerror = (event) => {
                db.close();
                console.error("Delete error:", (event.target as any).error);
                reject((event.target as any).error);
            };
        });
    } catch (err) {
        console.error("Failed to delete from storage", err);
        throw err;
    }
};

export const loadFromStorage = async (): Promise<Transaction[]> => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                db.close();
                const results = request.result || [];
                console.log(`Loaded ${results.length} transactions from storage.`);
                resolve(results);
            };

            request.onerror = (event) => {
                db.close();
                console.error("Load error:", (event.target as any).error);
                reject((event.target as any).error);
            };
        });
    } catch (err) {
        console.warn("Could not load from storage (might be first run):", err);
        return [];
    }
};

export const resetApplicationData = async (): Promise<void> => {
    // We use a Promise.race to ensure this function eventually returns
    // even if the database is "blocked" by an open connection in another tab/window.
    const deleteOp = new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase(DB_NAME);
        
        req.onsuccess = () => {
            console.log("Database deleted successfully");
            resolve();
        };
        
        req.onerror = () => {
            console.error("Error deleting database");
            resolve(); // Resolve anyway to proceed with reload
        };
        
        req.onblocked = () => {
            console.warn("Database delete blocked");
            resolve(); // Resolve anyway to proceed with reload
        };
    });

    const timeout = new Promise<void>((resolve) => {
        setTimeout(() => {
            console.warn("Database reset timed out, forcing reload");
            resolve();
        }, 1000);
    });

    return Promise.race([deleteOp, timeout]);
};
