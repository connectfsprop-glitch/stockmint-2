'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

type WithdrawalResult = {
    success: boolean;
    message: string;
};

export async function requestWithdrawal(userId: string, formData: FormData): Promise<WithdrawalResult> {
    
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        if (!userId) {
            return { success: false, message: 'You must be logged in to make a withdrawal request.' };
        }

        const amount = parseFloat(formData.get('amount') as string);
        const upiId = formData.get('upiId') as string;
        const qrCodeFile = formData.get('qrCode') as File;

        if (isNaN(amount) || amount <= 0) {
            return { success: false, message: 'Invalid amount entered.' };
        }
        if (!upiId) {
            return { success: false, message: 'UPI ID is required.' };
        }
        if (!qrCodeFile || qrCodeFile.size === 0) {
            return { success: false, message: 'QR Code image is required.' };
        }

        // Check user balance
        const { data: portfolio, error: portfolioError } = await supabaseAdmin
            .from('portfolios')
            .select('cash_balance')
            .eq('user_id', userId)
            .single();

        if (portfolioError || !portfolio) {
            throw new Error('Could not fetch user portfolio.');
        }
        if (portfolio.cash_balance < amount) {
            return { success: false, message: 'Insufficient funds.' };
        }

        // Upload QR code to storage
        const filePath = `${userId}/${Date.now()}-${qrCodeFile.name}`;
        const { error: uploadError } = await supabaseAdmin.storage
            .from('qrcodes')
            .upload(filePath, qrCodeFile);

        if (uploadError) {
            throw new Error(`Failed to upload QR code: ${uploadError.message}`);
        }

        const { data: { publicUrl } } = supabaseAdmin.storage.from('qrcodes').getPublicUrl(filePath);

        // Create withdrawal request
        const { error: requestError } = await supabaseAdmin
            .from('withdrawal_requests')
            .insert({
                user_id: userId,
                amount,
                upi_id: upiId,
                qr_code_url: publicUrl,
                status: 'PENDING',
            });
        
        if (requestError) {
            throw new Error(`Failed to create withdrawal request: ${requestError.message}`);
        }
        
        revalidatePath('/funds');
        revalidatePath('/admin');

        return { success: true, message: 'Your withdrawal request has been submitted successfully.' };

    } catch (error: any) {
        console.error('Error requesting withdrawal:', error);
        return { success: false, message: error.message || 'An unknown error occurred.' };
    }
}
