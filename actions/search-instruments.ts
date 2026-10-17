'use server';

import Papa from 'papaparse';
import https from 'https';
import { format, differenceInDays, startOfDay, parseISO } from 'date-fns';
import { FOREX_INSTRUMENTS } from '@/lib/forex-config';

// This is an in-memory cache to hold the instrument data on the server.
let instrumentsCache: any[] = [];
let lastFetchTimestamp = 0;
const CACHE_DURATION = 1000 * 60 * 60 * 8; // Cache for 8 hours

export type SearchResult = {
    tradingsymbol: string;
    name: string;
    instrument_type: string;
    exchange: string;
    lot_size: number;
    expiry?: string;
    strike?: number;
};

type SearchInstrumentsResult = {
    success: true;
    data: SearchResult[];
} | {
    success: false;
    error: string;
};

const ZERODHA_INSTRUMENTS_URL = 'https://api.kite.trade/instruments';

function downloadAndParseCSV(): Promise<any[]> {
    return new Promise((resolve, reject) => {
        https.get(ZERODHA_INSTRUMENTS_URL, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download instruments. Status code: ${response.statusCode}`));
                return;
            }
            
            let csvData = '';
            response.on('data', (chunk) => {
                csvData += chunk;
            });

            response.on('end', () => {
                Papa.parse(csvData, {
                    header: true,
                    dynamicTyping: true,
                    complete: (results) => {
                        console.log(`Successfully parsed ${results.data.length} Zerodha instruments.`);
                        const validData = results.data.filter((row: any) => row.instrument_token && row.tradingsymbol);
                        resolve(validData);
                    },
                    error: (error: any) => {
                        console.error('Error parsing CSV:', error);
                        reject(error);
                    }
                });
            });
        }).on('error', (err) => {
            console.error('Error downloading CSV:', err);
            reject(err);
        });
    });
}


// This function will be called by the new /search page.
export async function getInstruments(): Promise<SearchInstrumentsResult> {
    const now = Date.now();
    if (instrumentsCache.length > 0 && (now - lastFetchTimestamp) < CACHE_DURATION) {
        return { success: true, data: instrumentsCache };
    }

    try {
        const zerodhaInstruments = await downloadAndParseCSV();
        instrumentsCache = zerodhaInstruments;
        lastFetchTimestamp = now;
        return { success: true, data: instrumentsCache };
    } catch (error: any) {
        if (instrumentsCache.length > 0) {
            return { success: true, data: instrumentsCache };
        }
        return { success: false, error: error.message || "An unknown error occurred while fetching instruments." };
    }
}

export async function getInstrumentsForSearch(query: string, marketType: 'indian' | 'forex' = 'indian'): Promise<SearchInstrumentsResult> {
    const queryParts = query.toLowerCase().replace(/,/g, '').trim().split(/\s+/).filter(part => part !== '');
    if (queryParts.length === 0) return { success: true, data: [] };

    if (marketType === 'forex') {
        // Return results from the static Forex Registry
        const filtered = FOREX_INSTRUMENTS.filter(inst => {
            const label = (inst.label || '').toLowerCase();
            const symbol = (inst.symbol || '').toLowerCase();
            return queryParts.every(part => label.includes(part) || symbol.includes(part));
        }).map(inst => ({
            tradingsymbol: inst.symbol,
            name: inst.label,
            instrument_type: inst.category.toUpperCase(),
            exchange: 'FOREX',
            lot_size: inst.lotSize
        }));
        return { success: true, data: filtered as any };
    }

    // Default: Indian Market (Zerodha)
    if (!instrumentsCache || instrumentsCache.length === 0) {
        const result = await getInstruments();
        if (!result.success) return result;
    }

    const filtered = instrumentsCache.filter(inst => {
        const name = (inst.name || '').toLowerCase();
        const symbol = (inst.tradingsymbol || '').toLowerCase();
        return queryParts.every(part => name.includes(part) || symbol.includes(part));
    }).slice(0, 50);

    return { success: true, data: filtered };
}

/**
 * OPTION CHAIN DATA ENGINE
 * Filters the master list for a specific index and groups them by expiry/strike.
 */
export async function getOptionChainData(index: string) {
    if (!instrumentsCache || instrumentsCache.length === 0) {
        await getInstruments();
    }

    // Standard Index Map for Symbol Prefixes
    const namePrefix = index.toUpperCase();
    
    // Filter for CE/PE belonging to the index
    const options = instrumentsCache.filter(inst => 
        (inst.name === namePrefix || inst.tradingsymbol.startsWith(namePrefix)) &&
        (inst.instrument_type === 'CE' || inst.instrument_type === 'PE')
    );

    if (options.length === 0) return { success: false, error: 'No options found for this index.' };

    // 1. Extract and sort unique expiries
    const expiries = Array.from(new Set(options.map(o => o.expiry))).sort((a, b) => {
        return new Date(a!).getTime() - new Date(b!).getTime();
    });

    // 2. Group by Expiry -> Strike
    const groupedByExpiry: Record<string, any> = {};

    expiries.forEach(expiry => {
        const expiryOptions = options.filter(o => o.expiry === expiry);
        const strikes = Array.from(new Set(expiryOptions.map(o => o.strike))).sort((a, b) => a! - b!);
        
        groupedByExpiry[expiry!] = strikes.map(strike => {
            return {
                strike,
                ce: expiryOptions.find(o => o.strike === strike && o.instrument_type === 'CE'),
                pe: expiryOptions.find(o => o.strike === strike && o.instrument_type === 'PE'),
            };
        });
    });

    return {
        success: true,
        data: {
            expiries,
            chain: groupedByExpiry
        }
    };
}

/**
 * FETCH NEAREST EXPIRY (Official API Based)
 */
export async function getNearestExpiry(symbol: string): Promise<{ date: string, days: number } | null> {
    const res = await getInstruments();
    if (!res.success) return null;

    const today = startOfDay(new Date());

    const expiries = res.data
        .filter(inst => inst.name === symbol && inst.expiry)
        .map(inst => parseISO(inst.expiry!))
        .filter(date => date >= today)
        .sort((a, b) => a.getTime() - b.getTime());

    const match = expiries[0];

    if (!match) return null;

    const diffDays = differenceInDays(match, today);

    return {
        date: format(match, 'dd MMMM'),
        days: diffDays
    };
}
