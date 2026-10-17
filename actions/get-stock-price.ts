
'use server';
import 'dotenv/config';

export type StockPriceResult = {
    success: true;
    data: {
        symbol: string;
        price: number;
        change: number;
        dayLow: number;
        dayHigh: number;
    };
} | {
    success: false;
    error: string;
};

export type BatchPriceResult = {
    success: true;
    data: Record<string, {
        symbol: string;
        price: number;
        change: number;
        dayLow: number;
        dayHigh: number;
    }>;
} | {
    success: false;
    error: string;
};

type InstrumentInput = {
    symbol: string;
    exchange: string;
};

/**
 * FETCH SINGLE PRICE
 */
export async function getStockPrice(
    details: InstrumentInput
): Promise<StockPriceResult> {
    const apiKey = process.env.ZERODHA_API_KEY;
    const accessToken = process.env.ZERODHA_ACCESS_TOKEN;

    if (!apiKey || !accessToken || accessToken === 'YOUR_MANUALLY_GENERATED_ACCESS_TOKEN') {
        return { success: false, error: 'Config Error' };
    }

    const instrumentQuery = `${details.exchange.toUpperCase()}:${details.symbol.toUpperCase()}`;
    const url = `https://api.kite.trade/quote?i=${encodeURIComponent(instrumentQuery)}`;

    try {
        const res = await fetch(url, {
            headers: { 'X-Kite-Version': '3', 'Authorization': `token ${apiKey}:${accessToken}` },
            cache: 'no-store'
        });

        if (!res.ok) return { success: false, error: `API Status: ${res.status}` };

        const data = await res.json();
        const stockData = data.data?.[instrumentQuery];
        
        if (!stockData) return { success: false, error: `No data for ${instrumentQuery}` };

        return {
            success: true,
            data: {
                symbol: stockData.tradingsymbol,
                price: stockData.last_price,
                change: stockData.last_price - (stockData.ohlc?.close || stockData.last_price),
                dayLow: stockData.ohlc?.low || 0,
                dayHigh: stockData.ohlc?.high || 0,
            },
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * FETCH MULTIPLE PRICES (High-Performance Batching)
 * Optimized for low memory churn.
 */
export async function getMultipleStockPrices(
    instruments: InstrumentInput[]
): Promise<BatchPriceResult> {
    if (!instruments || instruments.length === 0) return { success: true, data: {} };

    const apiKey = process.env.ZERODHA_API_KEY;
    const accessToken = process.env.ZERODHA_ACCESS_TOKEN;
    const results: Record<string, any> = {};

    try {
        // Zerodha allows max 500 instruments per request
        const batchSize = 500;
        
        for (let i = 0; i < instruments.length; i += batchSize) {
            const batch = instruments.slice(i, i + batchSize);
            const queryParams = batch
                .map(inst => `i=${encodeURIComponent(`${inst.exchange.toUpperCase()}:${inst.symbol.toUpperCase()}`)}`)
                .join('&');
            
            const url = `https://api.kite.trade/quote?${queryParams}`;

            const res = await fetch(url, {
                headers: { 
                    'X-Kite-Version': '3', 
                    'Authorization': `token ${apiKey}:${accessToken}` 
                },
                cache: 'no-store'
            });

            if (!res.ok) throw new Error(`Batch API Fail: ${res.status}`);

            const json = await res.json();
            const batchData = json.data || {};

            Object.keys(batchData).forEach(key => {
                const item = batchData[key];
                results[key] = {
                    symbol: item.tradingsymbol,
                    price: item.last_price,
                    change: item.last_price - (item.ohlc?.close || item.last_price),
                    dayLow: item.ohlc?.low || 0,
                    dayHigh: item.ohlc?.high || 0,
                };
            });
        }

        return { success: true, data: results };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
