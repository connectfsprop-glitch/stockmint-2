'use client';

import { useState, useEffect, useTransition, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, RefreshCw, UserCheck, UserX, ExternalLink, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';

/**
 * @fileOverview Pass Then Pay (PTP) Exclusive Directory.
 * Clean Typography and Simple Language.
 */

export default function PTPDirectoryPage() {
    const [traders, setTraders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const fetchTraders = useCallback(async () => {
        setIsLoading(true);
        try {
            // 1. Direct fetch from profiles table (PTP Model only)
            const { data: profiles, error: pError } = await supabase
                .from('profiles')
                .select('*')
                .eq('account_model', 'passthenpay')
                .order('created_at', { ascending: false });

            if (pError) throw pError;

            if (profiles && profiles.length > 0) {
                const userIds = profiles.map(p => p.id);

                // 2. Fetch balances separately
                const { data: portfolios } = await supabase
                    .from('portfolios')
                    .select('user_id, cash_balance')
                    .in('user_id', userIds);
                
                const balanceMap = new Map(portfolios?.map(p => [p.user_id, p.cash_balance]) || []);

                // 3. Fetch latest breach reasons for context
                const { data: breachOrders } = await supabase
                    .from('orders')
                    .select('user_id, breach_reason')
                    .in('user_id', userIds)
                    .not('breach_reason', 'is', null)
                    .neq('breach_reason', '')
                    .order('created_at', { ascending: false });

                const breachMap = new Map();
                breachOrders?.forEach(o => {
                    if (!breachMap.has(o.user_id)) breachMap.set(o.user_id, o.breach_reason);
                });

                const enriched = profiles.map(p => ({
                    ...p,
                    cash_balance: balanceMap.get(p.id) ?? 0,
                    latest_breach_reason: breachMap.get(p.id) ?? null
                }));

                setTraders(enriched);
            } else {
                setTraders([]);
            }
        } catch (error: any) {
            console.error('Fetch error in PTP Directory:', error);
            toast({ variant: 'destructive', title: 'Sync Failed', description: error.message });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchTraders();
    }, [fetchTraders]);

    const filteredTraders = useMemo(() => {
        return traders.filter(t => 
            (t.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (t.id || '').toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [traders, searchQuery]);

    const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
        startTransition(async () => {
            const { error } = await supabase
                .from('profiles')
                .update({ is_active: !currentStatus })
                .eq('id', userId);

            if (error) {
                toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
            } else {
                toast({ title: 'Status updated', description: 'Terminal access updated.' });
                fetchTraders();
            }
        });
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold tracking-tight font-headline text-foreground">
                            Pass then pay list
                        </h1>
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 px-3 py-1 font-bold">
                            PTP Model
                        </Badge>
                    </div>
                    <p className="text-muted-foreground mt-1">
                        Isolated management for specialized institutional accounts.
                    </p>
                </div>
                <button onClick={fetchTraders} disabled={isLoading} className="flex items-center gap-2 px-6 h-11 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-[10px] shadow-sm hover:bg-slate-50 transition-all">
                    <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                    Sync Data
                </button>
            </header>

            <Card className="rounded-[2rem] border-white/5 bg-card overflow-hidden">
                <div className="p-6 border-b bg-muted/30">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search by name or ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-11 bg-white/[0.02] border-white/10 rounded-xl"
                        />
                    </div>
                </div>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 border-white/5">
                                    <TableHead className="font-bold text-[10px] text-slate-400">Trader identity</TableHead>
                                    <TableHead className="font-bold text-[10px] text-slate-400">Risk limits</TableHead>
                                    <TableHead className="font-bold text-[10px] text-slate-400">Capital balance</TableHead>
                                    <TableHead className="font-bold text-[10px] text-slate-400">Status</TableHead>
                                    <TableHead className="text-right font-bold text-[10px] text-slate-400">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-24">
                                            <RefreshCw className="h-10 w-10 animate-spin mx-auto opacity-10" />
                                        </TableCell>
                                    </TableRow>
                                ) : filteredTraders.length > 0 ? (
                                    filteredTraders.map((trader) => (
                                        <TableRow key={trader.id} className="hover:bg-white/[0.01] border-white/5 transition-colors group">
                                            <TableCell className="py-5 font-medium">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-white">{trader.full_name || 'Anonymous User'}</span>
                                                    {!trader.is_active && trader.latest_breach_reason && (
                                                        <div className="flex items-center gap-1.5 mt-1.5 text-[9px] text-rose-500 font-bold bg-rose-500/5 px-2 py-0.5 rounded-md w-fit border border-rose-500/10">
                                                            <ShieldAlert className="h-3 w-3" />
                                                            <span>{trader.latest_breach_reason}</span>
                                                        </div>
                                                    )}
                                                    <span className="text-[10px] text-muted-foreground font-mono mt-0.5 opacity-40">{trader.id}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="text-[10px] font-bold border-amber-500/20 bg-amber-500/5 text-amber-500">
                                                        {trader.loss_limit_percentage}% Max
                                                    </Badge>
                                                    <Badge variant="outline" className="text-[10px] font-bold border-emerald-500/20 bg-emerald-500/5 text-emerald-500">
                                                        {trader.daily_loss_limit_percentage}% Day
                                                    </Badge>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-black text-primary">
                                                {formatCurrency(trader.cash_balance)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={trader.is_active ? 'default' : 'destructive'} className="h-5 text-[9px] font-bold">
                                                    {trader.is_active ? 'Active' : 'Restricted'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        onClick={() => handleToggleStatus(trader.id, trader.is_active)}
                                                        disabled={isPending}
                                                        className={cn(
                                                            "h-9 px-3 text-[10px] font-bold rounded-xl transition-all",
                                                            trader.is_active ? "text-rose-500 hover:bg-rose-50" : "text-emerald-500 hover:bg-emerald-50"
                                                        )}
                                                    >
                                                        {trader.is_active ? <UserX className="h-3.5 w-3.5 mr-1.5" /> : <UserCheck className="h-3.5 w-3.5 mr-1.5" />}
                                                        {trader.is_active ? 'Restrict' : 'Activate'}
                                                    </Button>
                                                    <Button variant="outline" size="sm" className="h-9 w-9 p-0 rounded-xl border-white/5" asChild>
                                                        <Link href={`/admin/users/${trader.id}`}><ExternalLink className="h-4 w-4" /></Link>
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-20 text-muted-foreground text-[10px] font-bold opacity-20">
                                            No matching accounts detected.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}