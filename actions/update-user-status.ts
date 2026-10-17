
'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

/**
 * @fileOverview Robust action to update a user's active status.
 * Optimized to use the Admin client to ensure reliability and bypass RLS for administrative tasks.
 */

type UpdateStatusResult = {
    success: boolean;
    message: string;
};

export async function updateUserStatus(userId: string, newStatus: boolean): Promise<UpdateStatusResult> {
    if (!userId) {
        return { success: false, message: 'User ID is required.' };
    }

    // Use the Supabase Admin client with the service role key.
    // This bypasses session-related issues and RLS for critical admin tasks.
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { error } = await supabaseAdmin
            .from('profiles')
            .update({ is_active: newStatus })
            .eq('id', userId);

        if (error) throw error;

        // Revalidate all relevant paths to ensure the UI stays in sync
        revalidatePath('/admin/traders');
        revalidatePath('/admin/users');
        revalidatePath('/admin/user-list');
        revalidatePath('/admin/registry');
        revalidatePath(`/admin/users/${userId}`);

        return { success: true, message: `User status successfully updated to ${newStatus ? 'Active' : 'Inactive'}.` };

    } catch (error: any) {
        console.error('Error in updateUserStatus:', error);
        return { success: false, message: error.message || 'An unknown error occurred while updating status.' };
    }
}
