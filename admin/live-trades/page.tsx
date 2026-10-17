
'use client';

import React, { useState, useEffect, useMemo, useCallback, useTransition } from 'react';
import { supabase } from '@/lib/supabase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatSimpleInstrumentName } from '@/lib/format-instrument';
import { useWebSocketData } from '@/context/websocket-context';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { forceCloseTrade } from '@/app/actions/force-close-trade';
import { Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from "@/components/ui/label";
import { useUserProfile } from '@/hooks/use-user-profile';

type Position = {
    id: number;
    symbol: string;
    exchange: string;
    instrument_type: string;
    quantity: number;
    average_price: number;
    profiles: {
        full_name: string;
    } | null;
};

type EnrichedPosition = Position & {
    ltp: number;
    pnl: number;
};

const formatCurrency = (value: number | null | undefined, placeholder = '₹0.00', showSign = false) => {
    if (value === null || typeof value === 'undefined' || isNaN(value)) {
        return placeholder;
    }
    const formatted = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(value));

    if (showSign) {
        return value >= 0 ? `+${formatted}` : `-${formatted}`;
    }
    return formatted;
};

export default function LiveTradesPage() {
    const [positions, setPositions] = useState<EnrichedPosition[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const { prices, subscribe } = useWebSocketData();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [closingId, setClosingId] = useState<number | null>(null);

    const fetchAllPositions = useCallback(async () => {
        setIsLoading(true);

        let query = supabase
            .from('positions')
            .select(`
                *,
                profiles (
                    full_name
                )
            `)
            .order('created_at', { ascending: false });

        const { data, error } = await query;

        if (error) {
            console.error("Error fetching positions:", error);
            setPositions([]);
        } else {
            const enrichedData = data.map(p => ({ ...p, ltp: 0, pnl: 0 }));
            setPositions(enrichedData);
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchAllPositions();

        const channel = supabase.channel('live-trades-admin')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'positions' }, () => {
                fetchAllPositions();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchAllPositions]);
    
    const instrumentsToSubscribe = useMemo(() => {
        return positions.map(p => ({ symbol: p.symbol, exchange: p.exchange }));
    }, [positions]);

    useEffect(() => {
        if (instrumentsToSubscribe.length > 0) {
            subscribe(instrumentsToSubscribe);
        }
    }, [instrumentsToSubscribe, subscribe]);
    
    const filteredPositions = useMemo(() => {
        let updatedPositions = positions.map(pos => {
            const update = prices[pos.symbol];
            if (update) {
                const ltp = update.price;
                const pnl = (ltp - pos.average_price) * pos.quantity;
                return { ...pos, ltp, pnl };
            }
            return pos;
        });

        if (!searchQuery) {
            return updatedPositions;
        }

        return updatedPositions.filter(pos =>
            pos.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [positions, prices, searchQuery]);

    const handleExit = (positionId: number) => {
        setClosingId(positionId);
        startTransition(async () => {
            const result = await forceCloseTrade(positionId);
            if (result.success) {
                toast({ title: "Success", description: result.message });
                // The realtime subscription will refresh the data
            } else {
                toast({ variant: "destructive", title: "Error", description: result.message });
            }
            setClosingId(null);
        });
    }

    const totalLivePnl = filteredPositions.reduce((acc, pos) => acc + pos.pnl, 0);
    const summaryTitle = searchQuery ? `Live P&L for ${filteredPositions[0]?.profiles?.full_name || '...'}` : 'Platform P&L Summary';


    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <header className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight font-headline text-foreground">Live Trades</h1>
                <p className="text-muted-foreground">Real-time overview of all open positions across the platform.</p>
            </header>

            <div className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle>{summaryTitle}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="p-4 bg-muted/50 rounded-lg">
                            <p className="text-sm text-muted-foreground">Total Live P&L</p>
                            <p className={cn("text-3xl font-bold", totalLivePnl >= 0 ? "text-green-500" : "text-red-500")}>
                                {formatCurrency(totalLivePnl, '₹0.00', true)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <div className="lg:col-span-2 flex items-end">
                     <div className="w-full max-w-sm">
                        <Label htmlFor="search-user">Search User</Label>
                        <div className="relative mt-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                id="search-user"
                                placeholder="Filter by user name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <div className="md:hidden">
                        {isLoading ? (
                            <div className="text-center p-4">Loading...</div>
                        ) : filteredPositions.length > 0 ? (
                            <div className="space-y-4 p-4">
                                {filteredPositions.map(pos => (
                                    <div key={pos.id} className="border rounded-lg p-3 text-sm space-y-2">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-bold text-primary">{pos.profiles?.full_name || 'N/A'}</p>
                                                <p className="text-xs text-muted-foreground">{formatSimpleInstrumentName({ tradingsymbol: pos.symbol })}</p>
                                            </div>
                                            <p className={cn("font-semibold text-lg", pos.pnl >= 0 ? "text-green-500" : "text-red-500")}>
                                                {formatCurrency(pos.pnl, '₹0.00', true)}
                                            </p>
                                        </div>
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>Qty: {pos.quantity}</span>
                                            <span>Buy: {formatCurrency(pos.average_price)}</span>
                                            <span>LTP: {formatCurrency(pos.ltp)}</span>
                                        </div>
                                        <div className="flex justify-end pt-2">
                                            <Button size="sm" variant="destructive" onClick={() => handleExit(pos.id)} disabled={isPending && closingId === pos.id}>
                                                {isPending && closingId === pos.id ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Exit'}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center p-4 text-muted-foreground">No live trades found.</p>
                        )}
                    </div>
                    <Table className="hidden md:table">
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Instrument</TableHead>
                                <TableHead>Qty</TableHead>
                                <TableHead>Entry Price</TableHead>
                                <TableHead>LTP</TableHead>
                                <TableHead>P&L</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={7} className="text-center">Loading live positions...</TableCell></TableRow>
                            ) : filteredPositions.length > 0 ? (
                                filteredPositions.map(pos => (
                                    <TableRow key={pos.id}>
                                        <TableCell>{pos.profiles?.full_name || 'N/A'}</TableCell>
                                        <TableCell>{formatSimpleInstrumentName({ tradingsymbol: pos.symbol })}</TableCell>
                                        <TableCell>{pos.quantity}</TableCell>
                                        <TableCell>{formatCurrency(pos.average_price)}</TableCell>
                                        <TableCell>{formatCurrency(pos.ltp)}</TableCell>
                                        <TableCell className={cn("font-semibold", pos.pnl >= 0 ? "text-green-500" : "text-red-500")}>
                                            {formatCurrency(pos.pnl, '₹0.00', true)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button size="sm" variant="destructive" onClick={() => handleExit(pos.id)} disabled={isPending && closingId === pos.id}>
                                                {isPending && closingId === pos.id ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Exit'}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={7} className="text-center">No live trades found for this filter.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
