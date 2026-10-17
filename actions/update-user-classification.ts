
'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

/**
 * @fileOverview Server action to update a user's account classification.
 */

type UpdateClassificationResult = {
    success: boolean;
    message: string;
};

export async function updateUserClassification(userId: string, classification: string | null): Promise<UpdateClassificationResult> {
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        if (!userId) {
            return { success: false, message: 'User ID is required.' };
        }

        const { error } = await supabaseAdmin
            .from('profiles')
            .update({ account_classification: classification })
            .eq('id', userId);

        if (error) throw error;

        revalidatePath('/admin/traders');
        revalidatePath(`/admin/users/${userId}`);

        return { success: true, message: 'Account classification updated successfully.' };
    } catch (error: any) {
        console.error('Error updating classification:', error);
        return { success: false, message: error.message || 'An unknown error occurred.' };
    }
}
