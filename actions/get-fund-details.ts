
'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { startOfToday } from 'date-fns';

type FundDetails = {
    usedMargin: number;
    payoutToday: number;
    openingBalance: number;
};

type FundDetailsResult = {
    success: true;
    data: FundDetails;
} | {
    success: false;
    error: string;
};

export async function getFundDetails(userId: string): Promise<FundDetailsResult> {
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

    if (!userId) {
        return { success: false, error: 'User not authenticated.' };
    }
    
    try {
        const today = startOfToday().toISOString();

        // 1. Calculate Used Margin from positions
        const { data: positions, error: positionsError } = await supabase
            .from('positions')
            .select('quantity, average_price')
            .eq('user_id', userId);

        if (positionsError) {
            throw new Error(`Failed to fetch positions: ${positionsError.message}`);
        }
        const usedMargin = (positions || []).reduce((acc, pos) => acc + (pos.quantity * pos.average_price), 0);

        // 2. Calculate Payout for today
        const { data: approvedWithdrawals, error: withdrawalsError } = await supabase
            .from('withdrawal_requests')
            .select('amount')
            .eq('user_id', userId)
            .eq('status', 'APPROVED')
            .gte('created_at', today);

        if (withdrawalsError) {
            throw new Error(`Failed to fetch withdrawals: ${withdrawalsError.message}`);
        }
        const payoutToday = (approvedWithdrawals || []).reduce((acc, req) => acc + req.amount, 0);

        // 3. Get Opening Balance from portfolio
        const { data: portfolio, error: portfolioError } = await supabase
            .from('portfolios')
            .select('high_water_mark')
            .eq('user_id', userId)
            .single();

        if (portfolioError || !portfolio) {
            throw new Error(portfolioError?.message || 'Could not fetch user portfolio.');
        }

        const openingBalance = portfolio.high_water_mark;

        return {
            success: true,
            data: {
                usedMargin,
                payoutToday,
                openingBalance,
            }
        };

    } catch (error: any) {
        console.error('Error fetching fund details:', error);
        return { success: false, error: error.message || 'An unknown error occurred.' };
    }
}
