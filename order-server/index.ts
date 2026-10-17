'use server';
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { getMultipleStockPrices } from '../app/actions/get-stock-price';
import { executeTrade } from '../app/actions/execute-trade';

/**
 * @fileOverview INSTITUTIONAL EXECUTION ENGINE v12.1 (RANGE BUBBLE)
 * Implements a strict 2% Precision Zone (±1%) for ALL limit orders.
 * This provides high-tolerance fills while ensuring precision in volatile markets.
 */

const POLLING_INTERVAL = 500; 
const HEARTBEAT_LOG_INTERVAL = 20;

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

let cycleCount = 0;

console.log(`\n🛡️ [v12.1] RANGE BUBBLE ENGINE ONLINE`);
console.log(`⚡️ Logic: 2.0% Total Zone (±1.0% Room)`);
console.log(`📡 Status: Monitoring Execution Ledger...\n`);

async function runExecutionCycle() {
    cycleCount++;

    // 1. Fetch all Pending Limit Orders
    const { data: pendingOrders, error: fetchError } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('status', 'PENDING')
        .eq('transaction_type', 'LIMIT');

    if (fetchError) {
        console.error("❌ [DB_FETCH_ERROR]:", fetchError.message);
        return;
    }

    if (!pendingOrders || pendingOrders.length === 0) {
        if (cycleCount % HEARTBEAT_LOG_INTERVAL === 0) {
            console.log(`💓 [HEARTBEAT] Scanning... 0 orders in queue.`);
        }
        return;
    }

    // 2. Identify unique instruments for batch price fetch
    const instrumentMap = new Map();
    pendingOrders.forEach(o => {
        const key = `${o.exchange}:${o.symbol}`;
        instrumentMap.set(key, { exchange: o.exchange, symbol: o.symbol });
    });

    const instruments = Array.from(instrumentMap.values());
    const pricesRes = await getMultipleStockPrices(instruments);

    if (!pricesRes.success) return;

    for (const order of pendingOrders) {
        const key = `${order.exchange.toUpperCase()}:${order.symbol.toUpperCase()}`;
        const priceData = pricesRes.data[key];
        
        if (!priceData || priceData.price <= 0) continue;

        const ltp = priceData.price;
        const target = order.price;
        
        // 3. CALCULATE THE PRECISION BUBBLE (±1%)
        // Expanded to 1% per user request for easier execution catching.
        const lowBound = target * 0.99;
        const highBound = target * 1.01;

        // 4. STRICT INCLUSION CHECK
        const isInsideBubble = ltp >= lowBound && ltp <= highBound;

        if (isInsideBubble) {
            console.log(`🎯 [BUBBLE_HIT] Order: ${order.id} | Asset: ${order.symbol} | Target: ${target} | LTP: ${ltp}`);
            
            try {
                // ATOMIC PRICE OVERRIDE: Sync to real-time market price for P&L accuracy
                await supabaseAdmin
                    .from('orders')
                    .update({ price: ltp })
                    .eq('id', order.id);
                
                // EXECUTE TRADE
                const result = await executeTrade(order.id, `[SYSTEM] Range Trigger @ ${ltp.toFixed(2)}`);
                if (result.success) {
                    console.log(`✅ [SETTLED] Order ${order.id} finalized.`);
                }
            } catch (e: any) {
                console.error(`🌋 [EXECUTION_FAIL]:`, e.message);
            }
        }
    }
}

(async () => {
    while (true) {
        try {
            await runExecutionCycle();
        } catch (e: any) {
            console.error("💀 [CYCLE_CRASH]:", e.message);
        }
        await new Promise(r => setTimeout(r, POLLING_INTERVAL));
    }
})();