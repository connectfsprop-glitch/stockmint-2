
'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

type UpdateDetailsResult = {
    success: boolean;
    message: string;
    newQrCodeUrl?: string;
};

export async function updatePaymentDetails(formData: FormData): Promise<UpdateDetailsResult> {
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    try {
        const upiId = formData.get('upiId') as string;
        const qrCodeFile = formData.get('qrCodeFile') as File | null;

        let qrCodeUrl: string | undefined = undefined;

        if (qrCodeFile && qrCodeFile.size > 0) {
            const filePath = `public/deposit-qr-${Date.now()}`;
            const { error: uploadError } = await supabaseAdmin.storage
                .from('payment_qrcodes')
                .upload(filePath, qrCodeFile, {
                    cacheControl: '3600',
                    upsert: true, 
                });

            if (uploadError) {
                throw new Error(`Failed to upload QR code: ${uploadError.message}`);
            }
            
            const { data: { publicUrl } } = supabaseAdmin.storage.from('payment_qrcodes').getPublicUrl(filePath);
            qrCodeUrl = publicUrl;
        }

        const dataToUpsert: { id: number; upi_id?: string; qr_code_url?: string } = { id: 1 };
        if (upiId) dataToUpsert.upi_id = upiId;
        if (qrCodeUrl) dataToUpsert.qr_code_url = qrCodeUrl;

        const { error } = await supabaseAdmin
            .from('payment_details')
            .upsert(dataToUpsert, { onConflict: 'id' });

        if (error) {
            throw new Error(`Database update failed: ${error.message}`);
        }

        revalidatePath('/admin/settings');
        revalidatePath('/add-funds');

        return { success: true, message: 'Payment details updated successfully.', newQrCodeUrl: qrCodeUrl };

    } catch (error: any) {
        console.error('Error updating payment details:', error);
        return { success: false, message: error.message || 'An unknown error occurred.' };
    }
}
