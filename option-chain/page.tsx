'use client';

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { AppLayout } from '@/components/app-layout';
import { getOptionChainData } from '../actions/search-instruments';
import { useWebSocketData } from '@/context/websocket-context';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
    Target, 
    Loader2,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InstrumentActionSheet } from '@/components/instrument-action-sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { getMultipleStockPrices } from '../actions/get-stock-price';
import { useSearchParams } from 'next/navigation';

/**
 * @fileOverview Option Chain Terminal
 */

const INDICES = [
    { label: 'Nifty', value: 'NIFTY', spot: 'NIFTY 50', exch: 'NSE' },
    { label: 'Bank Nifty', value: 'BANKNIFTY', spot: 'NIFTY BANK', exch: 'NSE' },
    { label: 'Sensex', value: 'SENSEX', spot: 'SENSEX', exch: 'BSE' },
    { label: 'Fin Nifty', value: 'FINNIFTY', spot: 'NIFTY FIN SERVICE', exch: 'NSE' },
];

function OptionChainContent() {
    const isMobile = useIsMobile();
    const searchParams = useSearchParams();
    const { prices, subscribe } = useWebSocketData();
    
    const initialIndex = searchParams.get('index') || 'NIFTY';
    
    const [selectedIndex, setSelectedIndex] = useState(initialIndex);
    const [selectedExpiry, setSelectedExpiry] = useState<string>('');
    const [expiries, setExpiries] = useState<string[]>([]);
    const [chainMap, setChainMap] = useState<Record<string, any>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [initialSpotPrice, setInitialSpotPrice] = useState<number>(0);
    const [initialPrices, setInitialPrices] = useState<Record<string, any>>({});
    
    const [selectedInstrument, setSelectedInstrument] = useState<any>(null);
    const [isOrderPanelOpen, setIsOrderPanelOpen] = useState(false);

    const currentIndexConfig = useMemo(() => 
        INDICES.find(i => i.value === selectedIndex) || INDICES[0], 
    [selectedIndex]);

    useEffect(() => {
        const indexParam = searchParams.get('index');
        if (indexParam && INDICES.some(i => i.value === indexParam)) {
            setSelectedIndex(indexParam);
        }
    }, [searchParams]);

    const fetchChain = useCallback(async () => {
        setIsLoading(true);
        
        const [res, spotRes] = await Promise.all([
            getOptionChainData(selectedIndex),
            getMultipleStockPrices([{ symbol: currentIndexConfig.spot, exchange: currentIndexConfig.exch }])
        ]);

        if (spotRes.success) {
            const key = `${currentIndexConfig.exch.toUpperCase()}:${currentIndexConfig.spot.toUpperCase()}`;
            setInitialSpotPrice(spotRes.data[key]?.price || 0);
        }

        if (res.success && res.data) {
            setExpiries(res.data.expiries);
            setChainMap(res.data.chain);
            if (!selectedExpiry || !res.data.expiries.includes(selectedExpiry)) {
                setSelectedExpiry(res.data.expiries[0]);
            }
        }
        setIsLoading(false);
    }, [selectedIndex, currentIndexConfig, selectedExpiry]);

    useEffect(() => {
        fetchChain();
    }, [selectedIndex]);

    const spotPrice = useMemo(() => {
        const key = `${currentIndexConfig.exch.toUpperCase()}:${currentIndexConfig.spot.toUpperCase()}`;
        return prices[key]?.price || initialSpotPrice;
    }, [prices, currentIndexConfig, initialSpotPrice]);

    const fullChain = useMemo(() => chainMap[selectedExpiry] || [], [chainMap, selectedExpiry]);

    const atmStrike = useMemo(() => {
        if (!spotPrice || fullChain.length === 0) return 0;
        return fullChain.reduce((prev: any, curr: any) => 
            Math.abs(curr.strike - spotPrice) < Math.abs(prev.strike - spotPrice) ? curr : prev
        ).strike;
    }, [spotPrice, fullChain]);

    const focusedChain = useMemo(() => {
        if (!atmStrike || fullChain.length === 0) return fullChain;
        const atmIndex = fullChain.findIndex((r: any) => r.strike === atmStrike);
        const start = Math.max(0, atmIndex - 10);
        const end = Math.min(fullChain.length, atmIndex + 11);
        return fullChain.slice(start, end);
    }, [fullChain, atmStrike]);

    useEffect(() => {
        if (focusedChain.length > 0) {
            const instruments = focusedChain.flatMap((row: any) => [
                { symbol: row.ce?.tradingsymbol, exchange: row.ce?.exchange },
                { symbol: row.pe?.tradingsymbol, exchange: row.pe?.exchange }
            ]).filter((i: any) => i.symbol);
            
            instruments.push({ symbol: currentIndexConfig.spot, exchange: currentIndexConfig.exch });
            
            const bootstrapPrices = async () => {
                const res = await getMultipleStockPrices(instruments);
                if (res.success) {
                    const map: Record<string, any> = {};
                    Object.entries(res.data).forEach(([key, data]) => {
                        map[key.toUpperCase()] = data;
                    });
                    setInitialPrices(prev => ({ ...prev, ...map }));
                }
            };
            bootstrapPrices();
            subscribe(instruments);
        }
    }, [focusedChain, subscribe, currentIndexConfig]);

    const handleTrade = (instrument: any) => {
        if (!instrument) return;
        const key = `${instrument.exchange.toUpperCase()}:${instrument.tradingsymbol.toUpperCase()}`;
        const livePrice = prices[key]?.price || initialPrices[key]?.price || 0;
        setSelectedInstrument({ ...instrument, price: livePrice });
        setIsOrderPanelOpen(true);
    };

    return (
        <AppLayout>
            <InstrumentActionSheet instrument={selectedInstrument} isOpen={isOrderPanelOpen} onOpenChange={setIsOrderPanelOpen} />
            
            <div className="max-w-[1600px] mx-auto space-y-6 md:space-y-8 animate-in fade-in duration-1000 slide-in-from-bottom-2">
                <header className="flex flex-col xl:flex-row items-start xl:items-end justify-between gap-6 pb-6 border-b border-gray-200">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <h1 className="font-headline text-3xl md:text-5xl font-black tracking-tighter text-white">Options.</h1>
                            <Badge className="bg-amber-100 text-amber-700 font-bold text-[10px] px-3 py-1 rounded-full">Option Chain</Badge>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
                        <div className="flex items-center gap-2 p-1 bg-slate-100/50 rounded-2xl w-full sm:w-auto overflow-x-auto no-scrollbar border border-slate-200 shadow-inner">
                            {INDICES.map((idx) => (
                                <button 
                                    key={idx.value}
                                    onClick={() => setSelectedIndex(idx.value)}
                                    className={cn(
                                        "px-5 py-2 rounded-xl text-[10px] font-bold transition-all whitespace-nowrap",
                                        selectedIndex === idx.value ? "bg-white text-[#5D2D91] shadow-lg" : "text-slate-400 hover:text-slate-600"
                                    )}
                                >{idx.label}</button>
                            ))}
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <Select value={selectedExpiry} onValueChange={setSelectedExpiry}>
                                <SelectTrigger className="h-12 md:h-14 w-full sm:w-48 bg-white border-none rounded-2xl font-bold text-[10px] text-slate-900 shadow-sm">
                                    <SelectValue placeholder="Expiry Date" />
                                </SelectTrigger>
                                <SelectContent className="bg-white border-slate-100 rounded-2xl">
                                    {expiries.map(exp => (
                                        <SelectItem key={exp} value={exp} className="text-[10px] font-bold">{exp}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </header>

                <div className="relative">
                    <Card className="bg-white rounded-[2.5rem] md:rounded-[3rem] border-none overflow-hidden shadow-xl pb-10">
                        <div className="grid grid-cols-11 border-b border-slate-50 bg-slate-50/50">
                            <div className="col-span-5 text-center py-4 border-r border-slate-100">
                                <span className="text-[10px] font-bold text-[#5D2D91]">Call Options (CE)</span>
                            </div>
                            <div className="col-span-1 text-center py-4 flex items-center justify-center">
                                <Target className="h-4 w-4 text-slate-300" />
                            </div>
                            <div className="col-span-5 text-center py-4 border-l border-slate-100">
                                <span className="text-[10px] font-bold text-amber-600">Put Options (PE)</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-11 bg-white">
                            <div className="col-span-5 grid grid-cols-2 text-center py-3 border-r border-slate-50">
                                <span className="text-[9px] font-bold text-slate-400">Chg%</span>
                                <span className="text-[9px] font-bold text-slate-400">Ltp</span>
                            </div>
                            <div className="col-span-1 text-center py-3">
                                <span className="text-[9px] font-bold text-slate-900">Strike</span>
                            </div>
                            <div className="col-span-5 grid grid-cols-2 text-center py-3 border-l border-slate-50">
                                <span className="text-[9px] font-bold text-slate-400">Ltp</span>
                                <span className="text-[9px] font-bold text-slate-400">Chg%</span>
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="py-40 flex flex-col items-center justify-center gap-4">
                                <Loader2 className="h-10 w-10 animate-spin text-[#5D2D91] opacity-20" />
                                <p className="text-[10px] font-bold text-slate-400">Initializing Terminal...</p>
                            </div>
                        ) : (
                            <div className="max-h-[60vh] overflow-y-auto no-scrollbar scroll-smooth">
                                {focusedChain.map((row: any) => {
                                    const isATM = row.strike === atmStrike;
                                    const ceKey = `${row.ce?.exchange?.toUpperCase()}:${row.ce?.tradingsymbol?.toUpperCase()}`;
                                    const peKey = `${row.pe?.exchange?.toUpperCase()}:${row.pe?.tradingsymbol?.toUpperCase()}`;
                                    const ceData = prices[ceKey] || initialPrices[ceKey];
                                    const cePrice = ceData?.price || 0;
                                    const ceChange = ceData?.change || 0;
                                    const cePct = cePrice > 0 ? (ceChange / (cePrice - ceChange)) * 100 : 0;
                                    const peData = prices[peKey] || initialPrices[peKey];
                                    const pePrice = peData?.price || 0;
                                    const peChange = peData?.change || 0;
                                    const pePct = pePrice > 0 ? (peChange / (pePrice - peChange)) * 100 : 0;

                                    return (
                                        <div key={row.strike} className={cn(
                                            "grid grid-cols-11 border-b border-slate-50 hover:bg-slate-50 transition-all group",
                                            isATM && "bg-[#5D2D91]/5 border-y border-[#5D2D91]/10 z-10"
                                        )}>
                                            <div className="col-span-5 grid grid-cols-2 h-14 md:h-16 border-r border-slate-50">
                                                <div className="flex items-center justify-center">
                                                    <span className={cn("text-[10px] font-bold", ceChange >= 0 ? "text-emerald-500" : "text-rose-500")}>
                                                        {cePrice > 0 ? (ceChange >= 0 ? '+' : '') + cePct.toFixed(2) + '%' : '--'}
                                                    </span>
                                                </div>
                                                <button onClick={() => handleTrade(row.ce)} className="flex items-center justify-center font-black text-slate-900 text-sm md:text-base hover:text-[#5D2D91] transition-colors h-full">
                                                    {cePrice > 0 ? cePrice.toFixed(2) : '--'}
                                                </button>
                                            </div>
                                            <div className={cn("col-span-1 flex items-center justify-center h-14 md:h-16 relative overflow-hidden", isATM ? "bg-[#5D2D91]/10" : "bg-slate-50/30")}>
                                                <span className={cn("text-[10px] md:text-sm font-black relative z-10", isATM ? "text-[#5D2D91]" : "text-slate-400")}>
                                                    {row.strike}
                                                </span>
                                            </div>
                                            <div className="col-span-5 grid grid-cols-2 h-14 md:h-16 border-l border-slate-50">
                                                <button onClick={() => handleTrade(row.pe)} className="flex items-center justify-center font-black text-slate-900 text-sm md:text-base hover:text-amber-500 transition-colors h-full">
                                                    {pePrice > 0 ? pePrice.toFixed(2) : '--'}
                                                </button>
                                                <div className="flex items-center justify-center">
                                                    <span className={cn("text-[10px] font-bold", peChange >= 0 ? "text-emerald-500" : "text-rose-500")}>
                                                        {pePrice > 0 ? (peChange >= 0 ? '+' : '') + pePct.toFixed(2) + '%' : '--'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}

export default function OptionChainPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-[#5D2D91]" /></div>}>
            <OptionChainContent />
        </Suspense>
    );
}