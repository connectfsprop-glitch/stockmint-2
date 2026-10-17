'use client';

import { createClient } from '@supabase/supabase-js';
import { getStockPrice } from './get-stock-price';
import type { RiskOverview } from './get-risk-overview';

type GetMentorRiskOverviewResult = {
    success: true;
    data: RiskOverview[];
} | {
    success: false;
    error: string;
};


export async function getMentorRiskOverview(userId: string): Promise<GetMentorRiskOverviewResult> {
    if (!userId) {
        return { success: false, error: 'Not authenticated' };
    }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { data: assignedStudents, error: studentsError } = await supabaseAdmin
            .from('profiles')
            .select('id, full_name, is_active, loss_limit_percentage, daily_loss_limit_percentage, per_trade_loss_limit_percentage')
            .eq('assigned_mentor_id', userId);
        
        if (studentsError) throw new Error(`Failed to fetch assigned students: ${studentsError.message}`);
        if (!assignedStudents || assignedStudents.length === 0) return { success: true, data: [] };
        
        const studentIds = assignedStudents.map(p => p.id);

        const { data: portfolios, error: portfoliosError } = await supabaseAdmin
            .from('portfolios')
            .select('user_id, cash_balance, high_water_mark, opening_balance_today')
            .in('user_id', studentIds);

        if (portfoliosError) throw new Error(`Failed to fetch portfolios: ${portfoliosError.message}`);

        const { data: openPositions, error: positionsError } = await supabaseAdmin
            .from('positions')
            .select('id, user_id, symbol, exchange, quantity, average_price')
            .in('user_id', studentIds);
        
        if (positionsError) throw new Error(`Failed to fetch positions: ${positionsError.message}`);

        const uniqueInstruments = [...new Map(openPositions.map(p => [`${p.symbol}:${p.exchange}`, { symbol: p.symbol, exchange: p.exchange }])).values()];
        const latestPrices = new Map<string, number>();
        if (uniqueInstruments.length > 0) {
            const priceResults = await Promise.all(uniqueInstruments.map(inst => getStockPrice(inst)));
            priceResults.forEach((res, index) => {
                if (res.success) {
                    const key = `${uniqueInstruments[index].symbol}:${uniqueInstruments[index].exchange}`;
                    latestPrices.set(key, res.data.price);
                }
            });
        }

        const todayStr = new Date().toISOString().split('T')[0];
        const { data: dailyPnlData, error: pnlError } = await supabaseAdmin
            .from('daily_pnl')
            .select('user_id, pnl, date')
            .in('user_id', studentIds);

        if (pnlError) throw new Error(`Failed to fetch daily PNL: ${pnlError.message}`);
        
        const realizedPnlByUser: Map<string, { today: number; overall: number }> = new Map();
        if (dailyPnlData) {
            for (const pnlRecord of dailyPnlData) {
                const current = realizedPnlByUser.get(pnlRecord.user_id) || { today: 0, overall: 0 };
                if (pnlRecord.date === todayStr) current.today += pnlRecord.pnl;
                current.overall += pnlRecord.pnl;
                realizedPnlByUser.set(pnlRecord.user_id, current);
            }
        }
        
        const overview: RiskOverview[] = [];
        for (const profile of assignedStudents) {
            const portfolio = portfolios?.find(p => p.user_id === profile.id);
            if (!portfolio) continue;
            
            const userPositions = openPositions.filter(p => p.user_id === profile.id);
            let totalLivePnl = 0;

            const perTradeLossLimit = portfolio.opening_balance_today * (profile.per_trade_loss_limit_percentage / 100);

            const livePositionsData = userPositions.map(pos => {
                const ltp = latestPrices.get(`${pos.symbol}:${pos.exchange}`) || pos.average_price;
                const livePnl = (ltp - pos.average_price) * pos.quantity;
                totalLivePnl += livePnl;
                
                return {
                    id: pos.id,
                    symbol: pos.symbol,
                    quantity: pos.quantity,
                    average_price: pos.average_price,
                    live_pnl: livePnl,
                    breach_level: -perTradeLossLimit,
                };
            });

            const dailyLossLimit = portfolio.opening_balance_today * (profile.daily_loss_limit_percentage / 100);
            const maxDrawdownLimit = portfolio.high_water_mark * (profile.loss_limit_percentage / 100);
            const pnlTotals = realizedPnlByUser.get(profile.id) || { today: 0, overall: 0 };

            overview.push({
                profile: { ...profile, full_name: profile.full_name || 'N/A' },
                portfolio,
                pnl: { realized_today: pnlTotals.today, total_overall_pnl: pnlTotals.overall, live: totalLivePnl },
                breachLevels: { daily_loss_limit: dailyLossLimit, max_drawdown_limit: maxDrawdownLimit, per_trade_loss_limit: perTradeLossLimit },
                live_positions: livePositionsData,
            });
        }
        
        return { success: true, data: overview };

    } catch (error: any) {
        console.error("Error in getMentorRiskOverview:", error.message);
        return { success: false, error: error.message || 'An unknown error occurred.' };
    }
}
