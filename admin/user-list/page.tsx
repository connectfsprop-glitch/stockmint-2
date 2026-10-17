'use client';

import React, { useEffect, useState, useMemo, Suspense, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Search, ExternalLink, Loader2, ListFilter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { getTradersList } from '@/app/actions/get-traders-list';

/**
 * @fileOverview User List - Character Match Discovery
 */

function UserListContent() {
    const [profiles, setProfiles] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const searchParams = useSearchParams();
    const isMasterView = searchParams.get('master_view') === 'TRUE';

    const [selectedMarket, setSelectedMarket] = useState('indian');

    const fetchProfiles = useCallback(async () => {
        setIsLoading(true);
        try {
            const result = await getTradersList();
            if (result.success) {
                setProfiles(result.data || []);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Error fetching global identity sync:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const saved = localStorage.getItem('admin_market_view');
        if (saved) setSelectedMarket(saved);
        fetchProfiles();
    }, [fetchProfiles]);

    const filteredProfiles = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        
        if (query === '') {
            return profiles.filter(p => {
                if (p.market_type !== selectedMarket) return false;
                const visibilityMatch = isMasterView ? p.is_hidden : !p.is_hidden;
                if (!visibilityMatch) return false;
                if (statusFilter !== 'all') {
                    const isActive = statusFilter === 'active';
                    if (p.is_active !== isActive) return false;
                }
                return true;
            });
        }

        const queryWords = query.split(/\s+/).filter(Boolean);
        return profiles.filter(p => {
            const searchPool = [
                p.full_name,
                p.email,
                p.id,
                p.account_classification,
                p.market_type,
                p.account_model,
                p.role
            ].map(f => String(f || '').toLowerCase());

            return queryWords.every(word => 
                searchPool.some(field => field.includes(word))
            );
        });
    }, [profiles, isMasterView, searchQuery, selectedMarket, statusFilter]);

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-8 animate-in fade-in duration-1000">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-black tracking-tight font-headline text-slate-900">
                        {isMasterView ? 'Ghost Registry' : 'User List'}
                    </h1>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
                        {selectedMarket} tools • Active scan
                    </p>
                </div>
                <Button 
                    onClick={fetchProfiles} 
                    className="h-12 px-6 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all font-black text-[10px] uppercase tracking-widest shadow-sm"
                    disabled={isLoading}
                >
                    <RefreshCw className={cn("h-4 w-4 mr-3", isLoading && "animate-spin")} />
                    Sync List
                </Button>
            </header>

            <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden">
                <CardHeader className="border-b border-slate-50 bg-slate-50/30 p-8">
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between w-full">
                        <div className="relative w-full max-w-md group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                            <Input
                                placeholder="Search by name, email, or ID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-12 h-14 bg-white border-slate-200 rounded-2xl text-sm font-bold text-slate-900 focus:ring-primary/10 shadow-inner placeholder:text-slate-300"
                            />
                        </div>

                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="flex items-center gap-2 bg-white px-4 h-14 rounded-2xl border border-slate-200 shadow-sm min-w-[200px]">
                                <ListFilter className="h-4 w-4 text-slate-400" />
                                <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                                    <SelectTrigger className="border-none bg-transparent shadow-none focus:ring-0 h-full p-0 font-bold text-[10px] uppercase tracking-widest text-slate-600">
                                        <SelectValue placeholder="Status Filter" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-slate-100 shadow-2xl">
                                        <SelectItem value="all" className="text-[10px] font-bold uppercase tracking-widest">All Status</SelectItem>
                                        <SelectItem value="active" className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Active Only</SelectItem>
                                        <SelectItem value="inactive" className="text-[10px] font-bold uppercase tracking-widest text-rose-600">Restricted Only</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow className="border-slate-100">
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-8">ID</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Identity</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Classification</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Market</TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400 pr-8">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-24">
                                            <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary opacity-20" />
                                        </TableCell>
                                    </TableRow>
                                ) : filteredProfiles.length > 0 ? (
                                    filteredProfiles.map((p) => (
                                        <TableRow key={p.id} className="hover:bg-slate-50/50 border-slate-50 transition-colors">
                                            <TableCell className="font-mono text-[10px] text-slate-400 py-6 pl-8">
                                                {p.id.slice(0, 8)}...
                                            </TableCell>
                                            <TableCell className="font-black text-slate-800 uppercase text-sm">
                                                <div>
                                                    <p>{p.full_name || 'N/A'}</p>
                                                    <p className="text-[9px] font-bold text-slate-400 lowercase tracking-normal">{p.email}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={cn(
                                                    "text-[9px] font-black px-3 py-1 rounded-md border-none uppercase",
                                                    p.is_active ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                                                )}>
                                                    {p.is_active ? 'Active' : 'Restricted'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                                                {p.account_classification?.replace(/_/g, ' ') || '-'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-[9px] border-slate-200 text-slate-400 font-bold uppercase">
                                                    {p.market_type}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right pr-8">
                                                <Button variant="ghost" size="sm" asChild className="h-10 w-10 p-0 rounded-xl hover:bg-slate-100 hover:text-primary transition-all">
                                                    <Link href={`/admin/users/${p.id}`}>
                                                        <ExternalLink className="h-4 w-4" />
                                                    </Link>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-32 text-slate-300 text-[10px] font-black uppercase opacity-40 tracking-[0.3em]">
                                            Identity not found.
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

export default function UserListPage() {
    return (
        <Suspense fallback={<div className="p-8"><RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary opacity-20" /></div>}>
            <UserListContent />
        </Suspense>
    );
}