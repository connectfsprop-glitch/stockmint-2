
'use server';

import { createClient } from '@supabase/supabase-js';
import { executeTrade } from './execute-trade';
import { getStockPrice } from './get-stock-price';
import { revalidatePath } from 'next/cache';

type ForceCloseResult = {
    success: boolean;
    message: string;
};

export async function forceCloseTrade(positionId: number): Promise<ForceCloseResult> {
    
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        // 1. Fetch the position to be closed
        const { data: position, error: positionError } = await supabaseAdmin
            .from('positions')
            .select('*')
            .eq('id', positionId)
            .single();

        if (positionError || !position) {
            return { success: false, message: 'Position not found.' };
        }

        // 2. Get the current live price to execute a market order
        const ltpRes = await getStockPrice({ symbol: position.symbol, exchange: position.exchange });
        if (!ltpRes.success) {
            // Provide a clearer error message if the API fails, especially for rate limits.
            if (ltpRes.error.includes('429')) { // Check for rate limit error
                 return { success: false, message: `Could not fetch live price due to API rate limits. Please wait a moment and try again.`};
            }
            return { success: false, message: `Could not fetch live price for ${position.symbol}: ${ltpRes.error}`};
        }

        // 3. Create the closing (square-off) market order
        const { data: squareOffOrder, error: squareOffError } = await supabaseAdmin.from('orders').insert({
            user_id: position.user_id,
            symbol: position.symbol,
            exchange: position.exchange,
            instrument_type: position.instrument_type,
            quantity: Math.abs(position.quantity),
            price: ltpRes.data.price,
            order_type: position.quantity > 0 ? 'SELL' : 'BUY', // Opposite order to close
            transaction_type: 'MARKET',
            status: 'PENDING', // Will be executed immediately by executeTrade
            blocked_margin: 0, // No new margin for closing
            position_id: position.id,
            breach_reason: 'Admin force-closed position' // Add a reason for clarity
        }).select().single();

        if (squareOffError || !squareOffOrder) {
            throw new Error(squareOffError?.message || 'Failed to create square-off order.');
        }

        // 4. Execute the trade immediately using the centralized system
        const executionResult = await executeTrade(squareOffOrder.id, 'Admin force-closed position');
        if (!executionResult.success) {
            // The executeTrade function handles its own error logging and potential refunds.
            throw new Error(`Square-off execution failed: ${executionResult.message}`);
        }

        // 5. Revalidate paths to refresh data in the UI
        revalidatePath('/admin/live-trades');
        revalidatePath('/admin/risk-monitor');
        revalidatePath(`/admin/users/${position.user_id}`);

        return { success: true, message: `Successfully force-closed position ${positionId} for ${position.symbol}.` };

    } catch (error: any) {
        console.error(`Error in forceCloseTrade for position ${positionId}:`, error);
        return { success: false, message: error.message || 'An unknown error occurred.' };
    }
}
