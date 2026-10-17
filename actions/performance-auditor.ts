'use server';

import { createClient } from '@supabase/supabase-js';
import { auditTraderPerformance } from '@/ai/flows/audit-trader';
import { revalidatePath } from 'next/cache';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * @fileOverview INSTITUTIONAL AUDIT ENGINE v6.5 (FINAL PRODUCTION)
 * Handles automatic promotions and weekly behavioral audits.
 * Fully await-guarded and scale-ready.
 */

export async function processPromotionCheck(userId: string) {
    try {
        const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', userId).single();
        const { data: portfolio } = await supabaseAdmin.from('portfolios').select('*').eq('user_id', userId).single();

        if (!profile || !portfolio || !profile.is_active) return;

        // 1. RATE LIMIT: 12-hour guard to prevent AI spam
        if (profile.last_audit_at) {
            const lastAudit = new Date(profile.last_audit_at);
            const now = new Date();
            const hoursSince = (now.getTime() - lastAudit.getTime()) / (1000 * 60 * 60);
            if (hoursSince < 12) return;
        }

        // 2. TARGET CONFIGURATION
        const targets: Record<string, number> = {
            'one_step_phase_1': 0.10,
            'two_step_phase_1': 0.08,
            'two_step_phase_2': 0.05
        };

        const targetPercent = targets[profile.account_classification || ''];
        if (!targetPercent) return;

        const initialBalance = portfolio.opening_balance_today; 
        const targetProfit = initialBalance * targetPercent;

        // 3. PROFIT GATE CHECK
        if (portfolio.cash_balance >= (initialBalance + targetProfit)) {
            console.log(`🎯 [AUDITOR] Target hit for ${userId}. Initializing AI Scan...`);

            const { data: trades } = await supabaseAdmin
                .from('orders')
                .select('*')
                .eq('user_id', userId)
                .eq('status', 'COMPLETED')
                .order('created_at', { ascending: true });

            const auditRes = await auditTraderPerformance({
                trades: (trades || []).map(t => ({ 
                    symbol: t.symbol, 
                    quantity: t.quantity, 
                    price: t.price, 
                    pnl: t.pnl || 0, 
                    created_at: t.created_at 
                })),
                accountType: profile.account_classification || 'Evaluation'
            });

            // 4. PERSIST AUDIT RECORD
            await Promise.all([
                supabaseAdmin.from('performance_audits').insert({
                    user_id: userId,
                    score: auditRes.score,
                    audit_type: 'PROMOTION',
                    status: auditRes.score >= 60 ? 'PASS' : 'FAIL',
                    reasoning: auditRes.reasoning
                }),
                supabaseAdmin.from('profiles').update({ last_audit_at: new Date().toISOString() }).eq('id', userId)
            ]);

            // 5. ATOMIC PROMOTION (Hard Shift)
            if (auditRes.score >= 60) {
                const nextPhaseMap: Record<string, string> = {
                    'one_step_phase_1': 'one_step_live',
                    'two_step_phase_1': 'two_step_phase_2',
                    'two_step_phase_2': 'two_step_live'
                };
                const nextPhase = nextPhaseMap[profile.account_classification || ''];

                await Promise.all([
                    supabaseAdmin.from('profiles').update({ 
                        account_classification: nextPhase,
                        audit_cycle_start: new Date().toISOString()
                    }).eq('id', userId),
                    
                    supabaseAdmin.from('portfolios').update({ 
                        cash_balance: initialBalance,
                        opening_balance_today: initialBalance,
                        high_water_mark: initialBalance
                    }).eq('user_id', userId),

                    createNotification(userId, 'Promotion Authorized!', `Behavioral score (${auditRes.score}) passed. You have been promoted to ${nextPhase?.replace(/_/g, ' ').toUpperCase() || 'LIVE'}.`, 'SUCCESS')
                ]);
            } else {
                await createNotification(userId, 'Promotion Retained', `Profit target hit, but behavioral score (${auditRes.score}) is below requirement (60+). Maintain consistency to unlock promotion.`, 'WARNING');
            }
            
            revalidatePath('/dashboard');
            revalidatePath('/profile');
            revalidatePath('/admin');
        }
    } catch (e) {
        console.error("[AUDITOR ERROR]", e);
    }
}

export async function processWeeklyLiveAudit(userId: string) {
    try {
        const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', userId).single();
        if (!profile || !profile.is_active) return;

        const liveClasses = ['one_step_live', 'two_step_live', 'instant_live', 'passthenpay'];
        if (!liveClasses.includes(profile.account_classification || '')) return;

        // ANCHOR LOGIC for legacy/new users
        if (!profile.audit_cycle_start) {
            await supabaseAdmin.from('profiles').update({ audit_cycle_start: new Date().toISOString() }).eq('id', userId);
            return;
        }

        const cycleStart = new Date(profile.audit_cycle_start);
        const now = new Date();
        const diffDays = (now.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24);

        if (diffDays >= 7) {
            const windowEnd = now.toISOString();
            const windowStart = cycleStart.toISOString();

            const { data: trades } = await supabaseAdmin
                .from('orders')
                .select('*')
                .eq('user_id', userId)
                .gte('created_at', windowStart)
                .lte('created_at', windowEnd);

            const auditRes = await auditTraderPerformance({
                trades: (trades || []).map(t => ({ 
                    symbol: t.symbol, 
                    quantity: t.quantity, 
                    price: t.price, 
                    pnl: t.pnl || 0, 
                    created_at: t.created_at 
                })),
                accountType: 'Live Spectrum'
            });

            await Promise.all([
                supabaseAdmin.from('performance_audits').insert({
                    user_id: userId,
                    score: auditRes.score,
                    audit_type: 'WEEKLY_LIVE',
                    status: auditRes.score >= 60 ? 'PASS' : 'FAIL',
                    reasoning: auditRes.reasoning,
                    window_start: windowStart,
                    window_end: windowEnd
                }),
                supabaseAdmin.from('profiles').update({ audit_cycle_start: windowEnd }).eq('id', userId)
            ]);

            const title = auditRes.score >= 60 ? 'Weekly Alpha Verified' : 'Weekly Behavior Flagged';
            const msg = auditRes.score >= 60 
                ? `Score: ${auditRes.score}. Your execution quality is verified for payout eligibility.`
                : `Score: ${auditRes.score}. Behavior flagged for inconsistency. Payout eligibility restricted.`;
            
            await createNotification(userId, title, msg, auditRes.score >= 60 ? 'SUCCESS' : 'WARNING');
            revalidatePath('/profile');
        }
    } catch (e) {
        console.error("[WEEKLY AUDIT ERROR]", e);
    }
}

async function createNotification(userId: string, title: string, content: string, type: 'SUCCESS' | 'WARNING' | 'INFO' | 'ERROR') {
    await supabaseAdmin.from('user_notifications').insert({
        user_id: userId,
        title,
        content,
        type,
        is_read: false
    });
}