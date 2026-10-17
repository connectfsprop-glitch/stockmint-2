
'use client';

import { useState, useEffect, useTransition, useCallback, useMemo, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, RefreshCw, UserCheck, UserX, ExternalLink, ShieldAlert, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getTradersList } from '@/app/actions/get-traders-list';

/**
 * @fileOverview Registry Page - Institutional Deep Search.
 * Word-Match Engine: Ensures identities are never missed across the spectrum.
 */

function RegistryContent() {
    const [traders, setTraders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const searchParams = useSearchParams();
    const isMasterView = searchParams.get('master_view') === 'TRUE';
    const [selectedMarket, setSelectedMarket] = useState('indian');

    useEffect(() => {
        const saved = localStorage.getItem('admin_market_view');
        if (saved) setSelectedMarket(saved);
    }, []);

    const fetchTraders = useCallback(async () => {
        setIsLoading(true);
        try {
            const result = await getTradersList();
            if (result.success) {
                setTraders(result.data);
            } else {
                throw new Error(result.error);
            }
        } catch (error: any) {
            console.error('Fetch error:', error);
            toast({ variant: 'destructive', title: 'Loading Failed', description: error.message });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchTraders();
    }, [fetchTraders]);

    const filteredTraders = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        
        // 1. STANDARD VIEW (NO SEARCH): Spectrum Filters
        if (query === '') {
            return traders.filter(t => {
                const marketMatch = t.market_type === selectedMarket;
                const visibilityMatch = isMasterView ? t.is_hidden : !t.is_hidden;
                return marketMatch && visibilityMatch;
            });
        }

        // 2. DEEP SEARCH MODE: Filter Bypass
        const queryWords = query.split(/\s+/);
        return traders.filter(t => {
            const searchFields = [
                t.full_name,
                t.id,
                t.account_classification,
                t.market_type,
                t.role
            ].map(f => String(f || '').toLowerCase());

            return queryWords.every(word => 
                searchFields.some(field => field.includes(word))
            );
        });
    }, [traders, isMasterView, searchQuery, selectedMarket]);

    const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
        startTransition(async () => {
            const { error } = await supabase
                .from('profiles')
                .update({ is_active: !currentStatus })
                .eq('id', userId);

            if (error) {
                toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
            } else {
                toast({ title: 'Status Updated', description: `User is now ${!currentStatus ? 'Active' : 'Inactive'}.` });
                fetchTraders();
            }
        });
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2,
        }).format(value);
    };

    const getClassificationBadge = (classification: string | null) => {
        if (!classification) return null;
        let color = "bg-slate-500";
        const c = classification.toLowerCase();
        if (c.includes('live')) color = "bg-green-600";
        if (c.includes('phase_1') || c.includes('phase1')) color = "bg-blue-600";
        if (c.includes('phase_2') || c.includes('phase2')) color = "bg-purple-600";
        if (c.includes('instant')) color = "bg-amber-600";
        
        if (c === 'passthenpay') {
            return <Badge className="text-[10px] whitespace-nowrap bg-amber-500 text-black font-black uppercase">PTP</Badge>;
        }
        if (c === 'instant_pro') {
            return <Badge className="text-[10px] whitespace-nowrap bg-amber-500 text-black font-black uppercase">PRO</Badge>;
        }
        return <Badge className={cn("text-[10px] whitespace-nowrap uppercase", color)}>{classification.replace(/_/g, ' ')}</Badge>;
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-8 animate-in fade-in duration-1000">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter font-headline text-slate-900 uppercase">
                        Registry
                    </h1>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
                        {selectedMarket.toUpperCase()} Spectrum Terminal
                    </p>
                </div>
                <Button onClick={fetchTraders} className="h-12 px-6 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-[10px] uppercase tracking-widest shadow-sm" disabled={isLoading}>
                    <RefreshCw className={cn("h-4 w-4 mr-3", isLoading && "animate-spin")} />
                    Sync Registry
                </Button>
            </header>

            <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden">
                <div className="p-8 border-b border-slate-50 bg-slate-50/30">
                    <div className="relative w-full max-w-md group">
                        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="Filter ID or Name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-12 h-14 bg-white border-slate-200 rounded-2xl text-sm font-bold text-slate-900"
                        />
                    </div>
                </div>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow className="border-slate-100">
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-8">Identity</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Classification</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Role</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Account Balance</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400 pr-8">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={6} className="text-center py-32"><Loader2 className="h-10 w-10 animate-spin mx-auto text-primary opacity-20" /></TableCell></TableRow>
                                ) : filteredTraders.length > 0 ? (
                                    filteredTraders.map((trader) => (
                                        <TableRow key={trader.id} className="hover:bg-slate-50/50 border-slate-50 transition-colors">
                                            <TableCell className="font-medium py-6 pl-8">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-slate-800 uppercase">{trader.full_name || 'Anonymous User'}</span>
                                                    {!trader.is_active && trader.latest_breach_reason && (
                                                        <div className="flex items-center gap-1.5 mt-1.5 text-[9px] text-rose-500 font-black bg-rose-100 px-2 py-0.5 rounded-md w-fit border border-rose-100">
                                                            <ShieldAlert className="h-3 w-3" />
                                                            <span>{trader.latest_breach_reason}</span>
                                                        </div>
                                                    )}
                                                    <span className="text-[10px] text-slate-400 font-mono mt-0.5 opacity-60">{trader.id}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {getClassificationBadge(trader.account_classification) || <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Unclassified</span>}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={trader.role === 'admin' ? 'destructive' : 'secondary'} className="text-[9px] font-black uppercase h-5 px-3">
                                                    {trader.role}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-black text-primary">
                                                {formatCurrency(trader.cash_balance)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={cn(
                                                    "text-[9px] font-black px-3 py-1 rounded-md border-none uppercase",
                                                    trader.is_active ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                                                )}>
                                                    {trader.is_active ? 'Active' : 'Restricted'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right pr-8">
                                                <div className="flex justify-end gap-2">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        onClick={() => handleToggleStatus(trader.id, trader.is_active)}
                                                        disabled={isPending}
                                                        className={cn(
                                                            "h-10 px-4 text-[10px] uppercase font-black tracking-widest rounded-xl transition-all",
                                                            trader.is_active ? "text-rose-500 hover:bg-rose-50" : "text-emerald-500 hover:bg-emerald-50"
                                                        )}
                                                    >
                                                        {trader.is_active ? <UserX className="h-4 w-4 mr-2" /> : <UserCheck className="h-4 w-4 mr-2" />}
                                                        {trader.is_active ? 'Disable' : 'Enable'}
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="h-10 w-10 p-0 rounded-xl hover:bg-slate-100 hover:text-primary transition-all" asChild>
                                                        <Link href={`/admin/users/${trader.id}`}><ExternalLink className="h-4 w-4" /></Link>
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={6} className="text-center py-32 text-slate-300 text-[10px] uppercase font-black opacity-40 tracking-[0.3em]">No entries detected in this spectrum view.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default function RegistryPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>}>
            <RegistryContent />
        </Suspense>
    );
}
