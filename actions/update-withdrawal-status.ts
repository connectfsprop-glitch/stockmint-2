
'use server';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

type UpdateStatusResult = {
    success: boolean;
    message: string;
};

export async function updateWithdrawalStatus(requestId: number, newStatus: 'APPROVED' | 'REJECTED'): Promise<UpdateStatusResult> {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    cookieStore.set({ name, value, ...options });
                },
                remove(name: string, options: CookieOptions) {
                    cookieStore.set({ name, value: '', ...options });
                },
            },
        }
    );

    try {
        // 1. Verify Admin
        const { data: { user: adminUser } } = await supabase.auth.getUser();
        if (!adminUser) {
            return { success: false, message: 'Authentication error.' };
        }
        const { data: adminProfile, error: adminProfileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', adminUser.id)
            .single();

        if (adminProfileError || adminProfile?.role !== 'admin') {
            return { success: false, message: 'Authorization error.' };
        }

        // 2. Fetch the request to get user_id and amount
        const { data: request, error: requestError } = await supabase
            .from('withdrawal_requests')
            .select('user_id, amount, status')
            .eq('id', requestId)
            .single();
        
        if (requestError || !request) {
            throw new Error('Withdrawal request not found.');
        }

        if (request.status !== 'PENDING') {
            return { success: false, message: `This request has already been processed with a status of ${request.status}.` };
        }

        // 3. If approving, update user's portfolio (ATOMIC SETTLEMENT)
        if (newStatus === 'APPROVED') {
            const { data: portfolio, error: portfolioError } = await supabase
                .from('portfolios')
                .select('cash_balance')
                .eq('user_id', request.user_id)
                .single();

            if (portfolioError || !portfolio) {
                throw new Error('User portfolio not found.');
            }
            
            if (portfolio.cash_balance < request.amount) {
                return { success: false, message: 'User has insufficient funds for this payout.' };
            }

            const { error: updatePortfolioError } = await supabase.rpc('debit_user_balance', {
                user_id_input: request.user_id,
                amount_to_debit: request.amount
            });

            if (updatePortfolioError) {
                throw new Error(`Failed to settle portfolio: ${updatePortfolioError.message}`);
            }
        }
        
        // 4. Update the request status
        const { error: updateStatusError } = await supabase
            .from('withdrawal_requests')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', requestId);

        if (updateStatusError) {
            throw new Error(`Failed to update request status: ${updateStatusError.message}`);
        }

        revalidatePath('/admin');
        revalidatePath('/funds');

        return { success: true, message: `Payout request ${newStatus.toLowerCase()} and balance settled.` };

    } catch (error: any) {
        console.error('[Payout Action] Error:', error);
        return { success: false, message: error.message || 'An unknown error occurred.' };
    }
}
