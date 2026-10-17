
'use client';

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, RefreshCw, ExternalLink, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

/**
 * @fileOverview VIOLATION LEDGER (STEALTH ENABLED)
 * Independent terminal for tracking platform violations.
 * Synchronized with the Absolute Stealth Protocol.
 */

function BreachLogContent() {
    const [breaches, setBreaches] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const searchParams = useSearchParams();
    const isMasterView = searchParams.get('master_view') === 'TRUE';

    const fetchBreaches = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    id,
                    created_at,
                    breach_reason,
                    user_id,
                    symbol,
                    profiles (
                        full_name,
                        is_hidden
                    )
                `)
                .not('breach_reason', 'is', null)
                .neq('breach_reason', '')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setBreaches(data || []);
        } catch (error) {
            console.error('Error fetching violation ledger:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchBreaches();
    }, []);

    const filteredBreaches = useMemo(() => {
        return breaches
            .filter(breach => {
                const isUserHidden = breach.profiles?.is_hidden || false;
                // Mutual Exclusion: Master View shows ONLY hidden; Normal View shows ONLY visible
                return isMasterView ? isUserHidden : !isUserHidden;
            })
            .filter(breach => {
                if (!searchQuery) return true;
                const query = searchQuery.toLowerCase();
                const nameMatch = (breach.profiles?.full_name || '').toLowerCase().includes(query);
                const idMatch = (breach.user_id || '').toLowerCase().includes(query);
                return nameMatch || idMatch;
            });
    }, [breaches, isMasterView, searchQuery]);

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight font-headline text-foreground">
                        {isMasterView ? 'Ghost Violations' : 'Violation Ledger'}
                    </h1>
                    <p className="text-muted-foreground">
                        {isMasterView 
                            ? 'Exclusive history of violation logs for administrative ghost accounts.' 
                            : 'Chronological audit trail of all platform-wide risk limit violations.'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative w-64 group">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input 
                            placeholder="Search Trader Identity..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-9 text-xs font-bold bg-muted/50 border-white/5 rounded-xl"
                        />
                    </div>
                    <Button onClick={fetchBreaches} variant="outline" size="sm" disabled={isLoading} className="h-9 rounded-xl">
                        <RefreshCw className={isLoading ? "h-4 w-4 mr-2 animate-spin" : "h-4 w-4 mr-2"} />
                        Sync Ledger
                    </Button>
                </div>
            </header>

            <Card className="border-rose-500/10 shadow-lg bg-card">
                <CardHeader className="bg-rose-500/[0.02] border-b border-rose-500/10">
                    <CardTitle className="flex items-center gap-2 text-rose-500">
                        <ShieldAlert className="h-5 w-5" />
                        Execution Violations
                    </CardTitle>
                    <CardDescription>
                        Direct audit of the execution ledger where violation reasons are recorded.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="w-[180px]">Timestamp</TableHead>
                                    <TableHead>Trader Identity</TableHead>
                                    <TableHead>Violation Reason</TableHead>
                                    <TableHead>Trigger</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-24">
                                            <RefreshCw className="h-10 w-10 animate-spin mx-auto opacity-10" />
                                        </TableCell>
                                    </TableRow>
                                ) : filteredBreaches.length > 0 ? (
                                    filteredBreaches.map((breach) => (
                                        <TableRow key={breach.id} className="hover:bg-muted/30 transition-colors group">
                                            <TableCell className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">
                                                {new Date(breach.created_at).toLocaleString()}
                                            </TableCell>
                                            <TableCell className="font-bold text-foreground">
                                                {breach.profiles?.full_name || 'Anonymous User'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="max-w-md">
                                                    <p className="text-xs font-black text-rose-500 leading-relaxed uppercase tracking-tight">
                                                        {breach.breach_reason}
                                                    </p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="bg-white/5 border-white/10 text-[9px] font-black px-2">
                                                    {breach.symbol || 'SYSTEM'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" asChild className="h-8 px-2 text-[10px] font-black uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Link href={`/admin/users/${breach.user_id}`}>
                                                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                                                        Inspect Profile
                                                    </Link>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-32 text-muted-foreground text-[10px] uppercase font-black opacity-20 tracking-[0.2em]">
                                            No violations recorded in this view scope.
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

export default function BreachLogPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center"><RefreshCw className="h-8 w-8 animate-spin mx-auto opacity-20" /></div>}>
            <BreachLogContent />
        </Suspense>
    );
}
