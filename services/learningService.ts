import { FileMapping } from '../types';

const STORAGE_KEY_MAPPING = 'trackspendz_learned_mappings_v1';
const STORAGE_KEY_RULES = 'trackspendz_category_rules_v1';

// --- FILE MAPPINGS (Existing) ---

export const getFileSignature = (headers: string[]): string => {
    if (!headers || headers.length === 0) return '';
    return headers.map(h => String(h).trim().toLowerCase()).sort().join('|');
};

export const getStoredMapping = (headers: string[]): FileMapping | null => {
    try {
        const signature = getFileSignature(headers);
        if (!signature) return null;

        const storedData = localStorage.getItem(STORAGE_KEY_MAPPING);
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

        const storedData = localStorage.getItem(STORAGE_KEY_MAPPING);
        const mappings = storedData ? JSON.parse(storedData) : {};
        
        mappings[signature] = mapping;
        localStorage.setItem(STORAGE_KEY_MAPPING, JSON.stringify(mappings));
        console.log("🧠 Memory: Learned new file format signature.");
    } catch (error) {
        console.warn("Failed to save mapping:", error);
    }
};

// --- CATEGORY LEARNING RULES (New) ---

export interface CategoryRule {
    keyword: string;
    category: string;
}

export const saveCategoryRule = (keyword: string, category: string): void => {
    try {
        const cleanKey = keyword.trim().toLowerCase();
        if (!cleanKey) return;

        const storedData = localStorage.getItem(STORAGE_KEY_RULES);
        const rules: Record<string, string> = storedData ? JSON.parse(storedData) : {};

        rules[cleanKey] = category;
        localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(rules));
        console.log(`🧠 Memory: Learned rule '${cleanKey}' -> ${category}`);
    } catch (error) {
        console.warn("Failed to save category rule:", error);
    }
};

export const getLearnedCategory = (description: string): string | null => {
    try {
        const storedData = localStorage.getItem(STORAGE_KEY_RULES);
        if (!storedData) return null;

        const rules: Record<string, string> = JSON.parse(storedData);
        const descLower = description.toLowerCase();

        // Check if any rule keyword exists in the description
        // We prioritize longer keywords (more specific) over shorter ones
        const keys = Object.keys(rules).sort((a, b) => b.length - a.length);

        for (const key of keys) {
            if (descLower.includes(key)) {
                return rules[key];
            }
        }
        return null;
    } catch (error) {
        return null;
    }
};

export const getAllRules = (): Record<string, string> => {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY_RULES) || '{}');
    } catch {
        return {};
    }
};

export const deleteRule = (keyword: string): void => {
    try {
        const rules = getAllRules();
        delete rules[keyword.toLowerCase()];
        localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(rules));
    } catch (e) {
        console.error(e);
    }
};