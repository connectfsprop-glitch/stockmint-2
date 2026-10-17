
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
 * @fileOverview The Traders Directory page v2.0
 * Identity Transparency: Now displays user emails directly below the names.
 */

function TradersContent() {
    const [traders, setTraders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const searchParams = useSearchParams();
    const isMasterView = searchParams.get('master_view') === 'TRUE';

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

    const viewScopeTraders = useMemo(() => {
        return traders.filter(t => isMasterView ? t.is_hidden : !t.is_hidden);
    }, [traders, isMasterView]);

    const filteredTraders = useMemo(() => {
        return viewScopeTraders.filter(t => {
            const matchesSearch = (t.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                 (t.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                 (t.id || '').toLowerCase().includes(searchQuery.toLowerCase());
            return matchesSearch;
        });
    }, [viewScopeTraders, searchQuery]);

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
        if (classification.includes('Live')) color = "bg-green-600";
        if (classification.includes('Phase1') || classification.includes('phase_1')) color = "bg-blue-600";
        if (classification.includes('Phase2') || classification.includes('phase_2')) color = "bg-purple-600";
        if (classification.includes('Instant')) color = "bg-amber-600";
        
        if (classification === 'passthenpay') {
            return <Badge className="text-[10px] whitespace-nowrap bg-amber-500 text-black font-black uppercase">PTP</Badge>;
        }
        
        return <Badge className={cn("text-[10px] whitespace-nowrap uppercase", color)}>{classification}</Badge>;
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight font-headline text-foreground">
                        {isMasterView ? 'Stealth Directory' : 'Traders Directory'}
                    </h1>
                    <p className="text-muted-foreground">
                        {isMasterView ? 'Managing ghost accounts excluded from standard admin view.' : 'Platform-wide profile registry and risk management.'}
                    </p>
                </div>
                <Button onClick={fetchTraders} variant="outline" size="sm" disabled={isLoading}>
                    <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
                    Refresh Directory
                </Button>
            </header>

            <Card>
                <div className="p-4 border-b bg-muted/30">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Filter by name, email or ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead>Trader Identity</TableHead>
                                    <TableHead>Classification</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Balance</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={6} className="text-center py-20"><RefreshCw className="h-8 w-8 animate-spin mx-auto opacity-20" /></TableCell></TableRow>
                                ) : filteredTraders.length > 0 ? (
                                    filteredTraders.map((trader) => (
                                        <TableRow key={trader.id} className={cn("hover:bg-muted/30 transition-colors", trader.is_hidden && "bg-primary/5")}>
                                            <TableCell className="font-medium">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-slate-900">{trader.full_name || 'Anonymous User'}</span>
                                                    <span className="text-[10px] font-bold text-primary lowercase mt-0.5">{trader.email}</span>
                                                    {!trader.is_active && trader.latest_breach_reason && (
                                                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-rose-500 font-bold bg-rose-500/5 px-2 py-0.5 rounded-md w-fit border border-rose-500/10">
                                                            <ShieldAlert className="h-3 w-3" />
                                                            <span>{trader.latest_breach_reason}</span>
                                                        </div>
                                                    )}
                                                    <span className="text-[9px] text-muted-foreground font-mono mt-1 opacity-50 uppercase tracking-tighter">ID: {trader.id.slice(0, 8)}...</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {getClassificationBadge(trader.account_classification) || <span className="text-xs text-muted-foreground opacity-30">N/A</span>}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={trader.role === 'admin' ? 'destructive' : 'secondary'} className="capitalize text-[10px] h-5">
                                                    {trader.role}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-semibold text-primary">
                                                {formatCurrency(trader.cash_balance)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={trader.is_active ? 'default' : 'destructive'} className="h-5">
                                                    {trader.is_active ? 'ACTIVE' : 'INACTIVE'}
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
                                                            "h-8 px-2 text-[10px] uppercase font-bold",
                                                            trader.is_active ? "text-rose-500 hover:text-rose-600 hover:bg-rose-50" : "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50"
                                                        )}
                                                    >
                                                        {trader.is_active ? <UserX className="h-3.5 w-3.5 mr-1" /> : <UserCheck className="h-3.5 w-3.5 mr-1" />}
                                                        {trader.is_active ? 'Disable' : 'Enable'}
                                                    </Button>
                                                    <Button variant="outline" size="sm" className="h-8 w-8 p-0" asChild>
                                                        <Link href={`/admin/users/${trader.id}`}><ExternalLink className="h-3.5 w-3.5" /></Link>
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground">No matching profiles found.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default function TradersPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>}>
            <TradersContent />
        </Suspense>
    );
}
