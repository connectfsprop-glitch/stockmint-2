'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { 
    Search, 
    Plus, 
    Loader2, 
    TrendingUp, 
    TrendingDown, 
    X,
    Star,
    Zap,
    Search as SearchIcon,
    LineChart
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserProfile } from '@/hooks/use-user-profile';
import { AppLayout } from '@/components/app-layout';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useWebSocketData } from '@/context/websocket-context';
import { getInstrumentsForSearch } from '@/app/actions/search-instruments';
import { formatSimpleInstrumentName } from '@/lib/format-instrument';
import { InstrumentActionSheet } from '@/components/instrument-action-sheet';
import { getMultipleStockPrices } from '@/app/actions/get-stock-price';
import { getMarketMovers } from '@/app/actions/get-market-movers';
import { useSearchParams } from 'next/navigation';

/**
 * @fileOverview PREMIUM WATCHLIST TERMINAL v2.5
 * Market-Aware: Syncs default items and search context based on trader marketType.
 * Enhanced: Supports Gainer/Loser filtered views.
 */

interface WatchlistItem {
    symbol: string;
    exchange: string;
    name?: string;
    instrument_type?: string;
}

const DEFAULT_INDIAN_WATCHLIST: WatchlistItem[] = [
    { symbol: 'NIFTY 50', exchange: 'NSE', name: 'Nifty 50' },
    { symbol: 'NIFTY BANK', exchange: 'NSE', name: 'Nifty Bank' },
    { symbol: 'SENSEX', exchange: 'BSE', name: 'Sensex' },
    { symbol: 'RELIANCE', exchange: 'NSE', name: 'Reliance Industries' },
];

const DEFAULT_FOREX_WATCHLIST: WatchlistItem[] = [
    { symbol: 'EUR/USD', exchange: 'FOREX', name: 'EUR/USD' },
    { symbol: 'BTC/USD', exchange: 'FOREX', name: 'Bitcoin' },
    { symbol: 'XAU/USD', exchange: 'FOREX', name: 'Gold' },
    { symbol: 'DJI', exchange: 'FOREX', name: 'Dow Jones' },
];

