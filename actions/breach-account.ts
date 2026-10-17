
'use server';
import { createClient } from '@supabase/supabase-js';
import { cancelOrder } from './cancel-order';
import { getStockPrice } from './get-stock-price';
import { executeTrade } from './execute-trade';

/**
 * ATOMIC BREACH PROTOCOL
 * Locks account first, clears pending orders, then flushes live positions.
 */
export async function breachAccount(userId: string, reason: string, positionToClose?: { id: number, symbol: string, exchange: string, quantity: number, instrument_type: string }, ltp?: number) {
    console.warn(`🚨 [ATOMIC BREACH] Triggered for ${userId}. Reason: ${reason}`);

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. HARD LOCK: Deactivate terminal access immediately
    const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ is_active: false })
        .eq('id', userId);

    if (profileError) {
        console.error(`CRITICAL: Failed to lock user ${userId}`, profileError);
    }

    // 2. CLEARANCE: Cancel all pending limit orders
    const { data: pendingOrders } = await supabaseAdmin
        .from('orders')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'PENDING');

    if (pendingOrders && pendingOrders.length > 0) {
        for (const order of pendingOrders) {
            await cancelOrder(order.id);
        }
    }
    
    // 3. FLUSH: Square off open positions
    const { data: openPositions } = await supabaseAdmin
        .from('positions')
        .select('*')
        .eq('user_id', userId);

    if (openPositions && openPositions.length > 0) {
        for (const pos of openPositions) {
            let priceToUse: number;

            // Use triggering price for the position that caused the breach
            if (positionToClose && pos.id === positionToClose.id && ltp) {
                priceToUse = ltp;
            } else {
                const ltpRes = await getStockPrice({ symbol: pos.symbol, exchange: pos.exchange });
                priceToUse = ltpRes.success ? ltpRes.data.price : pos.average_price;
            }

            const { data: squareOffOrder } = await supabaseAdmin.from('orders').insert({
                user_id: pos.user_id,
                symbol: pos.symbol,
                exchange: pos.exchange,
                instrument_type: pos.instrument_type,
                quantity: Math.abs(pos.quantity),
                price: priceToUse,
                order_type: pos.quantity > 0 ? 'SELL' : 'BUY',
                transaction_type: 'MARKET',
                status: 'PENDING',
                blocked_margin: 0,
                position_id: pos.id,
            }).select().single();

             if (squareOffOrder) {
                const isTrigger = positionToClose?.id === pos.id;
                const finalReason = isTrigger ? reason : `Collateral Flush (Breach: ${reason})`;
                await executeTrade(squareOffOrder.id, finalReason);
            }
        }
    }
}
