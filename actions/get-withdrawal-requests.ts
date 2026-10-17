
'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export type WithdrawalRequest = {
    id: number;
    created_at: string;
    amount: number;
    status: string;
    upi_id: string;
    qr_code_url: string;
    profiles: {
        full_name: string | null;
    } | null;
};

type GetWithdrawalsResult = {
    success: true;
    data: WithdrawalRequest[];
} | {
    success: false;
    error: string;
};

export async function getWithdrawalRequests(): Promise<GetWithdrawalsResult> {
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
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: 'Not authenticated.' };

        const { data: adminProfile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (adminProfile?.role !== 'admin') {
            return { success: false, error: 'Unauthorized.' };
        }
        
        const { data, error } = await supabase
            .from('withdrawal_requests')
            .select(`
                id,
                created_at,
                amount,
                status,
                upi_id,
                qr_code_url,
                profiles (
                    full_name
                )
            `)
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error(error.message);
        }

        return { success: true, data: data as WithdrawalRequest[] };

    } catch (error: any) {
        console.error('Error fetching withdrawal requests:', error);
        return { success: false, error: error.message || 'An unknown error occurred.' };
    }
}
