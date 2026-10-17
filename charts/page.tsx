'use client';

import React from 'react';
import { AppLayout } from '@/components/app-layout';
import TradingViewChart from '@/components/trading-view-chart';

/**
 * @fileOverview PURE CHARTING TERMINAL
 * Stripped of all custom UI elements to provide an immersive TradingView experience
 * integrated within the StockMint UI framework.
 */

export default function ChartsPage() {
    return (
        <AppLayout>
            <div className="h-[calc(100vh-220px)] w-full glass rounded-[2rem] md:rounded-[3rem] overflow-hidden border border-white/10 shadow-2xl relative">
                <TradingViewChart 
                    symbol="NIFTY" 
                    exchange="NSE" 
                />
            </div>
        </AppLayout>
    );
}
