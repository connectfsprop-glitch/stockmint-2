'use server';

import { createClient } from '@supabase/supabase-js';

/**
 * @fileOverview GLOBAL IDENTITY SYNC ENGINE v7.1 (STABILITY ENHANCED)
 * Performs an Exhaustive Recursive Scan of both Supabase Auth and Profiles.
 * Defensive extraction of emails to ensure identity visibility without crashing.
 */

export async function getTradersList() {
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    try {
        // 1. EXHAUSTIVE AUTH SCAN (Recursive)
        let authUsers: any[] = [];
        let authPage = 1;
        let hasMoreAuth = true;

        while (hasMoreAuth) {
            const { data, error } = await supabaseAdmin.auth.admin.listUsers({
                page: authPage,
                perPage: 1000
            });
            if (error) throw error;
            authUsers = [...authUsers, ...(data?.users || [])];
            if ((data?.users || []).length < 1000) hasMoreAuth = false;
            else authPage++;
        }

        // 2. EXHAUSTIVE PROFILE SCAN (Recursive)
        let profiles: any[] = [];
        let profileOffset = 0;
        let hasMoreProfiles = true;
        const BATCH_SIZE = 1000;

        while (hasMoreProfiles) {
            const { data, error } = await supabaseAdmin
                .from('profiles')
                .select('*')
                .range(profileOffset, profileOffset + BATCH_SIZE - 1);
            
            if (error) throw error;
            profiles = [...profiles, ...(data || [])];
            if ((data || []).length < BATCH_SIZE) hasMoreProfiles = false;
            else profileOffset += BATCH_SIZE;
        }

        // 3. FETCH BALANCES (Exhaustive)
        const { data: portfolios } = await supabaseAdmin
            .from('portfolios')
            .select('user_id, cash_balance');
        
        const balanceMap = new Map(portfolios?.map(p => [p.user_id, p.cash_balance]) || []);

        // 4. FETCH BREACH CONTEXT
        const { data: breachOrders } = await supabaseAdmin
            .from('orders')
            .select('user_id, breach_reason')
            .not('breach_reason', 'is', null)
            .neq('breach_reason', '')
            .order('created_at', { ascending: false });

        const breachReasonMap = new Map();
        if (breachOrders) {
            for (const order of breachOrders) {
                if (!breachReasonMap.has(order.user_id)) {
                    breachReasonMap.set(order.user_id, order.breach_reason);
                }
            }
        }

        // 5. BIDIRECTIONAL IDENTITY MERGE (The "No-Miss" Protocol)
        const authMap = new Map(authUsers.map(u => [u.id, u]));
        const mergedSet = new Set<string>();
        const finalData: any[] = [];

        // --- PHASE A: Iterate through all PROFILES (The primary base) ---
        profiles.forEach(profile => {
            const authUser = authMap.get(profile.id);
            mergedSet.add(profile.id);
            
            finalData.push({
                id: profile.id,
                email: authUser?.email || profile.email || 'Sync Pending',
                full_name: profile.full_name || authUser?.user_metadata?.full_name || 'Incomplete Identity',
                role: profile.role || 'student',
                is_active: profile.is_active ?? true,
                is_hidden: profile.is_hidden ?? false,
                market_type: profile.market_type || 'indian',
                account_classification: profile.account_classification || null,
                account_model: profile.account_model || 'normal',
                loss_limit_percentage: profile.loss_limit_percentage || 0,
                daily_loss_limit_percentage: profile.daily_loss_limit_percentage || 0,
                cash_balance: balanceMap.get(profile.id) ?? 0,
                latest_breach_reason: breachReasonMap.get(profile.id) ?? null,
                created_at: profile.created_at
            });
        });

        // --- PHASE B: Catch remaining AUTH users (Incomplete profiles) ---
        authUsers.forEach(authUser => {
            if (!mergedSet.has(authUser.id)) {
                finalData.push({
                    id: authUser.id,
                    email: authUser.email,
                    full_name: authUser.user_metadata?.full_name || 'Pending Onboarding',
                    role: 'student',
                    is_active: true,
                    is_hidden: false,
                    market_type: 'indian',
                    account_classification: null,
                    account_model: 'normal',
                    loss_limit_percentage: 0,
                    daily_loss_limit_percentage: 0,
                    cash_balance: balanceMap.get(authUser.id) ?? 0,
                    latest_breach_reason: null,
                    created_at: authUser.created_at
                });
            }
        });

        return { success: true, data: finalData };
    } catch (error: any) {
        console.error('CRITICAL SYNC FAILURE:', error);
        return { success: false, error: error.message || 'Institutional sync failure.' };
    }
}
