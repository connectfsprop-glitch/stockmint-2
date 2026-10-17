'use client';

import {
  ChevronRight,
  Zap,
  LineChart,
  TrendingUp,
  ListFilter,
  ArrowRight,
  Clock,
  Globe,
  Coins,
  BarChart4,
  Briefcase
} from 'lucide-react';
import { useUserProfile } from '@/hooks/use-user-profile';
import { AppLayout } from '@/components/app-layout';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { MarketIndices } from '@/components/market-indices';
import { getInstruments, getNearestExpiry } from '@/app/actions/search-instruments';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { useWebSocketData } from '@/context/websocket-context';
import { InstrumentActionSheet } from '@/components/instrument-action-sheet';
import { FOREX_INSTRUMENTS } from '@/lib/forex-config';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { getMultipleStockPrices } from '@/app/actions/get-stock-price';
import { formatSimpleInstrumentName } from '@/lib/format-instrument';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * @fileOverview Main Dashboard
 * High-performance trading view with simplified language.
 */

interface Position {
    id: number;
    tradingsymbol: string;
    exchange: string;
    instrument_type: string;
    quantity: number; 
    average_price: number;
}

function DashboardPageContent() {
    const { profile, user } = useUserProfile(['student', 'admin', 'mentor']);
    const { prices, subscribe } = useWebSocketData();
    
    const [allInstruments, setAllInstruments] = useState<any[]>([]);
    const [selectedInstrument, setSelectedInstrument] = useState<any>(null);
    const [isOrderPanelOpen, setIsOrderPanelOpen] = useState(false);
    
    const [positions, setPositions] = useState<Position[]>([]);
    const [isPositionsLoading, setIsPositionsLoading] = useState(true);
    const [initialPrices, setInitialPrices] = useState<Record<string, number>>({});
    const [isExit, setIsExit] = useState(false);
    const [exitQuantity, setExitQuantity] = useState(1);
    const [positionId, setPositionId] = useState<number | undefined>(undefined);

    const isForex = profile?.market_type === 'forex';
    const currencySymbol = isForex ? '$' : '₹';

    const formatCurrency = (value: number | null | undefined, placeholder = '0.00', showSign = false) => {
        if (value === null || typeof value === 'undefined' || isNaN(value)) return placeholder;
        const formatted = new Intl.NumberFormat('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(Math.abs(value));
        if (showSign) return value >= 0 ? `+${formatted}` : `-${formatted}`;
        return formatted;
    };

    useEffect(() => {
        async function loadData() {
            if (!isForex) {
                const instRes = await getInstruments();
                if (instRes.success) setAllInstruments(instRes.data);
                subscribe([{ symbol: 'NIFTY 50', exchange: 'NSE' }]);
            } else {
                subscribe([
                    { symbol: 'EUR/USD', exchange: 'FOREX' },
                    { symbol: 'GBP/USD', exchange: 'FOREX' },
                    { symbol: 'USD/JPY', exchange: 'FOREX' },
                    { symbol: 'XAU/USD', exchange: 'FOREX' }
                ]);
            }
        }
        loadData();
    }, [subscribe, isForex]);

    const fetchPositions = useCallback(async (isSilent = false) => {
        if (!user) return;
        if (!isSilent) setIsPositionsLoading(true);
        const { data, error } = await supabase.from('positions').select('id, symbol, exchange, instrument_type, quantity, average_price').eq('user_id', user.id);
        if (error) {
            setPositions([]);
        } else {
            const mapped = (data || []).map(p => ({ ...p, tradingsymbol: p.symbol }));
            setPositions(mapped);
            if (mapped.length > 0) {
                const instruments = mapped.map(p => ({ symbol: p.tradingsymbol, exchange: p.exchange }));
                const res = await getMultipleStockPrices(instruments);
                if (res.success) {
                    const priceMap: Record<string, number> = {};
                    Object.keys(res.data).forEach(key => { priceMap[key.toUpperCase()] = res.data[key].price; });
                    setInitialPrices(priceMap);
                }
            }
        }
        setIsPositionsLoading(false);
    }, [user]);

    useEffect(() => {
        fetchPositions();
        const interval = setInterval(() => fetchPositions(true), 5000);
        return () => clearInterval(interval);
    }, [fetchPositions]);

    const instrumentsToSubscribe = useMemo(() => positions.map(item => ({ symbol: item.tradingsymbol, exchange: item.exchange })), [positions]);
    useEffect(() => { if (instrumentsToSubscribe.length > 0) subscribe(instrumentsToSubscribe); }, [instrumentsToSubscribe, subscribe]);

    const getLTP = (pos: Position) => {
        const key = `${pos.exchange.toUpperCase()}:${pos.tradingsymbol.toUpperCase()}`;
        return prices[key]?.price || initialPrices[key] || pos.average_price;
    };

    const handleActionSelect = (instrument: any) => {
        setSelectedInstrument(instrument);
        setIsExit(false);
        setIsOrderPanelOpen(true);
    };

    const handleExitSelect = (instrument: any, exit: boolean, quantity: number, posId: number) => {
        setSelectedInstrument(instrument);
        setIsExit(exit);
        setExitQuantity(quantity);
        setPositionId(posId);
        setIsOrderPanelOpen(true);
    };

    const niftyPrice = prices['NSE:NIFTY 50']?.price || 0;
    const niftyChange = prices['NSE:NIFTY 50']?.change || 0;
    const isNiftyPositive = niftyChange >= 0;

    const eurusdPrice = prices['FOREX:EUR/USD']?.price || 0;

    return (
        <AppLayout>
            <InstrumentActionSheet 
                instrument={selectedInstrument} 
                isOpen={isOrderPanelOpen} 
                onOpenChange={setIsOrderPanelOpen} 
                isExit={isExit}
                exitQuantity={exitQuantity}
                positionId={positionId}
            />

            <div className="flex flex-col gap-6 animate-in fade-in duration-700 slide-in-from-bottom-4">
                
                {/* 1. HERO CARD */}
                {isForex ? (
                     <Card className="rounded-[1.5rem] border-none shadow-sm overflow-hidden bg-white active:scale-[0.98] transition-transform">
                        <CardContent className="p-0">
                            <div className="flex items-center justify-between p-5">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                        <Globe className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-gray-400 font-headline">EUR / USD Spot</p>
                                        <p className="text-2xl font-black text-gray-900 font-headline">
                                            {eurusdPrice > 0 ? eurusdPrice.toFixed(5) : '---'}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <Badge className="bg-emerald-500 text-white text-[9px] font-bold border-none px-2 py-0.5 rounded-md font-headline">Live price</Badge>
                                    <p className="text-[10px] font-bold text-gray-300 mt-1 font-headline">Real-time feed</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <Link href="/option-chain?index=NIFTY">
                        <Card className="rounded-[1.5rem] border-none shadow-sm overflow-hidden bg-white active:scale-[0.98] transition-transform">
                            <CardContent className="p-0">
                                <div className="flex items-center justify-between p-4 px-5">
                                    <div className="flex items-center gap-3">
                                        <div>
                                            <p className="text-[11px] font-bold text-gray-400 font-headline">Nifty 50 Index</p>
                                            <div className="flex items-baseline gap-2">
                                                <p className="text-xl font-black text-gray-900 font-headline">
                                                    {niftyPrice > 0 ? niftyPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '24,250.00'}
                                                </p>
                                                <span className={`text-[11px] font-bold font-headline ${isNiftyPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                    {niftyChange > 0 ? '+' : ''}{niftyChange.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <Badge className="bg-amber-100 text-amber-700 text-[9px] font-bold border-none px-2 py-0.5 rounded-md font-headline">Live stream</Badge>
                                        <div className="flex items-center gap-1 text-[10px] font-bold text-primary group font-headline">
                                            Open option chain <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                )}

                {/* 2. Index / Pairs Row */}
                {isForex ? (
                    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 px-1">
                        {['EUR/USD', 'GBP/USD', 'USD/JPY', 'XAU/USD'].map((sym) => {
                            const priceData = prices[`FOREX:${sym.toUpperCase()}`];
                            const price = priceData?.price || 0;
                            return (
                                <Card 
                                    key={sym}
                                    onClick={() => {
                                        const inst = FOREX_INSTRUMENTS.find(i => i.symbol === sym);
                                        if (inst) {
                                            handleActionSelect({
                                                ...inst,
                                                tradingsymbol: inst.symbol,
                                                exchange: 'FOREX',
                                                instrument_type: inst.category.toUpperCase(),
                                                lot_size: inst.lotSize
                                            });
                                        }
                                    }}
                                    className="min-w-[160px] flex-1 rounded-[1.5rem] border-none shadow-sm overflow-hidden bg-white active:scale-95 transition-all cursor-pointer"
                                >
                                    <CardContent className="p-4 flex flex-col justify-between h-full gap-2">
                                        <p className="text-[11px] font-bold text-gray-400 font-headline">{sym}</p>
                                        <p className="text-base font-black text-gray-900 font-headline">
                                            {price > 0 ? price.toFixed(sym.includes('JPY') || sym.includes('XAU') ? 2 : 5) : '---'}
                                        </p>
                                        <div className="flex items-center gap-1">
                                            <Badge variant="outline" className="text-[9px] border-emerald-100 text-emerald-600 px-1.5 py-0 bg-emerald-50 font-headline">Price</Badge>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                ) : (
                    <div className="w-full">
                      <MarketIndices onSelect={handleActionSelect} allInstruments={allInstruments} />
                    </div>
                )}

                {/* 3. Discovery Grid */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-600 ml-1 font-headline">Explore markets</h3>
                  <Card className="rounded-[2rem] border-none shadow-sm overflow-hidden bg-white">
                    <CardContent className="p-0">
                      <div className="grid grid-cols-2 divide-x divide-y divide-gray-50">
                        {isForex ? (
                            <>
                                <Link href="/watchlist">
                                  <DiscoveryItem icon={<Globe className="text-blue-500" />} title="Major pairs" sub="Forex market" />
                                </Link>
                                <Link href="/watchlist">
                                  <DiscoveryItem icon={<Coins className="text-amber-500" />} title="Crypto pulse" sub="Top assets" />
                                </Link>
                                <Link href="/watchlist">
                                  <DiscoveryItem icon={<BarChart4 className="text-emerald-500" />} title="Global indices" sub="World markets" />
                                </Link>
                                <Link href="/watchlist">
                                  <DiscoveryItem icon={<Zap className="text-orange-500" />} title="Commodities" sub="Gold & metals" />
                                </Link>
                            </>
                        ) : (
                            <>
                                <Link href="/option-chain?index=NIFTY">
                                  <DiscoveryItem icon={<ListFilter className="text-amber-500" />} title="Nifty 50" sub="Option chain" />
                                </Link>
                                <Link href="/option-chain?index=BANKNIFTY">
                                  <DiscoveryItem icon={<ListFilter className="text-indigo-500" />} title="Bank Nifty" sub="Option chain" />
                                </Link>
                                <Link href="/watchlist?filter=gainers">
                                  <DiscoveryItem icon={<LineChart className="text-green-600" />} title="Top gainers" sub="Going up" />
                                </Link>
                                <Link href="/watchlist?filter=losers">
                                  <DiscoveryItem icon={<TrendingUp className="text-rose-500" />} title="Top losers" sub="Going down" />
                                </Link>
                            </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* 4. Open Positions Section */}
                <div className="flex items-center justify-between mt-2 px-1">
                  <h3 className="text-sm font-bold text-gray-600 font-headline">Current positions</h3>
                  <Link href="/portfolio" className="text-[11px] font-bold text-primary font-headline">View all</Link>
                </div>
                
                <div className="space-y-3 pb-24">
                    {isPositionsLoading && positions.length === 0 ? (
                        [1,2].map(i => <Skeleton key={i} className="h-28 w-full rounded-2xl bg-white" />)
                    ) : positions.length === 0 ? (
                        <Card className="rounded-[1.5rem] border-none shadow-sm bg-white p-12 flex flex-col items-center justify-center gap-3 active:scale-[0.98] transition-transform">
                            <Zap className="h-8 w-8 text-gray-100" />
                            <p className="text-[11px] font-bold text-gray-400 font-headline">No active positions</p>
                        </Card>
                    ) : (
                        positions.slice(0, 5).map((pos) => {
                            const ltp = getLTP(pos);
                            const pnl = (ltp - pos.average_price) * pos.quantity;
                            const isLong = pos.quantity > 0;
                            
                            return (
                                <div key={pos.id} className="bg-white rounded-[1.5rem] shadow-sm overflow-hidden flex relative group active:scale-[0.99] transition-all cursor-pointer border-none" 
                                    onClick={() => handleExitSelect({ id: pos.id, symbol: pos.tradingsymbol, exchange: pos.exchange, instrument_type: pos.instrument_type, price: ltp }, true, Math.abs(pos.quantity), pos.id)}>
                                    
                                    <div className={cn(
                                        "w-1.5 h-full absolute left-0 top-0",
                                        isLong ? "bg-emerald-500" : "bg-rose-500"
                                    )} />

                                    <div className="flex-1 p-5 pl-7 flex flex-col gap-3">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="text-sm font-bold text-gray-800 font-headline tracking-tight">{formatSimpleInstrumentName(pos)}</h3>
                                                <p className="text-[9px] font-bold text-gray-300 mt-0.5 font-headline">{pos.exchange}</p>
                                            </div>
                                            <p className={cn("text-base font-black tracking-tighter font-headline", pnl >= 0 ? "text-[#00C853]" : "text-[#D32F2F]")}>
                                                {currencySymbol}{formatCurrency(pnl, '0.00', true)}
                                            </p>
                                        </div>

                                        <div className="flex justify-between items-end">
                                            <div className="flex items-center gap-3">
                                                <Badge className={cn(
                                                    "h-6 px-3 rounded-lg text-[10px] font-bold border-none text-white font-headline",
                                                    isLong ? "bg-[#00C853]" : "bg-[#D32F2F]"
                                                )}>
                                                    {isLong ? 'Long' : 'Short'}
                                                </Badge>
                                                <div className="space-y-0.5">
                                                    <p className="text-[9px] font-bold text-gray-400 font-headline">Amount</p>
                                                    <p className="text-[11px] font-bold text-gray-700 font-headline">{Math.abs(pos.quantity).toLocaleString()} units</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[9px] font-bold text-gray-400 font-headline">Live price</p>
                                                <p className="text-sm font-black text-gray-900 tracking-tighter font-headline">{ltp.toFixed(isForex ? 5 : 2)}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </AppLayout>
    );
}

function DiscoveryItem({ icon, title, sub }: any) {
  return (
    <div className="p-5 hover:bg-gray-50 transition-colors cursor-pointer group h-full">
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-xl bg-gray-50 flex items-center justify-center transition-colors group-hover:bg-white shadow-sm">
          {icon}
        </div>
        <div>
          <p className="text-[12px] font-bold text-gray-800 font-headline tracking-tight">{title}</p>
          <p className="text-[10px] font-medium text-gray-400 mt-0.5 leading-tight font-headline">{sub}</p>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return <DashboardPageContent />;
}
