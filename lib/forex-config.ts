
/**
 * @fileOverview Institutional Forex & International Instrument Registry
 * Defines the 50-pair spectrum for the Twelve Data Pulse Engine.
 */

export interface ForexInstrument {
    symbol: string;
    label: string;
    category: 'forex' | 'crypto' | 'indices' | 'commodities';
    lotSize: number;
    pipSize: number;
}

export const FOREX_INSTRUMENTS: ForexInstrument[] = [
    // --- FOREX (20 Pairs) ---
    { symbol: 'EUR/USD', label: 'EUR/USD', category: 'forex', lotSize: 100000, pipSize: 0.0001 },
    { symbol: 'GBP/USD', label: 'GBP/USD', category: 'forex', lotSize: 100000, pipSize: 0.0001 },
    { symbol: 'USD/JPY', label: 'USD/JPY', category: 'forex', lotSize: 100000, pipSize: 0.01 },
    { symbol: 'USD/CHF', label: 'USD/CHF', category: 'forex', lotSize: 100000, pipSize: 0.0001 },
    { symbol: 'USD/CAD', label: 'USD/CAD', category: 'forex', lotSize: 100000, pipSize: 0.0001 },
    { symbol: 'AUD/USD', label: 'AUD/USD', category: 'forex', lotSize: 100000, pipSize: 0.0001 },
    { symbol: 'NZD/USD', label: 'NZD/USD', category: 'forex', lotSize: 100000, pipSize: 0.0001 },
    { symbol: 'USD/INR', label: 'USD/INR', category: 'forex', lotSize: 100000, pipSize: 0.0001 },
    { symbol: 'EUR/INR', label: 'EUR/INR', category: 'forex', lotSize: 100000, pipSize: 0.0001 },
    { symbol: 'GBP/INR', label: 'GBP/INR', category: 'forex', lotSize: 100000, pipSize: 0.0001 },
    { symbol: 'JPY/INR', label: 'JPY/INR', category: 'forex', lotSize: 100000, pipSize: 0.01 },
    { symbol: 'EUR/GBP', label: 'EUR/GBP', category: 'forex', lotSize: 100000, pipSize: 0.0001 },
    { symbol: 'EUR/JPY', label: 'EUR/JPY', category: 'forex', lotSize: 100000, pipSize: 0.01 },
    { symbol: 'GBP/JPY', label: 'GBP/JPY', category: 'forex', lotSize: 100000, pipSize: 0.01 },
    { symbol: 'AUD/JPY', label: 'AUD/JPY', category: 'forex', lotSize: 100000, pipSize: 0.01 },
    { symbol: 'EUR/CHF', label: 'EUR/CHF', category: 'forex', lotSize: 100000, pipSize: 0.0001 },
    { symbol: 'CHF/JPY', label: 'CHF/JPY', category: 'forex', lotSize: 100000, pipSize: 0.01 },
    { symbol: 'USD/SGD', label: 'USD/SGD', category: 'forex', lotSize: 100000, pipSize: 0.0001 },
    { symbol: 'USD/HKD', label: 'USD/HKD', category: 'forex', lotSize: 100000, pipSize: 0.0001 },
    { symbol: 'USD/ZAR', label: 'USD/ZAR', category: 'forex', lotSize: 100000, pipSize: 0.0001 },

    // --- CRYPTO (15 Pairs) ---
    { symbol: 'BTC/USD', label: 'Bitcoin', category: 'crypto', lotSize: 1, pipSize: 1.0 },
    { symbol: 'ETH/USD', label: 'Ethereum', category: 'crypto', lotSize: 1, pipSize: 1.0 },
    { symbol: 'SOL/USD', label: 'Solana', category: 'crypto', lotSize: 1, pipSize: 0.1 },
    { symbol: 'BNB/USD', label: 'Binance Coin', category: 'crypto', lotSize: 1, pipSize: 0.1 },
    { symbol: 'XRP/USD', label: 'Ripple', category: 'crypto', lotSize: 1, pipSize: 0.0001 },
    { symbol: 'ADA/USD', label: 'Cardano', category: 'crypto', lotSize: 1, pipSize: 0.0001 },
    { symbol: 'DOGE/USD', label: 'Dogecoin', category: 'crypto', lotSize: 1, pipSize: 0.00001 },
    { symbol: 'AVAX/USD', label: 'Avalanche', category: 'crypto', lotSize: 1, pipSize: 0.1 },
    { symbol: 'DOT/USD', label: 'Polkadot', category: 'crypto', lotSize: 1, pipSize: 0.01 },
    { symbol: 'MATIC/USD', label: 'Polygon', category: 'crypto', lotSize: 1, pipSize: 0.0001 },
    { symbol: 'LINK/USD', label: 'Chainlink', category: 'crypto', lotSize: 1, pipSize: 0.01 },
    { symbol: 'LTC/USD', label: 'Litecoin', category: 'crypto', lotSize: 1, pipSize: 0.01 },
    { symbol: 'SHIB/USD', label: 'Shiba Inu', category: 'crypto', lotSize: 1, pipSize: 0.00000001 },
    { symbol: 'TRX/USD', label: 'Tron', category: 'crypto', lotSize: 1, pipSize: 0.00001 },
    { symbol: 'NEAR/USD', label: 'Near Protocol', category: 'crypto', lotSize: 1, pipSize: 0.01 },

    // --- INDICES (7 Indices) ---
    { symbol: 'DJI', label: 'Dow Jones 30', category: 'indices', lotSize: 10, pipSize: 1.0 },
    { symbol: 'IXIC', label: 'Nasdaq 100', category: 'indices', lotSize: 10, pipSize: 1.0 },
    { symbol: 'SPX', label: 'S&P 500', category: 'indices', lotSize: 10, pipSize: 1.0 },
    { symbol: 'RUT', label: 'Russell 2000', category: 'indices', lotSize: 10, pipSize: 1.0 },
    { symbol: 'VIX', label: 'VIX Index', category: 'indices', lotSize: 10, pipSize: 0.01 },
    { symbol: 'DXY', label: 'US Dollar Index', category: 'indices', lotSize: 10, pipSize: 0.01 },
    { symbol: 'FTSE', label: 'FTSE 100', category: 'indices', lotSize: 10, pipSize: 1.0 },

    // --- COMMODITIES (8 Commodities) ---
    { symbol: 'XAU/USD', label: 'Gold', category: 'commodities', lotSize: 100, pipSize: 0.01 },
    { symbol: 'XAG/USD', label: 'Silver', category: 'commodities', lotSize: 5000, pipSize: 0.001 },
    { symbol: 'WTI', label: 'WTI Oil', category: 'commodities', lotSize: 1000, pipSize: 0.01 },
    { symbol: 'BRENT', label: 'Brent Oil', category: 'commodities', lotSize: 1000, pipSize: 0.01 },
    { symbol: 'NGAS', label: 'Natural Gas', category: 'commodities', lotSize: 10000, pipSize: 0.001 },
    { symbol: 'XPT/USD', label: 'Platinum', category: 'commodities', lotSize: 100, pipSize: 0.1 },
    { symbol: 'XPD/USD', label: 'Palladium', category: 'commodities', lotSize: 100, pipSize: 0.1 },
    { symbol: 'HG', label: 'Copper', category: 'commodities', lotSize: 25000, pipSize: 0.0001 },
];
