
'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

/**
 * @fileOverview Institutional Capital Calibration Action
 * Allows admins to set balance/HWM without purging history.
 */

type UpdatePortfolioResult = {
    success: boolean;
    message: string;
};

export async function updateUserPortfolio(userId: string, balance: number, hwm: number): Promise<UpdatePortfolioResult> {
    if (!userId) return { success: false, message: 'User ID is required.' };

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { error } = await supabaseAdmin
            .from('portfolios')
            .update({
                cash_balance: balance,
                high_water_mark: hwm,
                opening_balance_today: balance // Sync daily opening for consistency
            })
            .eq('user_id', userId);

        if (error) throw error;

        revalidatePath(`/admin/users/${userId}`);
        revalidatePath('/admin/risk-monitor');

        return { success: true, message: 'Institutional capital re-calibrated successfully.' };
    } catch (error: any) {
        console.error('[Capital Update] Error:', error);
        return { success: false, message: error.message || 'Calibration failed.' };
    }
}
