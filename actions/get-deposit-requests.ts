
'use server';

import { createServerClient } from '@supabase/ssr';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

export type DepositRequest = {
    id: number;
    created_at: string;
    amount: number;
    transaction_id: string;
    status: string;
    profiles: {
        full_name: string | null;
    } | null;
};

type GetDepositsResult = {
    success: true;
    data: DepositRequest[];
} | {
    success: false;
    error: string;
};

export async function getDepositRequests(): Promise<GetDepositsResult> {
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
            .from('deposit_requests')
            .select(`
                id, created_at, amount, transaction_id, status,
                profiles ( full_name )
            `)
            .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);

        return { success: true, data: data as DepositRequest[] };

    } catch (error: any) {
        console.error('Error fetching deposit requests:', error);
        return { success: false, error: error.message || 'An unknown error occurred.' };
    }
}

type UpdateStatusResult = {
    success: boolean;
    message: string;
};

export async function updateDepositStatus(requestId: number, newStatus: 'APPROVED' | 'REJECTED'): Promise<UpdateStatusResult> {
    const cookieStore = await cookies();
    const supabaseAdmin = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll(); },
                setAll(cookiesToSet) {
                  try {
                    cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
                  } catch {}
                },
            }
        }
    );

    try {
        const { data: request, error: requestError } = await supabaseAdmin
            .from('deposit_requests')
            .select('user_id, amount, status')
            .eq('id', requestId)
            .single();
        
        if (requestError || !request) throw new Error('Deposit request not found.');
        if (request.status !== 'PENDING') return { success: false, message: `Request already processed as ${request.status}.` };

        if (newStatus === 'APPROVED') {
            const { error: rpcError } = await supabaseAdmin.rpc('add_user_balance', {
                user_id_input: request.user_id,
                amount_to_add: request.amount
            });
            if (rpcError) throw new Error(`Failed to credit user balance: ${rpcError.message}`);
        }
        
        const { error: updateStatusError } = await supabaseAdmin
            .from('deposit_requests')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', requestId);

        if (updateStatusError) throw new Error(`Failed to update request status: ${updateStatusError.message}`);

        revalidatePath('/admin');
        revalidatePath('/funds');

        return { success: true, message: `Request successfully marked as ${newStatus}.` };

    } catch (error: any) {
        return { success: false, message: error.message || 'An unknown error occurred.' };
    }
}
