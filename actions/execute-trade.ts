
'use server';

import { createClient } from '@supabase/supabase-js';
import { processPromotionCheck } from './performance-auditor';
import { randomUUID } from 'crypto';
import { differenceInSeconds } from 'date-fns';

type ExecuteTradeResult = {
    success: boolean;
    message: string;
};

/**
 * EXECUTION ENGINE v7.7 (STABILIZED)
 * Hardened Tier 4: Hold Time (45s) is strictly bypassed for all "[SYSTEM]" tags.
 * Precision Labeling: Breach reason captured from trigger source for audit trails.
 */
export async function executeTrade(orderId: number, triggerSource?: string): Promise<ExecuteTradeResult> {
    
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .select('*, profiles(account_model, account_classification)')
            .eq('id', orderId)
            .single();

        if (orderError || !order) return { success: false, message: `Order ${orderId} missing in ledger.` };
        if (order.status !== 'PENDING') return { success: false, message: `Order ${orderId} finalized as ${order.status}.` };

        const { user_id, price, position_id } = order;
        
        // --- POSITION LIQUIDATION ---
        if (position_id) {
            const { data: pos } = await supabaseAdmin.from('positions').select('*').eq('id', position_id).single();
            if (!pos) throw new Error("Position mismatch.");

            // TIER 4: MINIMUM HOLD TIME (45 SECONDS)
            // STABILIZED: ALL triggers tagged with [SYSTEM] are strictly exempt.
            const isSystemTrigger = triggerSource?.startsWith('[SYSTEM]');
            
            if (!isSystemTrigger && order.profiles?.account_model !== 'passthenpay') {
                const duration = differenceInSeconds(new Date(), new Date(pos.created_at));
                if (duration < 45) {
                    const breachReason = `Tier 4 Violation: Position closed manually in ${duration}s (Min 45s required).`;
                    const { breachAccount } = await import('./breach-account');
                    await breachAccount(user_id, breachReason, pos, price);
                    return { success: false, message: "Terminal Locked: Tier 4 Hold Time Violation." };
                }
            }

            const pnl = (price - pos.average_price) * pos.quantity;
            const { data: origOrder } = await supabaseAdmin.from('orders').select('blocked_margin').eq('id', pos.original_order_id).single();
            
            const refundAmount = (origOrder?.blocked_margin || 0) + pnl;
            
            // ATOMIC SETTLEMENT
            await Promise.all([
                supabaseAdmin.rpc('add_user_balance', { user_id_input: user_id, amount_to_add: refundAmount }),
                supabaseAdmin.from('positions').delete().eq('id', position_id),
                supabaseAdmin.from('orders').update({ 
                    status: 'COMPLETED', 
                    pnl, 
                    breach_reason: triggerSource || 'Manual Settlement' 
                }).eq('id', orderId),
                supabaseAdmin.from('daily_pnl').insert({ user_id, pnl, date: new Date().toISOString().split('T')[0] })
            ]);

            processPromotionCheck(user_id).catch(e => console.error("Audit Trigger Failure:", e));
            return { success: true, message: `Position liquidated via ${triggerSource || 'Manual'}.` };
        }

        // --- POSITION INITIALIZATION ---
        const { data: newPos, error: posError } = await supabaseAdmin.from('positions').insert({
            user_id, 
            symbol: order.symbol, 
            exchange: order.exchange, 
            instrument_type: order.instrument_type,
            quantity: order.order_type === 'BUY' ? order.quantity : -order.quantity,
            average_price: price,
            original_order_id: order.id,
        }).select().single();

        if (posError) throw posError;

        await supabaseAdmin.from('orders').update({ status: 'COMPLETED' }).eq('id', orderId);

        // --- AUTO-OCO PLACEMENT ---
        if (order.target_price || order.stop_loss) {
            const ocoGroupId = randomUUID();
            const exitType = order.order_type === 'BUY' ? 'SELL' : 'BUY';
            const exitOrders = [];

            if (order.target_price) {
                exitOrders.push({
                    user_id, symbol: order.symbol, exchange: order.exchange, 
                    instrument_type: order.instrument_type, quantity: order.quantity,
                    position_id: newPos.id, order_type: exitType, transaction_type: 'LIMIT',
                    price: order.target_price, status: 'PENDING', blocked_margin: 0, oco_group_id: ocoGroupId
                });
            }

            if (order.stop_loss) {
                exitOrders.push({
                    user_id, symbol: order.symbol, exchange: order.exchange, 
                    instrument_type: order.instrument_type, quantity: order.quantity,
                    position_id: newPos.id, order_type: exitType, transaction_type: 'LIMIT',
                    price: order.stop_loss, status: 'PENDING', blocked_margin: 0, oco_group_id: ocoGroupId
                });
            }

            if (exitOrders.length > 0) {
                await supabaseAdmin.from('orders').insert(exitOrders);
            }
        }

        return { success: true, message: `Position initialized.` };

    } catch (error: any) {
        console.error("EXECUTION CRASH:", error.message);
        await supabaseAdmin.from('orders').update({ status: 'FAILED', failure_reason: error.message }).eq('id', orderId);
        return { success: false, message: error.message };
    }
}
