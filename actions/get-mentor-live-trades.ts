'use client';

import { createClient } from '@supabase/supabase-js';
import { getStockPrice } from './get-stock-price';

export interface MentorLiveTrade {
    id: number;
    symbol: string;
    exchange: string;
    instrument_type: string;
    quantity: number;
    average_price: number;
    ltp: number;
    pnl: number;
    profiles: {
        full_name: string;
    } | null;
}

type GetLiveTradesResult = {
    success: true;
    data: MentorLiveTrade[];
} | {
    success: false;
    error: string;
};

export async function getMentorLiveTrades(userId: string): Promise<GetLiveTradesResult> {
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
            .select('id')
            .eq('assigned_mentor_id', userId);

        if (studentsError) {
            throw new Error(`Failed to fetch assigned students: ${studentsError.message}`);
        }

        const studentIds = assignedStudents.map(s => s.id);
        if (studentIds.length === 0) {
            return { success: true, data: [] };
        }

        const { data: openPositions, error: positionsError } = await supabaseAdmin
            .from('positions')
            .select(`
                id, symbol, exchange, instrument_type, quantity, average_price,
                profiles ( full_name )
            `)
            .in('user_id', studentIds);

        if (positionsError) {
            throw new Error(`Failed to fetch positions: ${positionsError.message}`);
        }

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
        
        const enrichedPositions: MentorLiveTrade[] = openPositions.map(pos => {
            const ltp = latestPrices.get(`${pos.symbol}:${pos.exchange}`) || pos.average_price;
            const pnl = (ltp - pos.average_price) * pos.quantity;
            return {
                ...(pos as any),
                ltp,
                pnl,
            };
        });

        return { success: true, data: enrichedPositions };

    } catch (error: any) {
        console.error("Error in getMentorLiveTrades:", error.message);
        return { success: false, error: error.message || 'An unknown error occurred.' };
    }
}
