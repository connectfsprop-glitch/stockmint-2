
'use server';
import 'dotenv/config';
import { WebSocketServer, WebSocket } from 'ws';
import { getMultipleStockPrices } from '../app/actions/get-stock-price';
import { FOREX_INSTRUMENTS } from '../lib/forex-config';

/**
 * @fileOverview INSTITUTIONAL MULTI-MARKET PRICE SERVER v2.9
 * Parallel Isolation Protocol: Zerodha (Indian) and Twelve Data (Forex) 
 * run in independent micro-tasks. 
 * Refined Twelve Data Handshake and Pulse Management.
 */

const PORT = process.env.PORT || 8080;
const REFRESH_REST_MS = 200; 
const HEARTBEAT_INTERVAL = 10000;
const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY;

// Dedicated Caches for Isolation
let indianPricesCache: Map<string, any> = new Map();
let forexPricesCache: Map<string, any> = new Map();

let isIndianPolling = false;
let lastHeartbeatTime = Date.now();

const wss = new WebSocketServer({ port: Number(PORT) });
console.log(`🚀 [v2.9] MULTI-MARKET Pulse Server Online`);
console.log(`📡 [Engine A] Zerodha Kite Active (India)`);

/**
 * CORE ENGINE B: TWELVE DATA PULSE (FOREX/INTERNATIONAL)
 * Pure Push Architecture - Event Loop based isolation.
 */
function initTwelveData() {
    if (!TWELVE_DATA_API_KEY || TWELVE_DATA_API_KEY === 'YOUR_API_KEY' || TWELVE_DATA_API_KEY === '') {
        console.warn("⚠️ Engine B: TWELVE_DATA_API_KEY is missing. International spectrum offline.");
        return;
    }

    const tdUrl = `wss://ws.twelvedata.com/v1/quotes/price?apikey=${TWELVE_DATA_API_KEY}`;
    console.log(`📡 Engine B: Attempting Handshake with Twelve Data...`);
    
    try {
        const tdWs = new WebSocket(tdUrl);

        tdWs.on('open', () => {
            console.log('✅ Engine B: Twelve Data Handshake Successful.');
            
            // Subscribe to all 50 configured pairs
            const symbols = FOREX_INSTRUMENTS.map(i => i.symbol).join(',');
            console.log(`📡 Engine B: Subscribing to ${FOREX_INSTRUMENTS.length} pairs...`);
            
            tdWs.send(JSON.stringify({
                action: 'subscribe',
                params: { symbols }
            }));

            // Keep-alive heartbeat pings
            setInterval(() => {
                if (tdWs.readyState === WebSocket.OPEN) {
                    tdWs.send(JSON.stringify({ action: 'heartbeat' }));
                }
            }, 10000);
        });

        tdWs.on('message', (data) => {
            setImmediate(() => {
                try {
                    const res = JSON.parse(data.toString());
                    
                    // Twelve Data 'price' event format
                    if (res.event === 'price' && res.symbol && res.price) {
                        const symbol = res.symbol;
                        const key = `FOREX:${symbol.toUpperCase()}`;
                        
                        const fresh = {
                            symbol: symbol,
                            price: parseFloat(res.price),
                            change: 0, 
                            dayLow: 0,
                            dayHigh: 0,
                            ts: Date.now()
                        };

                        forexPricesCache.set(key, fresh);
                        
                        // Immediate Broadcast to all clients interested in this pair
                        const payload = JSON.stringify({ [key]: fresh });
                        wss.clients.forEach(client => {
                            const subs = (client as any).subscriptions;
                            if (client.readyState === WebSocket.OPEN && subs && (subs.has(key) || subs.has('*'))) {
                                client.send(payload);
                            }
                        });
                    } else if (res.status === 'error') {
                        console.error("❌ Engine B: Twelve Data API Error:", res.message);
                    }
                } catch (e) {
                    console.error("❌ Engine B: Delta Parse Error", e);
                }
            });
        });

        tdWs.on('error', (err) => console.error('❌ Engine B: Connection Error:', err));
        tdWs.on('close', () => {
            console.log('🔄 Engine B: Connection Severed. Re-initializing in 5s...');
            setTimeout(initTwelveData, 5000);
        });
    } catch (e) {
        console.error("❌ Engine B: Handshake Exception:", e);
        setTimeout(initTwelveData, 10000);
    }
}

