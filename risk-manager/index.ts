
'use server';
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { getMultipleStockPrices } from '../app/actions/get-stock-price';
import { breachAccount } from '../app/actions/breach-account';

const POLLING_INTERVAL_MS = 1000;

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log(`🛡️ [RISK SENTINEL] Real-Time Compliance Audit Active...`);

/**
 * LIVE EQUITY SENTINEL (Tiers 1, 2, 3)
 * Monitors Net Equity every second to catch breaches and zero-equity liquidations.
 */
async function monitorNetEquity() {
    const { data: profiles } = await supabaseAdmin.from('profiles').select('*').eq('is_active', true);
    if (!profiles || profiles.length === 0) return;

    const userIds = profiles.map(p => p.id);
    const [{ data: portfolios }, { data: positions }] = await Promise.all([
        supabaseAdmin.from('portfolios').select('*').in('user_id', userIds),
        supabaseAdmin.from('positions').select('*').in('user_id', userIds)
    ]);

    if (!positions || positions.length === 0) return;

    const instruments = Array.from(new Set(positions.map(p => `${p.exchange.toUpperCase()}:${p.symbol.toUpperCase()}`)))
        .map(k => ({ exchange: k.split(':')[0], symbol: k.split(':')[1] }));

    const priceRes = await getMultipleStockPrices(instruments);
    if (!priceRes.success) return;

    for (const profile of profiles) {
        const portfolio = portfolios?.find(p => p.user_id === profile.id);
        if (!portfolio) continue;

        const userPositions = positions.filter(p => p.user_id === profile.id);
        let totalLivePnl = 0;

        // --- TIER 3: PER-TRADE LOSS ---
        for (const pos of userPositions) {
            const key = `${pos.exchange.toUpperCase()}:${pos.symbol.toUpperCase()}`;
            const price = priceRes.data[key]?.price;
            if (!price) continue;

            const posPnl = (price - pos.average_price) * pos.quantity;
            totalLivePnl += posPnl;

            if (profile.account_model !== 'passthenpay') {
                const tradeLimit = portfolio.opening_balance_today * (profile.per_trade_loss_limit_percentage / 100);
                if (posPnl < -tradeLimit) {
                    await breachAccount(profile.id, `Tier 3 Violation: Single trade loss exceeds allowed cap.`, pos, price);
                    continue; 
                }
            }
        }

        const netEquity = portfolio.cash_balance + totalLivePnl;

        // --- MARGIN CALL SENTINEL ---
        if (netEquity <= 0) {
            await breachAccount(profile.id, `Atomic Margin Call: Net equity depleted.`);
            continue;
        }

        // --- TIER 2: DAILY LOSS LIMIT ---
        const dailyLimit = portfolio.opening_balance_today * (profile.daily_loss_limit_percentage / 100);
        if (netEquity < (portfolio.opening_balance_today - dailyLimit)) {
            await breachAccount(profile.id, `Tier 2 Violation: Total equity dropped below daily loss limit.`);
            continue;
        }

        // --- TIER 1: MAX DRAWDOWN ---
        const drawdownLimit = portfolio.high_water_mark * (profile.loss_limit_percentage / 100);
        if (netEquity < (portfolio.high_water_mark - drawdownLimit)) {
            await breachAccount(profile.id, `Tier 1 Violation: Maximum drawdown from high-water mark reached.`);
            continue;
        }
    }
}

(async () => {
    while (true) {
        try {
            await monitorNetEquity();
        } catch (e: any) {
            console.error("Sentinel Cycle Crash:", e.message);
        }
        await new Promise(r => setTimeout(r, POLLING_INTERVAL_MS));
    }
})();
