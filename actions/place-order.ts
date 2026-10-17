
'use server';

import { createClient } from '@supabase/supabase-js';
import { executeTrade } from './execute-trade';
import { randomUUID } from 'crypto';
import { differenceInMinutes } from 'date-fns';

type PlaceOrderInput = {
    userId: string;
    symbol: string;
    exchange: string;
    instrument_type: string;
    quantity: number;
    price?: number; 
    orderType: 'BUY' | 'SELL';
    transactionType: 'MARKET' | 'LIMIT';
    leverage: number;
    positionId?: number; 
    targetPrice?: number;
    stopLossPrice?: number;
};

type PlaceOrderResult = {
    success: boolean;
    message: string;
};

/**
 * INSTITUTIONAL ORDER PLACEMENT v7.5
 * TIER 5: News Window Check (±5m restricted window).
 */
export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
    const { 
        userId, symbol, exchange, instrument_type, quantity, price, 
        orderType, transactionType, leverage, positionId,
        targetPrice, stopLossPrice
    } = input;

    if (!userId) return { success: false, message: 'Not authenticated.' };
    
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // 1. Verify User Integrity
    const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', userId).single();
    if (!profile?.is_active) return { success: false, message: 'Account restricted due to risk violation.' };

    // 2. TIER 5: NEWS WINDOW CHECK (±5m)
    // Only enforced for non-PTP models.
    if (profile.account_model !== 'passthenpay') {
        const { data: newsEvents } = await supabaseAdmin
            .from('news_events')
            .select('*')
            .order('scheduled_at', { ascending: true });

        if (newsEvents && newsEvents.length > 0) {
            const now = new Date();
            const restricted = newsEvents.find(event => {
                const diff = Math.abs(differenceInMinutes(now, new Date(event.scheduled_at)));
                return diff <= 5;
            });

            if (restricted) {
                return { 
                    success: false, 
                    message: `Tier 5 Restriction: Trading blocked ±5m of ${restricted.event_name}. Window clears in a few minutes.` 
                };
            }
        }
    }

    // 3. Handle OCO Exit / Updates
    if (positionId && (targetPrice || stopLossPrice)) {
        const ocoGroupId = randomUUID();
        const exitOrders = [];
        
        if (targetPrice) {
            exitOrders.push({ 
                user_id: userId, symbol, exchange, instrument_type, quantity, 
                position_id: positionId, order_type: orderType === 'BUY' ? 'SELL' : 'BUY', 
                transaction_type: 'LIMIT', price: targetPrice, status: 'PENDING', 
                blocked_margin: 0, oco_group_id: ocoGroupId 
            });
        }
        
        if (stopLossPrice) {
            exitOrders.push({ 
                user_id: userId, symbol, exchange, instrument_type, quantity, 
                position_id: positionId, order_type: orderType === 'BUY' ? 'SELL' : 'BUY', 
                transaction_type: 'LIMIT', price: stopLossPrice, status: 'PENDING', 
                blocked_margin: 0, oco_group_id: ocoGroupId 
            });
        }

        try {
            await supabaseAdmin.from('orders').insert(exitOrders);
            return { success: true, message: `Exit parameters (SL/TP) synchronized.` };
        } catch (e: any) {
            return { success: false, message: `Failed to synchronize exits: ${e.message}` };
        }
    }

    // 4. Main Order Lifecycle
    let marginToBlock = 0;
    let newOrderId: number | null = null;

    try {
        const executionPrice = price || 0;
        if (executionPrice <= 0) throw new Error('Valid price required for margin calculation.');

        if (!positionId) { 
            marginToBlock = (quantity * executionPrice) / (leverage || 1);

            const { error: rpcError } = await supabaseAdmin.rpc('debit_user_balance', {
                user_id_input: userId,
                amount_to_debit: marginToBlock
            });

            if (rpcError) {
                return { success: false, message: `Insufficient Balance. Required: ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(marginToBlock)}` };
            }
        }
        
        const { data: newOrder, error: insertError } = await supabaseAdmin.from('orders').insert({
            user_id: userId,
            symbol, exchange, instrument_type, quantity, price: executionPrice,
            order_type: orderType,
            transaction_type: transactionType,
            status: 'PENDING',
            blocked_margin: marginToBlock,
            position_id: positionId,
            stop_loss: stopLossPrice,
            target_price: targetPrice
        }).select().single();

        if (insertError) {
             if (!positionId && marginToBlock > 0) {
                 await supabaseAdmin.rpc('add_user_balance', { user_id_input: userId, amount_to_add: marginToBlock });
            }
             throw new Error(`Ledger entry failed: ${insertError.message}`);
        }

        newOrderId = newOrder.id;
        
        if (transactionType === 'MARKET') {
            const result = await executeTrade(newOrder.id);
            if (!result.success) throw new Error(result.message);
            return { success: true, message: `${orderType} execution successful.` };
        }

        return { success: true, message: `Limit ${orderType} scheduled.` };

    } catch (error: any) {
        if (newOrderId) await supabaseAdmin.from('orders').update({ status: 'FAILED', failure_reason: error.message }).eq('id', newOrderId);
        if (!positionId && marginToBlock > 0) {
             await supabaseAdmin.rpc('add_user_balance', { user_id_input: userId, amount_to_add: marginToBlock }).catch(e => console.error("Refund failed", e));
        }
        return { success: false, message: error.message || 'Unknown execution error.' };
    }
}
