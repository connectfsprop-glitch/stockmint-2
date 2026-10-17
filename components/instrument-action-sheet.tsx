'use client';

import React, { useState, useTransition, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatInstrumentName } from '@/lib/format-instrument';
import { Input } from './ui/input';
import { Loader2, ChevronRight, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { placeOrder } from '@/app/actions/place-order';
import { getStockPrice } from '@/app/actions/get-stock-price';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { useWebSocketData } from '@/context/websocket-context';

interface InstrumentActionSheetProps {
  instrument: any;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  isExit?: boolean;
  exitQuantity?: number;
  positionId?: number;
}

export function InstrumentActionSheet({ instrument, isOpen, onOpenChange, isExit, exitQuantity, positionId }: InstrumentActionSheetProps) {
    const { toast } = useToast();
    const { profile, user, leverages: userLeverages, portfolio, revalidate } = useUserProfile();
    const { prices, subscribe } = useWebSocketData();
    const [isPending, startTransition] = useTransition();
    
    const [lots, setLots] = useState<number | string>(1);
    const [limitPrice, setLimitPrice] = useState<number | string>('');
    const [targetPrice, setTargetPrice] = useState<number | string>('');
    const [stopLoss, setStopLoss] = useState<number | string>('');
    const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
    const [selectedLeverage, setSelectedLeverage] = useState<number>(1);
    const [livePrice, setLivePrice] = useState<number>(0);
    
    const lastHandledSymbol = useRef<string | null>(null);
    const isForexUser = profile?.market_type === 'forex';
    const currencySymbol = isForexUser ? '$' : '₹';

    const formatCurrency = (value: number | null | undefined) => {
        if (value === null || typeof value === 'undefined' || isNaN(value)) return '0.00';
        return new Intl.NumberFormat('en-IN', { 
            minimumFractionDigits: isForexUser ? 2 : 2,
            maximumFractionDigits: isForexUser ? 2 : 2 
        }).format(value);
    };

    const formatPrice = (value: number) => {
        return value.toFixed(isForexUser ? 5 : 2);
    }

    useEffect(() => {
        if (isOpen && instrument) {
            const sym = instrument.symbol || instrument.tradingsymbol;
            const exch = instrument.exchange || (isForexUser ? 'FOREX' : 'NSE');
            
            if (lastHandledSymbol.current !== sym) {
                lastHandledSymbol.current = sym;
                setStopLoss('');
                setTargetPrice('');
                setLots(isExit && exitQuantity ? Math.abs(exitQuantity) : (isForexUser ? 0.01 : 1));
                setOrderType('market');
                const defaultLeverage = isForexUser ? 100 : (userLeverages?.equity || 1);
                setSelectedLeverage(defaultLeverage);
            }

            if (sym) {
                getStockPrice({ symbol: sym, exchange: exch }).then(res => {
                    if (res.success) {
                        setLivePrice(res.data.price);
                        if (!limitPrice) setLimitPrice(res.data.price);
                    }
                });

                subscribe([{ symbol: sym, exchange: exch }]);
            }
        } else if (!isOpen) {
            lastHandledSymbol.current = null;
        }
    }, [isOpen, instrument, isExit, exitQuantity, userLeverages, subscribe, isForexUser, limitPrice]);

    if (!instrument) return null;

    const symbol = (instrument.symbol || instrument.tradingsymbol || '').toString();
    const exchange = (instrument.exchange || (isForexUser ? 'FOREX' : 'NSE')).toString();
    const instrumentType = instrument.instrument_type || (isForexUser ? 'Forex' : 'Equity');
    const lotSize = instrument.lot_size || instrument.lotSize || (isForexUser ? 100000 : 1);
    
    const totalQuantity = Number(lots) * (isExit ? 1 : lotSize);
    const currentPriceKey = exchange && symbol ? `${exchange.toUpperCase()}:${symbol.toUpperCase()}` : '';
    const wsPrice = prices[currentPriceKey]?.price || livePrice;
    const executionPrice = orderType === 'limit' && limitPrice ? Number(limitPrice) : wsPrice;
    
    const requiredMargin = (totalQuantity * (executionPrice || 0)) / (isExit ? 1 : selectedLeverage);

    const handleOrder = (type: 'BUY' | 'SELL') => {
        if (!user || !symbol) return;
        startTransition(async () => {
            const result = await placeOrder({
                userId: user.id,
                symbol,
                exchange,
                instrument_type: instrumentType, 
                quantity: totalQuantity,
                orderType: type,
                transactionType: orderType.toUpperCase() as any,
                leverage: isExit ? 1 : selectedLeverage,
                price: executionPrice,
                positionId: isExit ? positionId : undefined,
                targetPrice: targetPrice ? Number(targetPrice) : undefined,
                stopLossPrice: stopLoss ? Number(stopLoss) : undefined
            });

            if (result.success) {
                toast({ title: 'Order successful', description: result.message });
                revalidate();
                onOpenChange(false);
            } else {
                toast({ variant: 'destructive', title: 'Order failed', description: result.message });
            }
        });
    };

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="bg-white border-t-0 p-0 rounded-t-[2.5rem] overflow-hidden focus:outline-none max-h-[95vh] flex flex-col">
                <SheetHeader className="sr-only">
                    <SheetTitle>Order execution: {formatInstrumentName(symbol)}</SheetTitle>
                    <SheetDescription>Configure and place orders for {symbol}.</SheetDescription>
                </SheetHeader>

                <div className="bg-[#5D2D91] p-6 pb-8 text-white relative shrink-0">
                    <button 
                        onClick={() => onOpenChange(false)} 
                        className="absolute right-6 top-6 h-8 w-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-black tracking-tight font-headline">{formatInstrumentName(symbol)}</h2>
                        <Badge className="bg-emerald-500 text-white text-[8px] font-black border-none h-4 px-2 font-headline">Live</Badge>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3 mt-6">
                        <div className="bg-white/5 p-3 rounded-2xl border border-white/10 backdrop-blur-sm">
                            <p className="text-[8px] font-black text-white/40 mb-1 tracking-widest font-headline">Required</p>
                            <p className="text-sm font-black tracking-tight font-headline">{currencySymbol}{formatCurrency(requiredMargin)}</p>
                        </div>
                        <div className="bg-white/5 p-3 rounded-2xl border border-white/10 backdrop-blur-sm">
                            <p className="text-[8px] font-black text-white/40 mb-1 tracking-widest font-headline">Available</p>
                            <p className="text-sm font-black tracking-tight font-headline">{currencySymbol}{formatCurrency(portfolio?.cash_balance)}</p>
                        </div>
                        <div className="bg-white/5 p-3 rounded-2xl border border-white/10 backdrop-blur-sm">
                            <p className="text-[8px] font-black text-white/40 mb-1 tracking-widest font-headline">Last price</p>
                            <p className="text-sm font-black tracking-tight text-[#00C853] font-headline">
                                {formatPrice(wsPrice)}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-6 pb-12 space-y-6 bg-[#F2F4F7] overflow-y-auto no-scrollbar flex-1">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black text-slate-400 tracking-widest ml-1 font-headline">
                                {isForexUser ? 'Execution lots' : 'Quantity (Lots)'}
                            </Label>
                            <Input 
                                type="number" 
                                step={isForexUser ? 0.01 : 1}
                                value={lots} 
                                onChange={e => setLots(e.target.value)} 
                                disabled={isExit} 
                                className="h-14 rounded-2xl border-none shadow-sm font-black text-base text-center focus:ring-2 focus:ring-[#5D2D91]/20 font-headline" 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black text-slate-400 tracking-widest ml-1 font-headline">Execution mode</Label>
                            <div className="flex bg-white rounded-2xl p-1.5 shadow-sm h-14">
                                <button 
                                    onClick={() => setOrderType('market')} 
                                    className={cn(
                                        "flex-1 rounded-xl text-[10px] font-black tracking-widest transition-all font-headline", 
                                        orderType === 'market' ? "bg-[#5D2D91] text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    Market
                                </button>
                                <button 
                                    onClick={() => {
                                        setOrderType('limit');
                                        if (!limitPrice) setLimitPrice(wsPrice);
                                    }} 
                                    className={cn(
                                        "flex-1 rounded-xl text-[10px] font-black tracking-widest transition-all font-headline", 
                                        orderType === 'limit' ? "bg-[#5D2D91] text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    Limit
                                </button>
                            </div>
                        </div>
                    </div>

                    {isForexUser && !isExit && (
                        <div className="space-y-4 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                            <div className="flex justify-between items-center mb-2">
                                <Label className="text-[10px] font-black text-slate-400 tracking-widest font-headline">Execution leverage</Label>
                                <span className="text-xs font-black text-[#5D2D91] bg-[#5D2D91]/5 px-3 py-1 rounded-full tracking-tighter font-headline">
                                    1:{selectedLeverage} Max
                                </span>
                            </div>
                            <Slider 
                                value={[selectedLeverage]} 
                                onValueChange={(vals) => setSelectedLeverage(vals[0])}
                                min={1} 
                                max={200} 
                                step={1}
                                className="py-2"
                            />
                            <div className="flex justify-between text-[8px] font-black text-slate-300 tracking-widest font-headline">
                                <span>1x</span>
                                <span>100x</span>
                                <span>200x</span>
                            </div>
                        </div>
                    )}

                    {orderType === 'limit' && (
                        <div className="space-y-2 animate-in slide-in-from-top-1 duration-200">
                            <Label className="text-[10px] font-black text-[#5D2D91] tracking-widest ml-1 font-headline">Target trigger price</Label>
                            <Input 
                                type="number" 
                                placeholder="Enter price..."
                                value={limitPrice} 
                                onChange={e => setLimitPrice(e.target.value)} 
                                className="h-14 rounded-2xl border-2 border-[#5D2D91]/20 bg-white shadow-sm font-black text-center text-[#5D2D91] text-base font-headline" 
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black text-slate-400 tracking-widest ml-1 font-headline">Safety stop loss</Label>
                            <Input 
                                type="number" 
                                placeholder="Optional"
                                value={stopLoss} 
                                onChange={e => setStopLoss(e.target.value)} 
                                className="h-14 rounded-2xl border-none shadow-sm font-black text-center placeholder:text-slate-200 text-base font-headline" 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black text-slate-400 tracking-widest ml-1 font-headline">Target exit price</Label>
                            <Input 
                                type="number" 
                                placeholder="Optional"
                                value={targetPrice} 
                                onChange={e => setTargetPrice(e.target.value)} 
                                className="h-14 rounded-2xl border-none shadow-sm font-black text-center placeholder:text-slate-200 text-base font-headline" 
                            />
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4 shrink-0">
                        {isExit ? (
                            <Button 
                                onClick={() => handleOrder(exitQuantity! > 0 ? 'SELL' : 'BUY')} 
                                disabled={isPending}
                                className="flex-1 h-16 bg-[#5D2D91] text-white font-black rounded-[1.25rem] text-sm flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-xl purple-glow tracking-widest font-headline"
                            >
                                {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Liquidate position <ChevronRight className="h-5 w-5" /></>}
                            </Button>
                        ) : (
                            <>
                                <Button 
                                    onClick={() => handleOrder('BUY')} 
                                    disabled={isPending}
                                    className="flex-1 h-16 bg-[#00C853] hover:bg-[#00B049] text-white font-black rounded-[1.25rem] text-sm transition-all active:scale-[0.98] shadow-xl tracking-widest font-headline"
                                >
                                    {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : (isForexUser ? 'Long' : 'Buy')}
                                </Button>
                                <Button 
                                    onClick={() => handleOrder('SELL')} 
                                    disabled={isPending}
                                    className="flex-1 h-16 bg-[#D32F2F] hover:bg-[#B71C1C] text-white font-black rounded-[1.25rem] text-sm transition-all active:scale-[0.98] shadow-xl tracking-widest font-headline"
                                >
                                    {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : (isForexUser ? 'Short' : 'Sell')}
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}