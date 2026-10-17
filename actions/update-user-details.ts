
'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

type UpdateDetailsInput = {
    userId: string;
    fullName: string;
    email: string;
    password?: string;
};

type UpdateDetailsResult = {
    success: boolean;
    message: string;
};

/**
 * ATOMIC IDENTITY SYNC v2.0
 * Hardened: Email is updated in Auth spectrum ONLY to prevent database schema errors.
 */
export async function updateUserDetails(input: UpdateDetailsInput): Promise<UpdateDetailsResult> {
    
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { userId, fullName, email, password } = input;

    try {
        // 1. Update Authentication User (Master Email Source)
        const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            {
                email: email,
                password: password, 
                user_metadata: { full_name: fullName }
            }
        );

        if (authError) {
            throw new Error(`Failed to update authentication details: ${authError.message}`);
        }

        // 2. Update Public Profile Table (Name Only)
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({ 
                full_name: fullName
                // Removed 'email' column update to prevent System Error: column not found
            })
            .eq('id', userId);

        if (profileError) {
            throw new Error(`Failed to update public profile name: ${profileError.message}`);
        }
        
        revalidatePath(`/admin/users/${userId}`);
        revalidatePath('/admin/users');

        return { success: true, message: 'User details updated successfully.' };

    } catch (error: any) {
        console.error('Error updating user details:', error.message);
        return { success: false, message: error.message || 'An unknown error occurred.' };
    }
}
