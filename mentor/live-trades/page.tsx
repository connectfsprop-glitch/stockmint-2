
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatSimpleInstrumentName } from '@/lib/format-instrument';
import { useWebSocketData } from '@/context/websocket-context';
import { Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from "@/components/ui/label";
import { getMentorLiveTrades, type MentorLiveTrade } from '@/app/actions/get-mentor-live-trades';
import { useUserProfile } from '@/hooks/use-user-profile';

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

export default function MentorLiveTradesPage() {
    const { user } = useUserProfile(['mentor']);
    const [positions, setPositions] = useState<MentorLiveTrade[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const { prices, subscribe } = useWebSocketData();

    const fetchMentorPositions = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        const result = await getMentorLiveTrades(user.id);

        if (result.success) {
            setPositions(result.data);
        } else {
            console.error("Error fetching mentor's live trades:", result.error);
            setError(result.error);
            setPositions([]);
        }
        setIsLoading(false);
    }, [user]);

    useEffect(() => {
        fetchMentorPositions();
    }, [fetchMentorPositions]);
    
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

        if (!searchQuery) return updatedPositions;
        return updatedPositions.filter(pos =>
            pos.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [positions, prices, searchQuery]);
    
    const totalLivePnl = filteredPositions.reduce((acc, pos) => acc + pos.pnl, 0);

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <header className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight font-headline text-foreground">Student Live Trades</h1>
                <p className="text-muted-foreground">Real-time overview of your students' open positions.</p>
            </header>

            <div className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-1">
                    <CardHeader><CardTitle>Total Live P&L</CardTitle></CardHeader>
                    <CardContent>
                        <p className={cn("text-3xl font-bold", totalLivePnl >= 0 ? "text-green-500" : "text-red-500")}>
                            {formatCurrency(totalLivePnl, '₹0.00', true)}
                        </p>
                    </CardContent>
                </Card>
                <div className="lg:col-span-2 flex items-end">
                     <div className="w-full max-w-sm">
                        <Label htmlFor="search-user">Search Student</Label>
                        <div className="relative mt-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                id="search-user"
                                placeholder="Filter by student name..."
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
                    {isLoading ? (
                        <div className="p-8 text-center"><Loader2 className="animate-spin" /></div>
                    ) : error ? (
                        <div className="p-8 text-center text-red-500">{error}</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Student</TableHead>
                                    <TableHead>Instrument</TableHead>
                                    <TableHead>Qty</TableHead>
                                    <TableHead>Entry Price</TableHead>
                                    <TableHead>LTP</TableHead>
                                    <TableHead className="text-right">P&L</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredPositions.length > 0 ? (
                                    filteredPositions.map(pos => (
                                        <TableRow key={pos.id}>
                                            <TableCell>{pos.profiles?.full_name || 'N/A'}</TableCell>
                                            <TableCell>{formatSimpleInstrumentName({ tradingsymbol: pos.symbol })}</TableCell>
                                            <TableCell>{pos.quantity}</TableCell>
                                            <TableCell>{formatCurrency(pos.average_price)}</TableCell>
                                            <TableCell>{formatCurrency(pos.ltp)}</TableCell>
                                            <TableCell className={cn("text-right font-semibold", pos.pnl >= 0 ? "text-green-500" : "text-red-500")}>
                                                {formatCurrency(pos.pnl, '₹0.00', true)}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={6} className="text-center">No live trades found for your students.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
