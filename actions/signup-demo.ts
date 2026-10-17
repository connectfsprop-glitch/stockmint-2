
'use server';

import { createClient } from '@supabase/supabase-js';

type SignupInput = {
    fullName: string;
    email: string;
    password?: string;
    whatsapp: string;
};

/**
 * ATOMIC DEMO INITIALIZATION v3.2
 * Hardened: Removes email column write to prevent schema cache errors.
 * Identity is maintained via Auth-Sync Lookup Protocol.
 */
export async function signupDemoUser(input: SignupInput) {
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
    
    const { fullName, email, password, whatsapp } = input;

    // 1. Create or Recover Auth Identity
    let { data: { user }, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: password || email,
        email_confirm: true,
        user_metadata: { full_name: fullName }
    });

    if (authError) {
        if (authError.message.includes('already registered')) {
            const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
            const existing = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
            if (!existing) return { success: false, message: authError.message };
            user = existing;
        } else {
            return { success: false, message: authError.message };
        }
    }

    if (!user) return { success: false, message: 'Initialization failed.' };

    try {
        // 2. ATOMIC CLEANUP: Purge previous state for clean initialization
        await Promise.all([
            supabaseAdmin.from('portfolios').delete().eq('user_id', user.id),
            supabaseAdmin.from('leverages').delete().eq('user_id', user.id),
            supabaseAdmin.from('demo_users').delete().eq('user_id', user.id),
            supabaseAdmin.from('profiles').delete().eq('id', user.id)
        ]);

        // 3. FRESH IDENTITY SYNC (Schema-Compliant)
        const [pRes, dRes, poRes, lRes] = await Promise.all([
            supabaseAdmin.from('profiles').insert({
                id: user.id,
                full_name: fullName,
                // Removed 'email' column write to fix System Error: column not found
                role: 'student',
                is_active: true,
                market_type: 'indian',
                account_model: 'normal',
                account_classification: 'demo',
                loss_limit_percentage: 10,
                daily_loss_limit_percentage: 5,
                per_trade_loss_limit_percentage: 2,
                created_at: new Date().toISOString()
            }),

            supabaseAdmin.from('demo_users').insert({
                user_id: user.id,
                full_name: fullName,
                email: email,
                whatsapp_number: whatsapp,
                expiry_at: new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString()
            }),

            supabaseAdmin.from('portfolios').insert({
                user_id: user.id,
                cash_balance: 100000,
                high_water_mark: 100000,
                opening_balance_today: 100000,
            }),

            supabaseAdmin.from('leverages').insert({
                user_id: user.id,
                equity: 5,
                futures: 1, 
                options: 1,
                currency: 5,
                commodity: 5,
            })
        ]);

        if (pRes.error) throw pRes.error;
        if (dRes.error) throw dRes.error;
        if (poRes.error) throw poRes.error;

        return { success: true, message: 'Demo identity synchronized.' };

    } catch (error: any) {
        console.error("Signup Sync Error:", error.message);
        return { success: false, message: `System error: ${error.message}` };
    }
}
