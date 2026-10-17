
'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

type DeleteUserResult = {
    success: boolean;
    message: string;
};

export async function deleteUserAccount(userId: string): Promise<DeleteUserResult> {

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
    
    try {
        if (!userId) {
            return { success: false, message: 'User ID is required.' };
        }

        // Deleting the user from auth.users will trigger a cascade delete in the database
        // for all tables that have a foreign key relationship with `auth.users.id`.
        // This includes profiles, portfolios, leverages, orders, etc.
        const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (deleteAuthError) {
            // Handle cases where user might not exist in auth but exists in tables
            if (deleteAuthError.message.toLowerCase().includes('not found')) {
                 console.warn(`Auth user with ID ${userId} not found, but proceeding with database cleanup.`);
            } else {
                throw new Error(`Failed to delete user from authentication: ${deleteAuthError.message}`);
            }
        }

        // We manually clean up tables that might not have a direct cascade from auth.users,
        // although a well-structured DB should handle this. This is for robustness.
        const tablesToClean = ['portfolios', 'leverages', 'orders', 'positions', 'daily_pnl', 'deposit_requests', 'withdrawal_requests', 'profiles'];

        for (const table of tablesToClean) {
            const { error: deleteTableError } = await supabaseAdmin
                .from(table)
                .delete()
                .eq(table === 'profiles' ? 'id' : 'user_id', userId);
            
            if (deleteTableError) {
                console.warn(`Could not clean up table '${table}' for user ${userId}: ${deleteTableError.message}`);
            }
        }
        
        revalidatePath('/admin/users');

        return { success: true, message: 'User has been permanently deleted.' };

    } catch (error: any) {
        console.error(`Error deleting user ${userId}:`, error);
        return { success: false, message: error.message || 'An unknown error occurred during deletion.' };
    }
}
