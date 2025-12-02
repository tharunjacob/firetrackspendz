import { FileMapping } from '../types';

const STORAGE_KEY = 'trackspendz_learned_mappings_v1';

// Generate a unique signature for the file based on its headers
// We sort the headers to ensure column order doesn't break the signature
export const getFileSignature = (headers: string[]): string => {
    if (!headers || headers.length === 0) return '';
    return headers.map(h => String(h).trim().toLowerCase()).sort().join('|');
};

export const getStoredMapping = (headers: string[]): FileMapping | null => {
    try {
        const signature = getFileSignature(headers);
        if (!signature) return null;

        const storedData = localStorage.getItem(STORAGE_KEY);
        if (!storedData) return null;
        
        const mappings = JSON.parse(storedData);
        const mapping = mappings[signature];
        
        if (mapping) {
            console.log("🧠 Memory: Recognized file format signature.");
            return mapping;
        }
        return null;
    } catch (error) {
        console.warn("Failed to load stored mappings:", error);
        return null;
    }
};

export const saveMapping = (headers: string[], mapping: FileMapping): void => {
    try {
        const signature = getFileSignature(headers);
        if (!signature) return;

        const storedData = localStorage.getItem(STORAGE_KEY);
        const mappings = storedData ? JSON.parse(storedData) : {};
        
        mappings[signature] = mapping;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings));
        console.log("🧠 Memory: Learned new file format signature.");
    } catch (error) {
        console.warn("Failed to save mapping:", error);
    }
};