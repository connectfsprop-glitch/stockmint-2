
'use client';

import {
  Briefcase,
  TrendingUp,
  History as HistoryIcon,
  ShieldCheck,
  Zap,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserProfile } from '@/hooks/use-user-profile';
import { AppLayout } from '@/components/app-layout';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { formatSimpleInstrumentName } from '@/lib/format-instrument';
import { Skeleton } from '@/components/ui/skeleton';
import { InstrumentActionSheet } from '@/components/instrument-action-sheet';
import { Card, CardContent } from '@/components/ui/card';
import { useWebSocketData } from '@/context/websocket-context';
import { getMultipleStockPrices } from '@/app/actions/get-stock-price';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * @fileOverview Institutional Portfolio Terminal v3.1
 * Unified Detail: Closed positions now show comprehensive Entry/Exit and Settlement Mode.
 */

interface Position {
    id: number;
    tradingsymbol: string;
    exchange: string;
    instrument_type: string;
    quantity: number; 
    average_price: number;
}

interface Order {
    id: number;
    created_at: string;
    symbol: string;
    exchange: string;
    order_type: 'BUY' | 'SELL';
    quantity: number;
    price: number; 
    status: string;
    pnl: number | null;
    breach_reason: string | null;
}

function OpenPositions({ onExit }: { onExit: (instrument: any, isExit: boolean, quantity: number, positionId: number) => void }) {
    const { user, profile } = useUserProfile(['student', 'admin', 'mentor']);
    const [positions, setPositions] = useState<Position[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [initialPrices, setInitialPrices] = useState<Record<string, number>>({});
    const { prices, subscribe } = useWebSocketData();
    
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

    const fetchPositions = useCallback(async (isSilent = false) => {
        if (!user) return;
        if (!isSilent) setIsLoading(true);
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
        setIsLoading(false);
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

    const totalPnl = positions.reduce((acc, pos) => {
        const ltp = getLTP(pos);
        return acc + ((ltp - pos.average_price) * pos.quantity);
    }, 0);

    return (
        <div className="flex flex-col gap-6">
            <Card className="rounded-[1.5rem] border-none shadow-sm overflow-hidden bg-white">
                <CardContent className="p-0">
                    <div className="grid grid-cols-2 p-5 border-b border-gray-50">
                        <div className="space-y-1 border-r border-gray-50">
                            <p className="text-[10px] font-bold text-gray-400 font-headline">Invested capital</p>
                            <p className="text-xl font-bold text-gray-800 tracking-tight font-headline">{currencySymbol}{formatCurrency(positions.reduce((acc, p) => acc + (p.average_price * Math.abs(p.quantity)), 0))}</p>
                        </div>
                        <div className="space-y-1 pl-5">
                            <p className="text-[10px] font-bold text-gray-400 font-headline">Total PnL</p>
                            <p className={cn("text-xl font-bold tracking-tight font-headline", totalPnl >= 0 ? "text-[#00C853]" : "text-[#D32F2F]")}>
                                {currencySymbol}{formatCurrency(totalPnl, '0.00', true)}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex items-center justify-between px-1">
                <h3 className="text-[10px] font-bold text-gray-400 font-headline">{positions.length} Active positions</h3>
            </div>

            <div className="space-y-3 pb-24">
                {isLoading && positions.length === 0 ? (
                    [1,2].map(i => <Skeleton key={i} className="h-28 w-full rounded-2xl bg-white" />)
                ) : positions.length === 0 ? (
                    <div className="py-20 text-center bg-white rounded-[2rem] border-dashed border-gray-200">
                        <Briefcase className="h-8 w-8 mx-auto mb-3 text-gray-100" />
                        <p className="text-[10px] font-bold text-gray-300 font-headline">Terminal standby</p>
                    </div>
                ) : (
                    positions.map((pos) => {
                        const ltp = getLTP(pos);
                        const pnl = (ltp - pos.average_price) * pos.quantity;
                        const isLong = pos.quantity > 0;
                        
                        return (
                            <div key={pos.id} className="bg-white rounded-[1.5rem] shadow-sm overflow-hidden flex relative group active:scale-[0.99] transition-all cursor-pointer border-none" 
                                 onClick={() => onExit({ id: pos.id, symbol: pos.tradingsymbol, exchange: pos.exchange, instrument_type: pos.instrument_type, price: ltp }, true, Math.abs(pos.quantity), pos.id)}>
                                
                                <div className={cn(
                                    "w-1.5 h-full absolute left-0 top-0",
                                    isLong ? "bg-emerald-500" : "bg-rose-500"
                                )} />

                                <div className="flex-1 p-5 pl-7 flex flex-col gap-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-800 font-headline tracking-tight">{formatSimpleInstrumentName(pos)}</h3>
                                            <p className="text-[8px] font-black text-gray-300 tracking-widest mt-0.5 font-headline">{pos.exchange}</p>
                                        </div>
                                        <p className={cn("text-base font-black tracking-tighter font-headline", pnl >= 0 ? "text-[#00C853]" : "text-[#D32F2F]")}>
                                            {currencySymbol}{formatCurrency(pnl, '0.00', true)}
                                        </p>
                                    </div>

                                    <div className="flex justify-between items-end">
                                        <div className="flex items-center gap-3">
                                            <Badge className={cn(
                                                "h-6 px-3 rounded-lg text-[9px] font-black border-none text-white font-headline",
                                                isLong ? "bg-[#00C853]" : "bg-[#D32F2F]"
                                            )}>
                                                {isLong ? 'Long' : 'Short'}
                                            </Badge>
                                            <div className="space-y-0.5">
                                                <p className="text-[8px] font-bold text-gray-400 font-headline">Exposure</p>
                                                <p className="text-[10px] font-bold text-gray-700 font-headline">{Math.abs(pos.quantity).toLocaleString()} units</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[8px] font-bold text-gray-400 font-headline">Pulse price</p>
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
    );
}

function ClosedPositions() {
    const { user, profile } = useUserProfile(['student', 'admin', 'mentor']);
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
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

    const fetchOrders = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'COMPLETED')
            .not('pnl', 'is', null)
            .order('created_at', { ascending: false });
        if (error) console.error(error);
        else setOrders(data || []);
        setIsLoading(false);
    }, [user]);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    const calculateEntryPrice = (item: Order) => {
        if (item.pnl === null || !item.quantity) return 0;
        const exitPrice = item.price;
        return item.order_type === 'SELL' 
            ? exitPrice - (item.pnl / item.quantity)
            : exitPrice + (item.pnl / item.quantity);
    };

    const getSettlementBadge = (order: Order) => {
        const isAuto = order.breach_reason?.includes('System');
        const label = isAuto ? (order.breach_reason?.includes('TP') ? 'TP Hit' : 'SL Hit') : 'Manual';
        
        return (
            <Badge variant="outline" className={cn(
                "text-[8px] font-black border-none px-2 rounded-md h-5 uppercase tracking-tighter",
                isAuto ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"
            )}>
                {isAuto ? <Zap className="h-2 w-2 mr-1 fill-amber-600" /> : <User className="h-2 w-2 mr-1" />}
                {label}
            </Badge>
        );
    };
    
    if (isLoading) return <div className="space-y-4">{[1,2].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl bg-white" />)}</div>;

    return (
        <div className="space-y-3 pb-20">
            {orders.length === 0 ? (
                <div className="py-20 text-center bg-white rounded-[2rem] border-dashed border-gray-200">
                    <TrendingUp className="h-8 w-8 mx-auto mb-3 text-gray-100" />
                    <p className="text-[10px] font-bold text-gray-300 font-headline">History clear</p>
                </div>
            ) : (
                orders.map(order => {
                    const entryPrice = calculateEntryPrice(order);
                    const exitPrice = order.price;
                    const pnl = order.pnl ?? 0;

                    return (
                        <div key={order.id} className="bg-white rounded-[1.5rem] shadow-sm p-5 relative overflow-hidden border-none group hover:shadow-md transition-shadow">
                            <div className={cn(
                                "w-1.5 h-full absolute left-0 top-0",
                                pnl >= 0 ? "bg-emerald-500" : "bg-rose-500"
                            )} />

                            <div className="flex justify-between items-start mb-4 pl-3">
                                <div className="space-y-1">
                                    <h3 className="text-sm font-bold text-gray-800 font-headline tracking-tight">{formatSimpleInstrumentName({ tradingsymbol: order.symbol })}</h3>
                                    {getSettlementBadge(order)}
                                </div>
                                <div className="text-right">
                                    <p className={cn("text-base font-black tracking-tighter font-headline", pnl >= 0 ? "text-[#00C853]" : "text-[#D32F2F]")}>
                                        {currencySymbol}{formatCurrency(pnl, '0.00', true)}
                                    </p>
                                    <p className="text-[8px] font-bold text-gray-400 font-headline uppercase tracking-widest">Net alpha</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-2 pl-3 pt-4 border-t border-gray-50">
                                <div>
                                    <p className="text-[8px] font-bold text-gray-400 font-headline uppercase">Quantity</p>
                                    <p className="text-[10px] font-black text-gray-800 font-headline">{order.quantity}</p>
                                </div>
                                <div>
                                    <p className="text-[8px] font-bold text-gray-400 font-headline uppercase">Entry</p>
                                    <p className="text-[10px] font-black text-gray-800 font-headline">{formatCurrency(entryPrice)}</p>
                                </div>
                                <div>
                                    <p className="text-[8px] font-bold text-gray-400 font-headline uppercase">Exit</p>
                                    <p className="text-[10px] font-black text-gray-800 font-headline">{formatCurrency(exitPrice)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[8px] font-bold text-gray-400 font-headline uppercase">Date</p>
                                    <p className="text-[9px] font-bold text-gray-400 font-headline">{new Date(order.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}

export default function PortfolioPage() {
    const [activeTab, setActiveTab] = useState<'open' | 'closed'>('open');
    const [selectedInstrument, setSelectedInstrument] = useState<any>(null);
    const [isOrderPanelOpen, setIsOrderPanelOpen] = useState(false);
    const [isExit, setIsExit] = useState(false);
    const [exitQuantity, setExitQuantity] = useState(1);
    const [positionId, setPositionId] = useState<number | undefined>(undefined);

    const handleSelectInstrument = (instrument: any, exit: boolean, quantity: number, posId: number) => {
        setSelectedInstrument(instrument);
        setIsExit(exit);
        setExitQuantity(quantity);
        setPositionId(posId);
        setIsOrderPanelOpen(true);
    };
    
    return (
        <AppLayout>
            <InstrumentActionSheet instrument={selectedInstrument} isOpen={isOrderPanelOpen} onOpenChange={setIsOrderPanelOpen} isExit={isExit} exitQuantity={exitQuantity} positionId={positionId} />
            <div className="flex flex-col gap-6 animate-in fade-in duration-700 slide-in-from-bottom-4">
                <div className="grid grid-cols-2 bg-white/10 backdrop-blur-xl p-1.5 rounded-[1.75rem] border border-white/20 shadow-xl">
                    <button 
                        onClick={() => setActiveTab('open')} 
                        className={cn(
                            "px-6 py-3 rounded-2xl text-[11px] font-black transition-all font-headline uppercase tracking-widest", 
                            activeTab === 'open' ? "bg-[#5D2D91] text-white shadow-lg purple-glow" : "text-white/60 hover:text-white"
                        )}
                    >
                        Active
                    </button>
                    <button 
                        onClick={() => setActiveTab('closed')} 
                        className={cn(
                            "px-6 py-3 rounded-2xl text-[11px] font-black transition-all font-headline uppercase tracking-widest", 
                            activeTab === 'closed' ? "bg-[#5D2D91] text-white shadow-lg purple-glow" : "text-white/60 hover:text-white"
                        )}
                    >
                        History
                    </button>
                </div>
                <main className="flex flex-col">{activeTab === 'open' ? <OpenPositions onExit={handleSelectInstrument} /> : <ClosedPositions />}</main>
            </div>
        </AppLayout>
    );
}
