
'use server';

import { createServerClient } from '@supabase/ssr';
import { getStockPrice } from './get-stock-price';
import { cookies } from 'next/headers';

// --- TYPES ---
export interface RiskOverview {
    profile: {
        id: string;
        full_name: string;
        is_active: boolean;
        is_hidden: boolean;
        loss_limit_percentage: number;
        daily_loss_limit_percentage: number;
        per_trade_loss_limit_percentage: number;
    };
    portfolio: {
        cash_balance: number;
        high_water_mark: number;
        opening_balance_today: number;
    };
    pnl: {
        realized_today: number;
        total_overall_pnl: number;
        live: number;
    };
    breachLevels: {
        max_drawdown_limit: number;
        daily_loss_limit: number;
        per_trade_loss_limit: number;
    };
    live_positions: {
        id: number;
        symbol: string;
        quantity: number;
        average_price: number;
        live_pnl: number;
        breach_level: number;
    }[];
}

type GetRiskOverviewResult = {
    success: true;
    data: RiskOverview[];
} | {
    success: false;
    error: string;
};

// --- CORE FUNCTION ---
export async function getRiskOverview(): Promise<GetRiskOverviewResult> {
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

        // 1. Fetch all profiles including is_hidden
        const { data: activeProfiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, full_name, is_active, is_hidden, loss_limit_percentage, daily_loss_limit_percentage, per_trade_loss_limit_percentage');

        if (profilesError) throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
        if (!activeProfiles || activeProfiles.length === 0) return { success: true, data: [] };
        
        const userIds = activeProfiles.map(p => p.id);

        const { data: portfolios, error: portfoliosError } = await supabase
            .from('portfolios')
            .select('user_id, cash_balance, high_water_mark, opening_balance_today')
            .in('user_id', userIds);

        if (portfoliosError) throw new Error(`Failed to fetch portfolios: ${portfoliosError.message}`);

        // 2. Fetch all open positions for these users
        const { data: openPositions, error: positionsError } = await supabase
            .from('positions')
            .select('id, user_id, symbol, exchange, quantity, average_price')
            .in('user_id', userIds);
        
        if (positionsError) throw new Error(`Failed to fetch positions: ${positionsError.message}`);

        // 3. Get unique instruments from open positions and fetch live prices
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

        // 4. Fetch today's realized PNL for all users
        const todayStr = new Date().toISOString().split('T')[0];
        const { data: dailyPnlData, error: pnlError } = await supabase
            .from('daily_pnl')
            .select('user_id, pnl, date')
            .in('user_id', userIds);

        if (pnlError) throw new Error(`Failed to fetch daily PNL: ${pnlError.message}`);
        
        const realizedPnlByUser: Map<string, { today: number; overall: number }> = new Map();
        if (dailyPnlData) {
            for (const pnlRecord of dailyPnlData) {
                const current = realizedPnlByUser.get(pnlRecord.user_id) || { today: 0, overall: 0 };
                
                if (pnlRecord.date === todayStr) {
                    current.today += pnlRecord.pnl;
                }
                current.overall += pnlRecord.pnl;

                realizedPnlByUser.set(pnlRecord.user_id, current);
            }
        }
        
        // 5. Process each user and build the final RiskOverview object
        const overview: RiskOverview[] = [];
        for (const profile of activeProfiles) {
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
                profile: {
                    id: profile.id,
                    full_name: profile.full_name || 'N/A',
                    is_active: profile.is_active,
                    is_hidden: profile.is_hidden || false,
                    loss_limit_percentage: profile.loss_limit_percentage,
                    daily_loss_limit_percentage: profile.daily_loss_limit_percentage,
                    per_trade_loss_limit_percentage: profile.per_trade_loss_limit_percentage,
                },
                portfolio: {
                    cash_balance: portfolio.cash_balance,
                    high_water_mark: portfolio.high_water_mark,
                    opening_balance_today: portfolio.opening_balance_today,
                },
                pnl: {
                    realized_today: pnlTotals.today,
                    total_overall_pnl: pnlTotals.overall,
                    live: totalLivePnl,
                },
                breachLevels: {
                    daily_loss_limit: dailyLossLimit,
                    max_drawdown_limit: maxDrawdownLimit,
                    per_trade_loss_limit: perTradeLossLimit,
                },
                live_positions: livePositionsData,
            });
        }
        
        return { success: true, data: overview };

    } catch (error: any) {
        console.error("Error in getRiskOverview:", error.message);
        return { success: false, error: error.message || 'An unknown error occurred.' };
    }
}
