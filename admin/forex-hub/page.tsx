
'use client';

import React, { useState, useEffect } from 'react';
import { FOREX_INSTRUMENTS } from '@/lib/forex-config';
import { useWebSocketData } from '@/context/websocket-context';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Globe, Search, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ReadyState } from 'react-use-websocket';

/**
 * @fileOverview Institutional Forex Pulse Terminal v1.2
 * High-density monitoring of the Twelve Data 50-pair spectrum.
 */

export default function ForexHubPage() {
    const { prices, subscribe, readyState } = useWebSocketData();
    const [activeTab, setActiveTab] = useState<'all' | 'forex' | 'crypto' | 'indices' | 'commodities'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        // Subscribe to the entire 50-pair spectrum for monitoring
        subscribe(FOREX_INSTRUMENTS.map(i => ({ symbol: i.symbol, exchange: 'FOREX' })));
    }, [subscribe]);

    const filtered = FOREX_INSTRUMENTS.filter(i => {
        const matchesTab = activeTab === 'all' || i.category === activeTab;
        const matchesSearch = i.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             i.label.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesTab && matchesSearch;
    });

    const isWsConnected = readyState === ReadyState.OPEN;

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-8 animate-in fade-in duration-1000">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-8 border-b border-slate-200">
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase font-headline">Forex Hub</h1>
                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100 shadow-inner">
                            {isWsConnected ? <Wifi className="h-3 w-3 text-emerald-500" /> : <WifiOff className="h-3 w-3 text-rose-500" />}
                            <span className={cn("text-[9px] font-black uppercase tracking-widest", isWsConnected ? "text-emerald-600" : "text-rose-600")}>
                                {isWsConnected ? 'Pulse Active' : 'Connecting...'}
                            </span>
                        </div>
                    </div>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Live monitoring of the Twelve Data spectrum</p>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                        <Input 
                            placeholder="Filter spectrum..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-11 bg-white border-slate-200 rounded-xl text-xs font-bold"
                        />
                    </div>
                    <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto no-scrollbar w-full md:w-auto">
                        {['all', 'forex', 'crypto', 'indices', 'commodities'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={cn(
                                    "px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                                    activeTab === tab ? "bg-[#5D2D91] text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                {filtered.map((inst) => {
                    const key = `FOREX:${inst.symbol.toUpperCase()}`;
                    const live = prices[key];
                    const isUpdating = !!live;

                    return (
                        <Card key={inst.symbol} className="rounded-[2rem] border-none shadow-xl bg-white hover:shadow-2xl transition-all duration-500 group overflow-hidden">
                            <CardContent className="p-6 space-y-6">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <h3 className="text-lg font-black text-slate-900 font-headline leading-tight tracking-tight">{inst.symbol}</h3>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{inst.label}</p>
                                    </div>
                                    <div className={cn(
                                        "h-3 w-3 rounded-full transition-all duration-300",
                                        isUpdating ? "bg-emerald-500 shadow-[0_0_15px_#10b981] animate-pulse" : "bg-slate-100"
                                    )} />
                                </div>

                                <div className="py-6 bg-slate-50/50 rounded-[1.5rem] border border-slate-100 flex flex-col items-center justify-center text-center shadow-inner">
                                    <p className="text-3xl font-black text-slate-900 tracking-tighter">
                                        {live ? live.price.toFixed(inst.category === 'forex' ? 5 : 2) : '---'}
                                    </p>
                                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.3em] mt-2">Live Pulse (USD)</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4 border-t border-slate-50 pt-4">
                                    <div className="space-y-0.5">
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Lot Size</p>
                                        <p className="text-xs font-black text-slate-800">{inst.lotSize.toLocaleString()}</p>
                                    </div>
                                    <div className="space-y-0.5 text-right">
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Pip Unit</p>
                                        <p className="text-xs font-black text-slate-800">{inst.pipSize}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