function WatchlistContent() {
    const { profile } = useUserProfile();
    const { prices, subscribe } = useWebSocketData();
    const searchParams = useSearchParams();
    const filter = searchParams.get('filter'); // 'gainers' | 'losers' | null

    const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [initialPrices, setInitialPrices] = useState<Record<string, any>>({});
    const [isMoversLoading, setIsMoversLoading] = useState(false);
    
    const [selectedInstrument, setSelectedInstrument] = useState<any>(null);
    const [isOrderPanelOpen, setIsOrderPanelOpen] = useState(false);

    const isForexUser = profile?.market_type === 'forex';
    const marketType = profile?.market_type || 'indian';

    // 1. Load Mover Data if filtered
    const fetchMovers = async () => {
        setIsMoversLoading(true);
        const res = await getMarketMovers(profile?.market_type || 'indian');
        if (res.success) {
            const list = filter === 'gainers' ? res.gainers : res.losers;
            const mapped = list.map(item => ({
                symbol: item.symbol,
                exchange: item.exchange,
                name: item.symbol,
                instrument_type: marketType === 'indian' ? 'Equity' : 'Forex'
            }));
            setWatchlist(mapped as any);
        }
        setIsMoversLoading(false);
    };

    // 2. Initial Load & Persistence
    useEffect(() => {
        if (filter) {
            fetchMovers();
            return;
        }

        const saved = localStorage.getItem(`user_watchlist_${profile?.id}`);
        if (saved) {
            try {
                setWatchlist(JSON.parse(saved));
            } catch (e) {
                setWatchlist(isForexUser ? DEFAULT_FOREX_WATCHLIST : DEFAULT_INDIAN_WATCHLIST);
            }
        } else {
            setWatchlist(isForexUser ? DEFAULT_FOREX_WATCHLIST : DEFAULT_INDIAN_WATCHLIST);
        }
    }, [profile?.id, isForexUser, filter]);

    useEffect(() => {
        if (!filter && profile?.id) {
            localStorage.setItem(`user_watchlist_${profile.id}`, JSON.stringify(watchlist));
        }
        
        if (watchlist.length > 0) {
            const instruments = watchlist.map(i => ({ symbol: i.symbol, exchange: i.exchange }));
            subscribe(instruments);
            
            const bootstrap = async () => {
                const res = await getMultipleStockPrices(instruments);
                if (res.success) {
                    setInitialPrices(res.data);
                }
            };
            bootstrap();
        }
    }, [watchlist, subscribe, profile?.id, filter]);

    // 3. Search Logic
    const handleSearch = async (val: string) => {
        setSearchQuery(val);
        if (!val.trim()) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const res = await getInstrumentsForSearch(val, profile?.market_type || 'indian');
            if (res.success) {
                setSearchResults(res.data);
            }
        } catch (e) {
            console.error("Search error", e);
        } finally {
            setIsSearching(false);
        }
    };

    const addToWatchlist = (inst: any) => {
        const item: WatchlistItem = {
            symbol: inst.tradingsymbol,
            exchange: inst.exchange,
            name: inst.name,
            instrument_type: inst.instrument_type
        };
        
        if (!watchlist.some(i => i.symbol === item.symbol && i.exchange === item.exchange)) {
            setWatchlist(prev => [item, ...prev]);
        }
        setSearchQuery('');
        setSearchResults([]);
    };

    const removeFromWatchlist = (e: React.MouseEvent, symbol: string) => {
        e.stopPropagation();
        setWatchlist(prev => prev.filter(i => i.symbol !== symbol));
    };

    const handleOpenOrder = (item: WatchlistItem) => {
        const key = `${item.exchange.toUpperCase()}:${item.symbol.toUpperCase()}`;
        const livePrice = prices[key]?.price || initialPrices[key]?.price || 0;
        
        setSelectedInstrument({
            tradingsymbol: item.symbol,
            exchange: item.exchange,
            instrument_type: item.instrument_type || 'Equity',
            price: livePrice
        });
        setIsOrderPanelOpen(true);
    };

    const pageTitle = useMemo(() => {
        if (filter === 'gainers') return 'Top Gainers';
        if (filter === 'losers') return 'Top Losers';
        return 'Watchlist';
    }, [filter]);

    return (
        <AppLayout>
            <InstrumentActionSheet 
                instrument={selectedInstrument} 
                isOpen={isOrderPanelOpen} 
                onOpenChange={setIsOrderPanelOpen} 
            />

            <div className="animate-in fade-in duration-1000 slide-in-from-bottom-4">
                {/* HERO SECTION */}
                <div className="relative -mt-4 mb-14 px-1">
                    <div className="space-y-1 pb-16">
                        <div className="flex items-center gap-3">
                            <h1 className="font-headline text-4xl md:text-5xl font-black tracking-tight text-white">{pageTitle}</h1>
                            <Badge className="bg-amber-400 text-black font-black text-[9px] px-3 py-1 rounded-full uppercase tracking-widest mt-2">
                                {filter ? 'Market' : 'Live'}
                            </Badge>
                        </div>
                    </div>

                    {!filter && (
                        <div className="absolute -bottom-8 left-0 right-0 z-30">
                            <div className="relative group">
                                <div className="absolute inset-0 bg-white/40 blur-2xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
                                <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-[#5D2D91] transition-colors z-40" />
                                <Input
                                    placeholder={isForexUser ? "Search Forex & Crypto..." : "Search Indian Stocks & Options..."}
                                    className="bg-white border-none pl-14 h-16 rounded-[1.5rem] text-sm md:text-base font-semibold focus:ring-0 transition-all placeholder:text-slate-300 shadow-xl relative z-30"
                                    value={searchQuery}
                                    onChange={(e) => handleSearch(e.target.value)}
                                />
                                {isSearching && <Loader2 className="absolute right-6 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-[#5D2D91] z-40" />}
                            </div>

                            {searchResults.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden z-50">
                                    <div className="max-h-[300px] overflow-y-auto no-scrollbar">
                                        {searchResults.map((res, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => addToWatchlist(res)}
                                                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 border-b border-slate-50 last:border-none transition-colors group"
                                            >
                                                <div className="text-left">
                                                    <p className="font-bold text-slate-800 text-sm">{formatSimpleInstrumentName({ tradingsymbol: res.tradingsymbol })}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase">{res.exchange} • {res.instrument_type}</p>
                                                </div>
                                                <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-[#5D2D91] group-hover:text-white transition-all">
                                                    <Plus className="h-4 w-4" />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* WATCHLIST CONTENT */}
                <div className="space-y-3 pt-4">
                    {isMoversLoading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="h-24 rounded-[2rem] bg-white shadow-sm" />
                        ))
                    ) : watchlist.length === 0 ? (
                        <div className="py-24 text-center bg-white/50 rounded-[2.5rem] border-dashed border-slate-200">
                            <Star className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                            <p className="text-slate-900 font-bold text-lg font-headline">{filter ? 'No movers detected' : 'Watchlist is empty'}</p>
                            <p className="text-xs text-slate-400 mt-1">{filter ? 'Syncing market pulse...' : 'Start scanning to add assets'}</p>
                        </div>
                    ) : (
                        <div className="grid gap-3 pb-24">
                            {watchlist.map((item) => {
                                const key = `${item.exchange.toUpperCase()}:${item.symbol.toUpperCase()}`;
                                const liveData = prices[key] || initialPrices[key];
                                const price = liveData?.price || 0;
                                const change = liveData?.change || 0;
                                const isPositive = change >= 0;

                                return (
                                    <div 
                                        key={item.symbol} 
                                        onClick={() => handleOpenOrder(item)}
                                        className="bg-white rounded-[1.5rem] shadow-sm overflow-hidden flex relative border-none group hover:shadow-md transition-all active:scale-[0.99] cursor-pointer"
                                    >
                                        <div className={cn(
                                            "w-1.5 h-full absolute left-0 top-0 transition-colors duration-500",
                                            isPositive ? "bg-[#00C853]" : "bg-[#D32F2F]"
                                        )} />
                                        
                                        <div className="pl-5 pr-6 py-4 flex items-center justify-between gap-4 flex-1">
                                            <div>
                                                <h3 className="font-bold text-sm text-slate-800 tracking-tight font-headline">
                                                    {formatSimpleInstrumentName({ tradingsymbol: item.symbol })}
                                                </h3>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                                                    {item.exchange}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-6">
                                                <div className="text-right">
                                                    <p className={cn(
                                                        "text-sm font-black tracking-tighter font-headline",
                                                        isPositive ? "text-[#00C853]" : "text-[#D32F2F]"
                                                    )}>
                                                        {price > 0 ? (isForexUser ? price.toFixed(5) : price.toFixed(2)) : '--'}
                                                    </p>
                                                    <div className={cn("flex items-center justify-end gap-1 text-[9px] font-bold", isPositive ? "text-emerald-500" : "text-rose-500")}>
                                                        {isPositive ? <TrendingUp className="h-2 w-2" /> : <TrendingDown className="h-2 w-2" />}
                                                        {change.toFixed(2)}
                                                    </div>
                                                </div>

                                                {!filter && (
                                                    <button 
                                                        onClick={(e) => removeFromWatchlist(e, item.symbol)}
                                                        className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}

export default function WatchlistPage() {
    return (
        <Suspense fallback={<div className="p-20 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto opacity-20" /></div>}>
            <WatchlistContent />
        </Suspense>
    );
}
