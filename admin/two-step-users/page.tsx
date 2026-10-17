'use client';

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Search, ExternalLink, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * @fileOverview 2-Step Spectrum Directory v3.1
 * Refined High-Contrast UI.
 */

function TwoStepUsersContent() {
    const [profiles, setProfiles] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const searchParams = useSearchParams();
    const isMasterView = searchParams.get('master_view') === 'TRUE';

    const fetchProfiles = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            setProfiles(data || []);
        } catch (error) {
            console.error('Error fetching profiles:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProfiles();
    }, []);

    const filteredProfiles = useMemo(() => {
        const allowed = ['two_step_phase_1', 'two_step_phase_2', 'two_step_live'];
        return profiles
            .filter(p => allowed.includes(p.account_classification || ''))
            .filter(p => isMasterView ? p.is_hidden : !p.is_hidden)
            .filter(p => 
                (p.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.id || '').toLowerCase().includes(searchQuery.toLowerCase())
            );
    }, [profiles, isMasterView, searchQuery]);

    return (
        <div className="space-y-10 animate-in fade-in duration-1000">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-8 border-b border-slate-200">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-4xl font-black tracking-tighter font-headline text-slate-900 uppercase">
                            {isMasterView ? 'Ghost 2-Step' : '2-Step Spectrum'}
                        </h1>
                        <Badge className="bg-purple-100 text-[#5D2D91] font-black text-[9px] px-3 py-1 rounded-full uppercase border-none">Premium Evaluation</Badge>
                    </div>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Tracking all 2-Step identities across multi-phase evaluation.</p>
                </div>
                <Button onClick={fetchProfiles} className="h-12 px-6 rounded-xl bg-white border border-slate-200 text-slate-900 font-black text-[10px] uppercase tracking-widest shadow-sm hover:bg-slate-50 transition-all" disabled={isLoading}>
                    <RefreshCw className={cn("h-3.5 w-3.5 mr-2.5", isLoading && "animate-spin")} />
                    Sync Ledger
                </Button>
            </header>

            <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden">
                <div className="p-8 border-b border-slate-50 bg-slate-50/30">
                    <div className="relative w-full max-w-md group">
                        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-300 group-focus-within:text-[#5D2D91] transition-colors" />
                        <Input
                            placeholder="Filter ID or Name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-12 h-14 bg-white border-slate-200 rounded-2xl text-sm font-bold text-slate-900 focus:ring-primary/10"
                        />
                    </div>
                </div>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow className="border-slate-100">
                                    <TableHead className="w-[150px] text-[10px] font-black uppercase tracking-widest text-slate-400 pl-8">ID (UUID)</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full Name</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phase</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400 pr-8">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={5} className="text-center py-32"><Loader2 className="h-10 w-10 animate-spin mx-auto text-primary opacity-20" /></TableCell></TableRow>
                                ) : filteredProfiles.length > 0 ? (
                                    filteredProfiles.map((p) => (
                                        <TableRow key={p.id} className="hover:bg-slate-50/50 border-slate-50 transition-colors">
                                            <TableCell className="font-mono text-[10px] text-slate-400 py-6 pl-8">{p.id.slice(0, 8)}...</TableCell>
                                            <TableCell className="font-black text-slate-800 text-sm uppercase">{p.full_name || 'N/A'}</TableCell>
                                            <TableCell>
                                                <Badge className="text-[9px] font-black uppercase tracking-widest px-3 border-none bg-purple-50 text-[#5D2D91]">
                                                    {p.account_classification?.replace(/_/g, ' ')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={cn(
                                                    "text-[9px] font-black px-3 py-1 rounded-md border-none uppercase",
                                                    p.is_active ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                                                )}>
                                                    {p.is_active ? 'ACTIVE' : 'RESTRICTED'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right pr-8">
                                                <Button variant="ghost" size="sm" asChild className="h-10 w-10 p-0 rounded-xl hover:bg-slate-100 hover:text-primary transition-all">
                                                    <Link href={`/admin/users/${p.id}`}><ExternalLink className="h-4 w-4" /></Link>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={5} className="text-center py-32 text-slate-300 text-[10px] font-black uppercase tracking-[0.3em] opacity-40">No profiles detected in this scope.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default function TwoStepUsersPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>}>
            <TwoStepUsersContent />
        </Suspense>
    );
}
