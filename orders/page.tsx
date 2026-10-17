'use client';

import {
  Search,
  Book,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserProfile } from '@/hooks/use-user-profile';
import { AppLayout } from '@/components/app-layout';
import React, { useState, useEffect, useCallback, useMemo, useTransition } from 'react';
import { supabase } from '@/lib/supabase';
import { formatSimpleInstrumentName } from '@/lib/format-instrument';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cancelOrder } from '../actions/cancel-order';
import { useToast } from '@/hooks/use-toast';
import { useWebSocketData } from '@/context/websocket-context';

/**
 * @fileOverview INSTITUTIONAL TRADEBOOK TERMINAL v2.5
 * Refined Order Log: Pure chronological ledger of Buy/Sell execution requests.
 * Completed trade data (Entry/Exit/PnL) is exclusively managed in Portfolio History.
 */

interface Order {
    id: number;
    created_at: string;
    user_id: string;
    symbol: string;
    exchange: string;
    order_type: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    status: string;
    transaction_type: string;
    instrument_type: string;
    pnl: number | null;
}

const getInstrumentKey = (instrument: { symbol: string, exchange: string }) => `${instrument.exchange}:${instrument.symbol}`;

const formatCurrency = (value: number | null | undefined, placeholder = '₹0.00') => {
    if (value === null || typeof value === 'undefined' || isNaN(value)) {
        return placeholder;
    }
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(value));
};

const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }) + ' ' + date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

function OrdersPageContent() {
    const { user } = useUserProfile(['student', 'admin', 'mentor']);
    const { toast } = useToast();
    const { prices, subscribe } = useWebSocketData();
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [cancellingId, setCancellingId] = useState<number | null>(null);

    const fetchOrders = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);

        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching trades:", error);
            setOrders([]);
        } else {
            setOrders(data as Order[]);
        }
        setIsLoading(false);
    }, [user]);

    useEffect(() => {
        fetchOrders();
        
        if (!user) return;
        const channel = supabase.channel(`orders-realtime-${user.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` }, () => {
                fetchOrders();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, fetchOrders]);

    useEffect(() => {
        const instruments = orders
            .filter(o => o.status === 'PENDING')
            .map(o => ({ symbol: o.symbol, exchange: o.exchange }));
        if (instruments.length > 0) subscribe(instruments);
    }, [orders, subscribe]);

    const filteredOrders = useMemo(() => {
        if (!searchQuery) return orders;
        return orders.filter(o => 
            o.symbol.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [orders, searchQuery]);

    const handleCancel = (orderId: number) => {
        setCancellingId(orderId);
        const performCancel = async () => {
            const result = await cancelOrder(orderId);
            if (result.success) {
                toast({ title: 'Success', description: result.message });
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.message });
            }
            setCancellingId(null);
        };
        performCancel();
    };

    return (
        <AppLayout>
            <div className="animate-in fade-in duration-1000 slide-in-from-bottom-4">
                <div className="relative -mt-4 mb-14 px-1">
                    <div className="space-y-1 pb-16">
                        <h1 className="font-headline text-4xl md:text-5xl font-black tracking-tight text-white">Tradebook</h1>
                    </div>
                    <div className="absolute -bottom-8 left-0 right-0 z-30">
                        <div className="relative group mx-auto max-w-full">
                            <div className="absolute inset-0 bg-white/40 blur-2xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-[#5D2D91] transition-colors z-40" />
                            <Input
                                placeholder="Search your trade ledger..."
                                className="bg-white border-none pl-14 h-16 rounded-[1.5rem] text-sm md:text-base font-semibold focus:ring-0 transition-all placeholder:text-slate-300 shadow-xl relative z-30"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-3 pt-4">
                    {isLoading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="h-24 rounded-[2rem] bg-white shadow-sm" />
                        ))
                    ) : filteredOrders.length === 0 ? (
                        <div className="py-24 text-center bg-white/50 rounded-[2.5rem] border-dashed border-slate-200">
                            <Book className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                            <p className="text-slate-900 font-bold text-lg font-headline">Ledger clear</p>
                            <p className="text-xs text-slate-400 mt-1">Order executions will appear here</p>
                        </div>
                    ) : (
                        <div className="grid gap-3 pb-24">
                            {filteredOrders.map((order) => (
                                <OrderCard 
                                    key={order.id} 
                                    order={order} 
                                    onCancel={() => handleCancel(order.id)}
                                    isCancelling={cancellingId === order.id}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}

function OrderCard({ order, onCancel, isCancelling }: { order: Order, onCancel: () => void, isCancelling: boolean }) {
    const isBuy = order.order_type === 'BUY';
    const isCompleted = order.status === 'COMPLETED';
    const isPending = order.status === 'PENDING';
    const isFailed = ['FAILED', 'REJECTED', 'CANCELLED'].includes(order.status.toUpperCase());
    
    return (
        <div className="bg-white rounded-[1.5rem] shadow-sm overflow-hidden flex relative border-none group hover:shadow-md transition-shadow">
            <div className={cn(
                "w-1.5 h-full absolute left-0 top-0",
                isBuy ? "bg-blue-500" : "bg-rose-500",
                isFailed && "bg-slate-300"
            )} />
            
            <div className="pl-5 pr-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 flex-1">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className={cn(
                            "text-[8px] font-black px-1.5 py-0 rounded-md border-none",
                            isBuy ? "bg-blue-50 text-blue-600" : "bg-rose-50 text-rose-600"
                        )}>
                            {isBuy ? 'Buy order' : 'Sell order'}
                        </Badge>
                        <h3 className="font-bold text-sm text-slate-800 tracking-tight truncate font-headline">
                            {formatSimpleInstrumentName({ tradingsymbol: order.symbol })}
                        </h3>
                        <span className="text-[9px] font-bold text-slate-300 uppercase">{order.exchange}</span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-6 text-[10px]">
                        <div>
                            <p className="text-slate-400 font-medium mb-0.5 uppercase tracking-tighter">Execution price</p>
                            <p className="text-slate-900 font-black">{formatCurrency(order.price)}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 font-medium mb-0.5 uppercase tracking-tighter">Order quantity</p>
                            <p className="text-slate-900 font-black">{order.quantity} units</p>
                        </div>
                        <div>
                            <p className="text-slate-400 font-medium mb-0.5 uppercase tracking-tighter">Execution mode</p>
                            <p className="text-slate-900 font-black">{order.transaction_type}</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-end justify-between md:flex-col md:justify-center gap-2 pt-3 md:pt-0 border-t md:border-none border-slate-50">
                    <div className="md:text-right">
                        <Badge className={cn(
                            "text-[8px] font-black py-0.5 px-2 rounded-md border-none",
                            isCompleted ? "bg-[#00C853]/10 text-[#00C853]" :
                            isPending ? "bg-amber-50 text-amber-600" :
                            "bg-rose-50 text-rose-600"
                        )}>
                            {order.status}
                        </Badge>
                        <p className="text-[9px] font-medium text-slate-300 mt-1">
                            {formatDate(order.created_at)}
                        </p>
                    </div>

                    <div className="text-right">
                        {isPending && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={(e) => { e.stopPropagation(); onCancel(); }}
                                disabled={isCancelling}
                                className="h-9 px-4 rounded-xl border-rose-100 text-rose-500 hover:bg-rose-50 font-bold text-[9px] uppercase tracking-widest"
                            >
                                {isCancelling ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Abort'}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function OrdersPage() {
  return <OrdersPageContent />;
}