/**
 * CORE ENGINE A: INDIAN MARKET POLLING (ZERODHA)
 * High-Precision Priority Task.
 */
const pollIndianMarket = async () => {
    if (isIndianPolling) return;
    isIndianPolling = true;

    try {
        const activeIndianSymbols = new Set<string>();
        wss.clients.forEach(client => {
            const subs = (client as any).subscriptions;
            if (subs) {
                subs.forEach((s: string) => {
                    if (!s.startsWith('FOREX:')) activeIndianSymbols.add(s);
                });
            }
        });

        // Heartbeat Monitor
        const now = Date.now();
        if (now - lastHeartbeatTime > HEARTBEAT_INTERVAL) {
            lastHeartbeatTime = now;
            const hb = JSON.stringify({ type: 'hb', ts: now });
            wss.clients.forEach(c => c.readyState === WebSocket.OPEN && c.send(hb));
        }

        if (activeIndianSymbols.size > 0) {
            const instruments = Array.from(activeIndianSymbols).map(key => {
                const parts = key.split(':');
                if (parts.length < 2) return null;
                return { exchange: parts[0], symbol: parts[1] };
            }).filter(Boolean) as any[];

            const result = await getMultipleStockPrices(instruments);

            if (result.success && result.data) {
                const delta: Record<string, any> = {};
                let hasChanges = false;
                
                Object.keys(result.data).forEach(key => {
                    const fresh = result.data[key];
                    const cached = indianPricesCache.get(key);
                    if (!cached || fresh.price !== cached.price) {
                        delta[key] = fresh;
                        indianPricesCache.set(key, fresh);
                        hasChanges = true;
                    }
                });

                if (hasChanges) {
                    const payload = JSON.stringify(delta);
                    wss.clients.forEach(c => {
                        if (c.readyState === WebSocket.OPEN) c.send(payload);
                    });
                }
            }
        }
    } catch (e) {
        console.error("⚠️ [Engine A] Polling Stumble:", e);
    } finally {
        isIndianPolling = false;
        setTimeout(pollIndianMarket, REFRESH_REST_MS);
    }
};

// Start Isolated Engines
initTwelveData();
pollIndianMarket();

wss.on('connection', ws => {
    console.log(`🔌 Client Session Attached [Socket: ${wss.clients.size}]`);
    (ws as any).subscriptions = new Set<string>();

    ws.on('message', message => {
        try {
            const data = JSON.parse(message.toString());
            if (data.type === 'subscribe' && Array.isArray(data.instruments)) {
                const subs = (ws as any).subscriptions;
                
                // Subscribe (Merge Mode)
                data.instruments.forEach((i: any) => {
                    if (!i.symbol) return;
                    
                    const isForex = i.exchange?.toUpperCase() === 'FOREX' || !i.exchange;
                    const key = isForex
                        ? `FOREX:${i.symbol.toUpperCase()}`
                        : `${i.exchange.toUpperCase()}:${i.symbol.toUpperCase()}`;
                    
                    subs.add(key);
                });

                // Immediate Snapshot Push
                const snapshot: Record<string, any> = {};
                subs.forEach((key: string) => {
                    if (key.startsWith('FOREX:')) {
                        if (forexPricesCache.has(key)) snapshot[key] = forexPricesCache.get(key);
                    } else {
                        if (indianPricesCache.has(key)) snapshot[key] = indianPricesCache.get(key);
                    }
                });
                
                if (Object.keys(snapshot).length > 0) {
                    ws.send(JSON.stringify(snapshot));
                }
            }
        } catch (e) {
            console.error("❌ Socket Protocol Error:", e);
        }
    });

    ws.on('close', () => {
        console.log(`🔌 Session Terminated [Socket: ${wss.clients.size}]`);
    });
});

process.on('uncaughtException', (err) => console.error('🌋 CRITICAL SYSTEM CRASH:', err));
