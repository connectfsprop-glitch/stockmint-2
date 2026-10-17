
'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

/**
 * @fileOverview Institutional Model Migration Engine.
 * Synchronizes account_model with specific risk limit tiers.
 * Supports single and bulk operations.
 */

type MigrationResult = {
    success: boolean;
    message: string;
};

export async function migrateUserModel(userId: string, targetModel: 'normal' | 'passthenpay'): Promise<MigrationResult> {
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        if (!userId) throw new Error('User ID is required for migration.');

        const isPTP = targetModel === 'passthenpay';
        
        const updates = {
            account_model: targetModel,
            loss_limit_percentage: isPTP ? 15 : 10,
            daily_loss_limit_percentage: isPTP ? 8 : 5,
            per_trade_loss_limit_percentage: isPTP ? 0 : 2
        };

        const { error } = await supabaseAdmin
            .from('profiles')
            .update(updates)
            .eq('id', userId);

        if (error) throw error;

        revalidatePath('/admin/model-manager');
        revalidatePath('/admin/traders');
        revalidatePath('/admin/ptp-directory');
        revalidatePath(`/admin/users/${userId}`);

        return { 
            success: true, 
            message: `Identity migrated to ${targetModel.toUpperCase()}. Limits synchronized.` 
        };

    } catch (error: any) {
        console.error('[Migration Engine] Error:', error);
        return { success: false, message: error.message || 'Migration failed.' };
    }
}

export async function bulkMigrateUserModels(userIds: string[], targetModel: 'normal' | 'passthenpay'): Promise<MigrationResult> {
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        if (!userIds || userIds.length === 0) throw new Error('No identities selected.');

        const isPTP = targetModel === 'passthenpay';
        
        const updates = {
            account_model: targetModel,
            loss_limit_percentage: isPTP ? 15 : 10,
            daily_loss_limit_percentage: isPTP ? 8 : 5,
            per_trade_loss_limit_percentage: isPTP ? 0 : 2
        };

        const { error } = await supabaseAdmin
            .from('profiles')
            .update(updates)
            .in('id', userIds);

        if (error) throw error;

        revalidatePath('/admin/model-manager');
        revalidatePath('/admin/traders');
        revalidatePath('/admin/ptp-directory');

        return { 
            success: true, 
            message: `Successfully migrated ${userIds.length} identities to ${targetModel.toUpperCase()}.` 
        };

    } catch (error: any) {
        console.error('[Bulk Migration] Error:', error);
        return { success: false, message: error.message || 'Bulk migration failed.' };
    }
}
