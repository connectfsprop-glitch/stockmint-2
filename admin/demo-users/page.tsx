'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Search, ExternalLink, Loader2, Phone, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

/**
 * @fileOverview Dedicated Demo Terminal
 * Isolated management for landing page signups.
 */

export default function DemoUsersPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchDemoUsers = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('demo_users')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            setUsers(data || []);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDemoUsers();
    }, []);

    const filteredUsers = useMemo(() => {
        return users.filter(u => 
            (u.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (u.whatsapp_number || '').toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [users, searchQuery]);

    return (
        <div className="space-y-10 animate-in fade-in duration-1000">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-8 border-b border-slate-200">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-black tracking-tighter font-headline text-slate-900">Demo ledger</h1>
                        <Badge className="bg-amber-100 text-amber-700 font-bold text-[10px] px-3 py-1 rounded-full border-none">30h limit</Badge>
                    </div>
                    <p className="text-slate-400 text-xs font-bold mt-1">Direct website registrations.</p>
                </div>
                <Button onClick={fetchDemoUsers} className="h-12 px-6 rounded-xl bg-white border border-slate-200 text-slate-900 font-bold text-[10px] shadow-sm hover:bg-slate-50 transition-all" disabled={isLoading}>
                    <RefreshCw className={cn("h-3.5 w-3.5 mr-2.5", isLoading && "animate-spin")} />
                    Update sync
                </Button>
            </header>

            <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden">
                <div className="p-8 border-b border-slate-50 bg-slate-50/30">
                    <div className="relative w-full max-w-md group">
                        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="Filter by name, email or whatsapp..."
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
                                    <TableHead className="text-[10px] font-bold text-slate-400 pl-8">Identity</TableHead>
                                    <TableHead className="text-[10px] font-bold text-slate-400">Communication</TableHead>
                                    <TableHead className="text-[10px] font-bold text-slate-400">Time limit</TableHead>
                                    <TableHead className="text-right text-[10px] font-bold text-slate-400 pr-8">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={4} className="text-center py-32"><Loader2 className="h-10 w-10 animate-spin mx-auto text-primary opacity-20" /></TableCell></TableRow>
                                ) : filteredUsers.length > 0 ? (
                                    filteredUsers.map((u) => {
                                        const expiry = new Date(u.expiry_at);
                                        const isExpired = expiry < new Date();

                                        return (
                                            <TableRow key={u.id} className="hover:bg-slate-50/50 border-slate-50 transition-colors">
                                                <TableCell className="py-6 pl-8">
                                                    <p className="font-black text-slate-800 text-sm">{u.full_name}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 lowercase">{u.email}</p>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <a href={`https://wa.me/${u.whatsapp_number.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer" className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 hover:bg-emerald-100 transition-colors">
                                                            <Phone className="h-4 w-4" />
                                                        </a>
                                                        <span className="text-xs font-bold text-slate-700">{u.whatsapp_number}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1">
                                                        <Badge className={cn(
                                                            "text-[9px] font-black px-2 py-0.5 rounded-md border-none w-fit",
                                                            isExpired ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                                                        )}>
                                                            {isExpired ? 'Expired' : 'Active'}
                                                        </Badge>
                                                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                                            <Clock className="h-3 w-3" />
                                                            {formatDistanceToNow(expiry, { addSuffix: true })}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right pr-8">
                                                    <Button variant="ghost" size="sm" asChild className="h-10 w-10 p-0 rounded-xl hover:bg-slate-100 hover:text-primary transition-all">
                                                        <Link href={`/admin/users/${u.user_id}`}><ExternalLink className="h-4 w-4" /></Link>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow><TableCell colSpan={4} className="text-center py-32 text-slate-300 text-[10px] font-bold opacity-40">No demo registrations found.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}