
export const CURRENCIES = {
    USD: { symbol: '$', rate: 1, locale: 'en-US' },
    EUR: { symbol: '€', rate: 0.92, locale: 'de-DE' },
    INR: { symbol: '₹', rate: 83.5, locale: 'en-IN' }, // en-IN handles 1,23,45,678 automatically
    GBP: { symbol: '£', rate: 0.79, locale: 'en-GB' },
};

export type Currency = keyof typeof CURRENCIES;

// Helper to detect currency based on browser timezone
export const detectUserCurrency = (): Currency => {
    try {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        if (!timeZone) return 'USD';

        // 1. India
        if (timeZone.includes('Kolkata') || timeZone.includes('Calcutta') || timeZone.includes('India')) {
            return 'INR';
        }
        
        // 2. UK
        if (timeZone.includes('London') || timeZone.includes('Belfast')) {
            return 'GBP';
        }

        // 3. Europe (Broad check for standard timezones starting with Europe, excluding UK ones caught above)
        if (timeZone.startsWith('Europe/')) {
            return 'EUR';
        }

        // 4. Default to USD for Americas, Asia, Australia, etc.
        return 'USD';
    } catch (e) {
        return 'USD';
    }
};

export const formatAmount = (value: number, currency: Currency): string => {
    const selected = CURRENCIES[currency];
    return new Intl.NumberFormat(selected.locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
};
