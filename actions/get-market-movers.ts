
'use server';

import { getMultipleStockPrices } from './get-stock-price';
import { FOREX_INSTRUMENTS } from '@/lib/forex-config';

/**
 * @fileOverview Institutional Market Movers Engine.
 * Scans a strategic basket of high-liquidity assets to find top gainers/losers.
 */

const TOP_INDIAN_SYMBOLS = [
    { symbol: 'RELIANCE', exchange: 'NSE' },
    { symbol: 'TCS', exchange: 'NSE' },
    { symbol: 'HDFCBANK', exchange: 'NSE' },
    { symbol: 'ICICIBANK', exchange: 'NSE' },
    { symbol: 'INFY', exchange: 'NSE' },
    { symbol: 'BHARTIARTL', exchange: 'NSE' },
    { symbol: 'SBIN', exchange: 'NSE' },
    { symbol: 'ITC', exchange: 'NSE' },
    { symbol: 'HINDUNILVR', exchange: 'NSE' },
    { symbol: 'LT', exchange: 'NSE' },
    { symbol: 'BAJFINANCE', exchange: 'NSE' },
    { symbol: 'KOTAKBANK', exchange: 'NSE' },
    { symbol: 'ADANIENT', exchange: 'NSE' },
    { symbol: 'AXISBANK', exchange: 'NSE' },
    { symbol: 'ASIANPAINT', exchange: 'NSE' },
    { symbol: 'MARUTI', exchange: 'NSE' },
    { symbol: 'SUNPHARMA', exchange: 'NSE' },
    { symbol: 'TITAN', exchange: 'NSE' },
    { symbol: 'ULTRACEMCO', exchange: 'NSE' },
    { symbol: 'ADANIPORTS', exchange: 'NSE' },
];

export async function getMarketMovers(marketType: 'indian' | 'forex' = 'indian') {
    try {
        const instruments = marketType === 'indian' 
            ? TOP_INDIAN_SYMBOLS 
            : FOREX_INSTRUMENTS.slice(0, 20).map(i => ({ symbol: i.symbol, exchange: 'FOREX' }));

        const res = await getMultipleStockPrices(instruments);
        if (!res.success) throw new Error(res.error);

        const data = Object.values(res.data).map(item => {
            const prevClose = item.price - item.change;
            const changePercent = prevClose !== 0 ? (item.change / prevClose) * 100 : 0;
            return {
                ...item,
                exchange: marketType === 'indian' ? 'NSE' : 'FOREX',
                changePercent
            };
        });

        const gainers = [...data].sort((a, b) => b.changePercent - a.changePercent).slice(0, 10);
        const losers = [...data].sort((a, b) => a.changePercent - b.changePercent).slice(0, 10);

        return { success: true, gainers, losers };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
