
'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

type DepositRequestInput = {
    userId: string; // Add userId to the input
    amount: number;
    transactionId: string;
};

type DepositRequestResult = {
    success: boolean;
    message: string;
};

export async function submitDepositRequest(input: DepositRequestInput): Promise<DepositRequestResult> {
    
    // Use the Supabase Admin Client for this server action.
    // This client has elevated privileges and does not depend on user session cookies.
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { userId, amount, transactionId } = input;

        // The user is already authenticated on the client-side to be able to call this.
        // We trust the userId passed from the client after it has passed the useUserProfile hook check.
        if (!userId) {
            return { success: false, message: 'User ID is missing.' };
        }

        if (isNaN(amount) || amount <= 0) {
            return { success: false, message: 'Invalid amount entered.' };
        }
        if (!transactionId.trim()) {
            return { success: false, message: 'Transaction ID is required.' };
        }

        const { error } = await supabaseAdmin
            .from('deposit_requests')
            .insert({
                user_id: userId,
                amount,
                transaction_id: transactionId,
                status: 'PENDING',
            });

        if (error) {
            throw new Error(`Failed to create deposit request: ${error.message}`);
        }
        
        revalidatePath('/funds');
        revalidatePath('/admin');

        return { success: true, message: 'Your deposit request has been submitted successfully.' };

    } catch (error: any) {
        console.error('Error submitting deposit request:', error);
        return { success: false, message: error.message || 'An unknown error occurred.' };
    }
}
