
'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

/**
 * @fileOverview INSTITUTIONAL EXECUTION OVERRIDE v2.0
 * Allows admins to modify Entry Price, Exit Price, Time (to the second), and Quantity.
 * Automatically re-calculates PnL and re-calibrates user portfolio.
 */

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function updateTradeDetails(input: {
    orderId: number;
    openingTime: string;
    closingTime: string;
    newQuantity: number;
    newEntryPrice: number;
    newExitPrice: number;
}) {
    const { orderId, openingTime, closingTime, newQuantity, newEntryPrice, newExitPrice } = input;

    try {
        // 1. Fetch the closing order (The primary trade record)
        const { data: closingOrder, error: fetchError } = await supabaseAdmin
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();

        if (fetchError || !closingOrder) throw new Error("Closing order not found in ledger.");
        if (closingOrder.pnl === null) throw new Error("Selected order is not a completed trade.");

        const oldPnL = closingOrder.pnl;
        
        // 2. Identify Direction & Recalculate PnL
        // If exit was SELL, trade was LONG: PnL = (Exit - Entry) * Qty
        // If exit was BUY, trade was SHORT: PnL = (Entry - Exit) * Qty
        const isLong = closingOrder.order_type === 'SELL';
        const newPnL = isLong 
            ? (newExitPrice - newEntryPrice) * newQuantity 
            : (newEntryPrice - newExitPrice) * newQuantity;

        // 3. IDENTIFY OPENING LEG (Heuristic)
        const { data: openingOrders } = await supabaseAdmin
            .from('orders')
            .select('*')
            .eq('user_id', closingOrder.user_id)
            .eq('symbol', closingOrder.symbol)
            .eq('status', 'COMPLETED')
            .is('pnl', null)
            .lt('created_at', closingOrder.created_at)
            .order('created_at', { ascending: false })
            .limit(1);

        const openingOrder = openingOrders?.[0];

        // 4. ATOMIC EXECUTION
        // a. Update the Closing Leg
        const { error: updateCloseError } = await supabaseAdmin
            .from('orders')
            .update({
                created_at: closingTime,
                quantity: newQuantity,
                price: newExitPrice,
                pnl: newPnL
            })
            .eq('id', orderId);
        
        if (updateCloseError) throw updateCloseError;

        // b. Update the Opening Leg (if detected)
        if (openingOrder) {
            await supabaseAdmin
                .from('orders')
                .update({
                    created_at: openingTime,
                    quantity: newQuantity,
                    price: newEntryPrice
                })
                .eq('id', openingOrder.id);
        }

        // c. CAPITAL RE-CALIBRATION
        const pnlDiff = newPnL - oldPnL;
        if (pnlDiff !== 0) {
            const { error: rpcError } = await supabaseAdmin.rpc('add_user_balance', {
                user_id_input: closingOrder.user_id,
                amount_to_add: pnlDiff
            });
            if (rpcError) throw new Error(`Portfolio Sync Failed: ${rpcError.message}`);
        }

        // d. UPDATE DAILY PNL REGISTRY
        const originalDate = new Date(closingOrder.created_at).toISOString().split('T')[0];
        const { data: pnlRecords } = await supabaseAdmin
            .from('daily_pnl')
            .select('id')
            .eq('user_id', closingOrder.user_id)
            .eq('date', originalDate)
            .eq('pnl', oldPnL)
            .limit(1);
        
        if (pnlRecords && pnlRecords.length > 0) {
            await supabaseAdmin
                .from('daily_pnl')
                .update({ pnl: newPnL })
                .eq('id', pnlRecords[0].id);
        }

        revalidatePath(`/admin/users/${closingOrder.user_id}`);
        return { success: true, message: 'Execution spectrum fully synchronized.' };

    } catch (e: any) {
        console.error("[Execution Override Error]", e);
        return { success: false, message: e.message || "Internal terminal synchronization error." };
    }
}
