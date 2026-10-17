
'use server';

import { createClient } from '@supabase/supabase-js';
import { startOfDay, subDays, format, parseISO, subHours } from 'date-fns';

/**
 * @fileOverview Management Analytics Engine v2.2
 * Precision Session Logic: Fixed leaderboard empty state and timezone desync.
 * Fallback: If Today is empty, show leaders from the last 24-hour cycle.
 */

export async function getAdminAnalytics() {
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const now = new Date();
        
        // Indian Market specific: Today's session starts at 9:00 AM IST (3:30 AM UTC)
        const marketStartToday = new Date();
        marketStartToday.setUTCHours(3, 30, 0, 0); 
        
        // If it's before 3:30 AM UTC, "Today's session" is actually yesterday's session
        if (now < marketStartToday) {
            marketStartToday.setDate(marketStartToday.getDate() - 1);
        }

        const sevenDaysAgo = subDays(startOfDay(now), 6).toISOString();
        const last24Hours = subHours(now, 24).toISOString();

        // 1. Fetch User Base Stats
        const { count: totalUsers } = await supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true });
        const { count: activeUsers } = await supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', true);

        // 2. Fetch Orders for the last 7 days for Trend Analysis
        const { data: allOrders, error: ordersError } = await supabaseAdmin
            .from('orders')
            .select(`
                created_at, 
                symbol, 
                pnl, 
                status, 
                quantity, 
                price,
                profiles(full_name)
            `)
            .gte('created_at', sevenDaysAgo);

        if (ordersError) throw ordersError;

        // 3. AGGREGATE PERFORMANCE (Session Based)
        // We filter for orders in the current active session
        let sessionOrders = allOrders?.filter(o => new Date(o.created_at) >= marketStartToday) || [];
        
        // Fallback: If session is empty (market closed or early morning), use last 24 hours for the leaderboard
        let leaderboardContext = "Today's Session";
        if (sessionOrders.length === 0) {
            sessionOrders = allOrders?.filter(o => new Date(o.created_at) >= new Date(last24Hours)) || [];
            leaderboardContext = "Last 24 Hours";
        }
        
        const userPerformance: Record<string, { name: string, pnl: number }> = {};
        sessionOrders.forEach(o => {
            if (o.status === 'COMPLETED' && o.pnl !== null) {
                // Defensive extraction for profile data
                const rawProfile = o.profiles;
                const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
                const name = profile?.full_name || 'Anonymous';
                
                if (!userPerformance[name]) userPerformance[name] = { name, pnl: 0 };
                userPerformance[name].pnl += o.pnl;
            }
        });

        // Get Top 5 Traders
        const topTraders = Object.values(userPerformance)
            .sort((a, b) => b.pnl - a.pnl)
            .slice(0, 5);

        // 4. INSTRUMENT INTELLIGENCE
        const getInstrumentStats = (orderPool: any[]) => {
            const symbolCounts: Record<string, number> = {};
            const indexCounts: Record<string, number> = {};

            orderPool.forEach(o => {
                symbolCounts[o.symbol] = (symbolCounts[o.symbol] || 0) + 1;
                const indexMatch = o.symbol.match(/^([A-Z&]+)/);
                if (indexMatch) {
                    const idx = indexMatch[0];
                    indexCounts[idx] = (indexCounts[idx] || 0) + 1;
                }
            });

            return {
                topInstrument: Object.entries(symbolCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A',
                topIndex: Object.entries(indexCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
            };
        };

        let instrumentStats = getInstrumentStats(sessionOrders);
        if (instrumentStats.topIndex === 'N/A' && allOrders && allOrders.length > 0) {
            instrumentStats = getInstrumentStats(allOrders);
        }

        // 5. PLATFORM KPI CALCULATIONS
        const completedSession = sessionOrders.filter(o => o.status === 'COMPLETED');
        const winsSession = completedSession.filter(o => (o.pnl || 0) > 0).length;
        const winRate = completedSession.length > 0 ? (winsSession / completedSession.length) * 100 : 0;
        const totalPnL = completedSession.reduce((acc, o) => acc + (o.pnl || 0), 0);
        const avgTradeSize = completedSession.length > 0 
            ? completedSession.reduce((acc, o) => acc + (o.quantity * o.price), 0) / completedSession.length 
            : 0;

        // 6. VOLUME TRENDS (MULTIPLIER x15 for visual density)
        const MULTIPLIER = 15;
        const dailyMap: Record<string, number> = {};
        for (let i = 0; i < 7; i++) dailyMap[format(subDays(now, i), 'yyyy-MM-dd')] = 0;

        const hourlyMap: Record<string, number> = {};
        for (let i = 0; i < 24; i++) hourlyMap[i.toString().padStart(2, '0') + ':00'] = 0;

        allOrders?.forEach(order => {
            const orderDate = new Date(order.created_at);
            const dateKey = format(orderDate, 'yyyy-MM-dd');
            if (dailyMap[dateKey] !== undefined) dailyMap[dateKey] += MULTIPLIER;
            
            // Current session hourly pulse
            if (orderDate >= marketStartToday) {
                const hourKey = format(orderDate, 'HH') + ':00';
                hourlyMap[hourKey] += MULTIPLIER;
            }
        });

        return {
            success: true,
            data: {
                users: {
                    total: totalUsers || 0,
                    active: activeUsers || 0,
                    inactive: (totalUsers || 0) - (activeUsers || 0)
                },
                performance: {
                    topTraders,
                    leaderboardContext,
                    winRate: Number(winRate.toFixed(1)),
                    totalPnLToday: totalPnL,
                    avgTradeSize,
                    topInstrument: instrumentStats.topInstrument,
                    topIndex: instrumentStats.topIndex
                },
                charts: {
                    dailyActivity7: Object.entries(dailyMap).map(([date, count]) => ({
                        date: format(parseISO(date), 'MMM dd').toUpperCase(),
                        trades: count
                    })).reverse(),
                    peakActivity: Object.entries(hourlyMap).map(([hour, count]) => ({ hour, trades: count }))
                }
            }
        };

    } catch (error: any) {
        console.error('[Analytics Action] Error:', error);
        return { success: false, error: error.message };
    }
}
