'use server';

import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

type UpdateBalanceInput = {
    targetUserId: string;
    amount: number;
    transactionType: 'CREDIT' | 'DEBIT';
};

type UpdateBalanceResult = {
    success: boolean;
    message: string;
};

export async function updateBalance(input: UpdateBalanceInput): Promise<UpdateBalanceResult> {
    const { targetUserId, amount, transactionType } = input;

    try {
        // Simplified: Directly get the target user's current portfolio
        const { data: portfolio, error: portfolioError } = await supabase
            .from('portfolios')
            .select('cash_balance')
            .eq('user_id', targetUserId)
            .single();

        if (portfolioError || !portfolio) {
            throw new Error(portfolioError?.message || `Could not find portfolio for user ID ${targetUserId}.`);
        }

        // Calculate the new balance
        let newBalance = portfolio.cash_balance;
        if (transactionType === 'CREDIT') {
            newBalance += amount;
        } else { // DEBIT
            if (portfolio.cash_balance < amount) {
                return { success: false, message: `Insufficient funds. User only has ₹${portfolio.cash_balance.toFixed(2)}.`};
            }
            newBalance -= amount;
        }

        // Update the portfolio balance
        const { error: updateError } = await supabase
            .from('portfolios')
            .update({ cash_balance: newBalance })
            .eq('user_id', targetUserId);

        if (updateError) {
            throw new Error(`Failed to update balance: ${updateError.message}`);
        }
        
        revalidatePath('/funds');
        revalidatePath('/admin');

        return { success: true, message: `Successfully ${transactionType === 'CREDIT' ? 'added' : 'withdrew'} ${amount} for user.` };

    } catch (error: any) {
        console.error('Error updating balance:', error);
        return { success: false, message: error.message || 'An unknown error occurred.' };
    }
}
