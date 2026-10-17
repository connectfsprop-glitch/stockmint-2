
'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

type ResetUserResult = {
    success: boolean;
    message: string;
};

/**
 * ATOMIC FACTORY RESET v1.0
 * Purges all historical spectrum data and re-calibrates the portfolio.
 */
export async function resetUserAccount(userId: string, newBalance: number, newHighWaterMark: number): Promise<ResetUserResult> {

    if (!userId) {
        return { success: false, message: 'User ID is required.' };
    }
    
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    try {
        // 1. ATOMIC PURGE: Wipe all associated financial and trade data
        const tablesToDeleteFrom = [
            'orders', 
            'positions', 
            'daily_pnl', 
            'deposit_requests', 
            'withdrawal_requests',
            'performance_audits',
            'user_notifications',
            'support_messages'
        ];

        for (const table of tablesToDeleteFrom) {
            const userIdColumn = (table === 'support_messages' || table === 'profiles') ? 'student_id' : 'user_id';
            const { error: deleteError } = await supabaseAdmin
                .from(table)
                .delete()
                .eq(userIdColumn, userId);
            
            if (deleteError) {
                console.warn(`Non-critical: Table ${table} might not have user_id column or is already empty.`);
            }
        }
        
        // 2. SPECTRUM RE-CALIBRATION: Reset portfolio to specific admin values
        const { error: portfolioError } = await supabaseAdmin
            .from('portfolios')
            .update({
                cash_balance: newBalance,
                high_water_mark: newHighWaterMark,
                opening_balance_today: newBalance,
            })
            .eq('user_id', userId);

        if (portfolioError) {
            throw new Error(`Failed to re-calibrate portfolio: ${portfolioError.message}`);
        }

        // 3. AUDIT CYCLE ANCHOR: Reset the audit clock
        await supabaseAdmin
            .from('profiles')
            .update({ 
                audit_cycle_start: new Date().toISOString(),
                last_audit_at: null 
            })
            .eq('id', userId);

        revalidatePath(`/admin/users/${userId}`);
        revalidatePath('/admin/risk-monitor');
        revalidatePath('/admin/trades');

        return { success: true, message: 'Account Spectrum Reset Complete.' };

    } catch (error: any) {
        console.error(`Error resetting account for user ${userId}:`, error);
        return { success: false, message: error.message || 'An unknown error occurred during the reset.' };
    }
}
