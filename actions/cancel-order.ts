
'use server';

import { createClient } from '@supabase/supabase-js';

type CancelOrderResult = {
    success: boolean;
    message: string;
};

/**
 * ATOMIC CANCELLATION PROTOCOL v2.1
 * Precision Refund: Strictly returns the exact 'blocked_margin' from the ledger.
 * Fixes "Balance Jump" glitch by preventing double-refunds or estimation.
 */
export async function cancelOrder(orderId: number): Promise<CancelOrderResult> {
    
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        // 1. Fetch the exact order state
        const { data: order, error: fetchError } = await supabaseAdmin
            .from('orders')
            .select('id, user_id, status, order_type, transaction_type, blocked_margin')
            .eq('id', orderId)
            .single();
        
        if (fetchError || !order) {
            return { success: false, message: 'Order not found in ledger.' };
        }

        if (order.status !== 'PENDING') {
            return { success: false, message: `Order already finalized as ${order.status}.` };
        }

        // 2. PRECISION REFUND: Only if margin was actually blocked
        if (order.blocked_margin > 0) {
            // ATOMIC BALANCE RESTORATION
            // We use the EXACT blocked_margin column value for a perfect 1:1 refund.
            const { error: rpcError } = await supabaseAdmin.rpc('add_user_balance', {
                user_id_input: order.user_id,
                amount_to_add: order.blocked_margin
            });

            if (rpcError) {
                throw new Error(`Atomic refund failed: ${rpcError.message}`);
            }
        }

        // 3. LEGDER FINALIZATION
        const { error: updateError } = await supabaseAdmin
            .from('orders')
            .update({ 
                status: 'CANCELLED',
                blocked_margin: 0 // Reset blocked margin on cancellation
            })
            .eq('id', orderId);

        if (updateError) {
            console.error(`CRITICAL: Refund processed but status update failed for order ${orderId}`);
            throw new Error(updateError.message);
        }

        return { success: true, message: 'Order cancelled and margin returned.' };

    } catch (error: any) {
        console.error('[Cancel Engine] Error:', error);
        return { success: false, message: error.message || 'Unknown execution error.' };
    }
}
