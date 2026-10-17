
'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

type PaymentDetails = {
    upi_id: string | null;
    qr_code_url: string | null;
};

type GetPaymentDetailsResult = {
    success: true;
    data: PaymentDetails;
} | {
    success: false;
    error: string;
};

export async function getPaymentDetails(): Promise<GetPaymentDetailsResult> {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() { return cookieStore.getAll(); },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
              } catch {}
            },
          },
        }
    );

    try {
        const { data, error } = await supabase
            .from('payment_details')
            .select('upi_id, qr_code_url')
            .eq('id', 1)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
            throw new Error(error.message);
        }

        return {
            success: true,
            data: {
                upi_id: data?.upi_id || null,
                qr_code_url: data?.qr_code_url || null,
            },
        };
    } catch (error: any) {
        console.error('Error fetching payment details:', error);
        return { success: false, error: error.message || 'An unknown error occurred.' };
    }
}
