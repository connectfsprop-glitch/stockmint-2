
'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

type UpdateRiskSettingsInput = {
    userId: string;
    equityLeverage: number;
    lossLimitPercentage: number;
    dailyLossLimitPercentage: number;
    perTradeLossLimitPercentage: number;
};

type UpdateRiskSettingsResult = {
    success: boolean;
    message: string;
};

export async function updateUserRiskSettings(input: UpdateRiskSettingsInput): Promise<UpdateRiskSettingsResult> {
    const { 
        userId, equityLeverage, lossLimitPercentage, 
        dailyLossLimitPercentage, perTradeLossLimitPercentage 
    } = input;
    
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        // --- Transaction-like approach ---
        // 1. Update profiles table
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({
                loss_limit_percentage: lossLimitPercentage,
                daily_loss_limit_percentage: dailyLossLimitPercentage,
                per_trade_loss_limit_percentage: perTradeLossLimitPercentage,
            })
            .eq('id', userId);

        if (profileError) {
            throw new Error(`Failed to update risk limits: ${profileError.message}`);
        }

        // 2. Update leverages table
        const { error: leverageError } = await supabaseAdmin
            .from('leverages')
            .update({
                equity: equityLeverage,
                // We keep futures and options fixed, but you could make them editable too
                futures: 1, 
                options: 1,
            })
            .eq('user_id', userId);
        
        if (leverageError) {
            // Here you might want to consider rolling back the profile change for consistency,
            // but for this scope, we'll just report the failure.
            throw new Error(`Failed to update leverage settings: ${leverageError.message}`);
        }

        // 3. Revalidate paths to refresh data in the UI
        revalidatePath(`/admin/users/${userId}`);
        revalidatePath('/admin/risk-monitor');

        return { success: true, message: 'User risk and leverage settings updated successfully.' };

    } catch (error: any) {
        console.error('Error updating user settings:', error);
        return { success: false, message: error.message || 'An unknown error occurred.' };
    }
}
