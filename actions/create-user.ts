
'use server';

import { createClient } from '@supabase/supabase-js';

type CreateUserInput = {
    fullName: string;
    email: string;
    password?: string;
    role: 'student' | 'mentor' | 'support';
    initialBalance: number;
    lossLimitPercentage: number;
    daily_loss_limit_percentage: number;
    per_trade_loss_limit_percentage: number;
    equityLeverage: number;
    assignedMentorId?: string;
    accountModel?: string;
    accountClassification?: string;
    is_kyc_blocked?: boolean;
    marketType?: 'indian' | 'forex';
};

type CreateUserResult = {
    success: boolean;
    message: string;
};

/**
 * ATOMIC USER INITIALIZATION (Spec v4.4)
 * Hardened: Email is managed strictly via Auth to prevent schema cache errors.
 */
export async function createUser(input: CreateUserInput): Promise<CreateUserResult> {
    
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
    
    const { 
        fullName, email, password, role, 
        initialBalance, lossLimitPercentage, 
        daily_loss_limit_percentage, per_trade_loss_limit_percentage,
        equityLeverage, assignedMentorId, accountModel = 'normal',
        accountClassification, is_kyc_blocked = false,
        marketType = 'indian'
    } = input;

    const effectivePassword = password || email;

    let { data: { user }, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: effectivePassword,
        email_confirm: true,
        user_metadata: {
            full_name: fullName,
        }
    });

    if (authError) {
        if (authError.message.includes('already registered')) {
             const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
             const existing = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
             if (!existing) {
                 return { success: false, message: `Identity error: ${authError.message}` };
             }
             user = existing;
        } else {
            return { success: false, message: `Auth spectrum error: ${authError.message}` };
        }
    }

    if (!user) return { success: false, message: 'Identity initialization failed.' };

    try {
        const [pRes, poRes, lRes] = await Promise.all([
            supabaseAdmin.from('profiles').upsert({
                id: user.id,
                full_name: fullName,
                // Email is NOT written to profiles table to avoid 'column not found' errors
                role: role,
                is_active: true,
                is_kyc_blocked: is_kyc_blocked,
                is_hidden: false,
                market_type: marketType,
                loss_limit_percentage: lossLimitPercentage,
                daily_loss_limit_percentage: daily_loss_limit_percentage,
                per_trade_loss_limit_percentage: per_trade_loss_limit_percentage,
                assigned_mentor_id: assignedMentorId || null,
                account_model: accountModel,
                account_classification: accountClassification || (accountModel === 'passthenpay' ? 'passthenpay' : 'evaluation')
            }, { onConflict: 'id' }),

            supabaseAdmin.from('portfolios').upsert({
                user_id: user.id,
                cash_balance: initialBalance,
                high_water_mark: initialBalance,
                opening_balance_today: initialBalance,
            }, { onConflict: 'user_id' }),

            supabaseAdmin.from('leverages').upsert({
                user_id: user.id,
                equity: equityLeverage,
                futures: 1, 
                options: 1,
                currency: equityLeverage,
                commodity: equityLeverage,
            }, { onConflict: 'user_id' })
        ]);

        if (pRes.error || poRes.error || lRes.error) {
            throw new Error(pRes.error?.message || poRes.error?.message || lRes.error?.message);
        }

        return { success: true, message: `Identity synchronized (${marketType}): ${accountClassification || 'evaluation'}` };

    } catch (error: any) {
        console.error("Database initialization crash:", error.message);
        return { success: false, message: `Spectrum setup failed: ${error.message}` };
    }
}
