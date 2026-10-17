
'use server';

import { getMarketStatus as getMarketStatusInternal } from '@/lib/market-time';

type MarketStatusResult = {
    isOpen: boolean;
    message: string;
};

export async function getMarketStatus(exchange: string): Promise<MarketStatusResult> {
    if (!exchange) {
        return { isOpen: false, message: 'Exchange not provided.' };
    }
    return getMarketStatusInternal(exchange);
}
