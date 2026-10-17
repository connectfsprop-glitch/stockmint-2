'use client';

import { useState, useEffect, useTransition, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowDown, ArrowUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { getTradersList } from '@/app/actions/get-traders-list';

/**
 * @fileOverview Institutional Admin Dashboard v4.5
 * Identity Mapping: Uses getTradersList to resolve emails without bad SQL joins.
 * Stability: Fixes "column profiles.email does not exist" error.
 */

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

function DepositRequestsList({ userMap }: { userMap: Map<string, string> }) {
  const { toast } = useToast();
  const [requests, setRequests] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    // STABLE JOIN: Only fetch existing column full_name
    const { data, error } = await supabase
      .from('deposit_requests')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false });

    if (error) {
        console.error("Dashboard Fetch Error:", error.message);
        setRequests([]);
    } else {
        setRequests(data || []);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const filtered = useMemo(() => {
      if (statusFilter === 'ALL') return requests;
      return requests.filter(r => r.status === statusFilter);
  }, [requests, statusFilter]);

  const handleUpdateStatus = (requestId: number, newStatus: 'APPROVED' | 'REJECTED') => {
    startTransition(async () => {
        if (newStatus === 'APPROVED') {
            const req = requests.find(r => r.id === requestId);
            if (req) {
                const { error: rpcError } = await supabase.rpc('add_user_balance', {
                    user_id_input: req.user_id,
                    amount_to_add: req.amount
                });
                if (rpcError) {
                    toast({ variant: 'destructive', title: 'Balance update failed', description: rpcError.message });
                    return;
                }
            }
        }
        await supabase.from('deposit_requests').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', requestId);
        toast({ title: "Status updated", description: `Request ${newStatus.toLowerCase()} successfully.` });
        fetchRequests();
    });
  }
  
  return (
    <Card className="rounded-[2rem] border-none shadow-xl bg-white overflow-hidden">
      <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between">
        <div>
            <CardTitle className="flex items-center gap-3 text-2xl font-black text-slate-800 tracking-tighter font-headline">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                    <ArrowUp className="text-emerald-500 h-5 w-5"/>
                </div>
                Deposit requests
            </CardTitle>
            <CardDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Verify incoming capital</CardDescription>
        </div>
        <div className="w-48">
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-none font-bold text-[10px] uppercase">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                    <SelectItem value="ALL">ALL STATUS</SelectItem>
                    <SelectItem value="PENDING">PENDING</SelectItem>
                    <SelectItem value="APPROVED">APPROVED</SelectItem>
                    <SelectItem value="REJECTED">REJECTED</SelectItem>
                </SelectContent>
            </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? <div className="p-20 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto opacity-10" /></div> : filtered.length === 0 ? (
           <div className="py-20 text-center opacity-20"><p className="text-[10px] font-black uppercase tracking-[0.2em]">Queue clear</p></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
                <TableHeader className="bg-slate-50/50">
                    <TableRow className="border-slate-50">
                        <TableHead className="text-[9px] font-black uppercase tracking-widest pl-8">Trader identity</TableHead>
                        <TableHead className="text-[9px] font-black uppercase tracking-widest">Amount</TableHead>
                        <TableHead className="text-[9px] font-black uppercase tracking-widest">Status</TableHead>
                        <TableHead className="text-right text-[9px] font-black uppercase tracking-widest pr-8">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                {filtered.map((req) => (
                    <TableRow key={req.id} className="border-slate-50 hover:bg-slate-50/30 transition-colors group">
                    <TableCell className="pl-8 py-5">
                        <div className="font-black text-slate-900 uppercase text-sm tracking-tight">{req.profiles?.full_name || 'Anonymous User'}</div>
                        <div className="text-[10px] font-bold text-primary lowercase mt-0.5 opacity-80">
                            {userMap.get(req.user_id) || 'Sync Pending'}
                        </div>
                        <div className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-1">{new Date(req.created_at).toLocaleString()}</div>
                    </TableCell>
                    <TableCell className="font-black text-[#5D2D91]">{formatCurrency(req.amount)}</TableCell>
                    <TableCell>
                        <Badge className={cn(
                            "text-[8px] font-black py-0 px-2 rounded-md border-none",
                            req.status === 'APPROVED' ? "bg-emerald-50 text-emerald-600" : 
                            req.status === 'PENDING' ? "bg-amber-50 text-amber-600" : 
                            "bg-rose-50 text-rose-600"
                        )}>{req.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                        {req.status === 'PENDING' && (
                            <div className='flex gap-2 justify-end'>
                                <Button size="sm" variant="ghost" onClick={() => handleUpdateStatus(req.id, 'REJECTED')} disabled={isPending} className="h-9 px-4 rounded-xl text-rose-600 hover:bg-rose-50 font-bold text-[10px] uppercase">Reject</Button>
                                <Button size="sm" onClick={() => handleUpdateStatus(req.id, 'APPROVED')} disabled={isPending} className="h-9 px-4 rounded-xl bg-[#5D2D91] text-white font-black text-[10px] uppercase">Approve</Button>
                            </div>
                        )}
                    </TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function WithdrawalRequestsList({ userMap }: { userMap: Map<string, string> }) {
  const { toast } = useToast();
  const [requests, setRequests] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    // STABLE JOIN: No bad columns
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false });

    if (error) {
        console.error("Withdrawal Fetch Error:", error.message);
        setRequests([]);
    } else {
        setRequests(data || []);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const filtered = useMemo(() => {
      if (statusFilter === 'ALL') return requests;
      return requests.filter(r => r.status === statusFilter);
  }, [requests, statusFilter]);

  const handleUpdateStatus = (requestId: number, newStatus: 'APPROVED' | 'REJECTED') => {
    startTransition(async () => {
        const req = requests.find(r => r.id === requestId);
        if (!req) return;
        if (newStatus === 'APPROVED') {
            const { data: portfolio } = await supabase.from('portfolios').select('cash_balance').eq('user_id', req.user_id).single();
            if (!portfolio || portfolio.cash_balance < req.amount) {
                toast({ variant: 'destructive', title: 'Insufficient funds', description: 'User does not have enough balance.' });
                return;
            }
            await supabase.from('portfolios').update({ cash_balance: portfolio.cash_balance - req.amount }).eq('user_id', req.user_id);
        }
        await supabase.from('withdrawal_requests').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', requestId);
        toast({ title: "Status updated", description: `Request ${newStatus.toLowerCase()} successfully.` });
        fetchRequests();
    });
  }
  
  return (
    <Card className="rounded-[2rem] border-none shadow-xl bg-white overflow-hidden">
      <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between">
        <div>
            <CardTitle className="flex items-center gap-3 text-2xl font-black text-slate-800 tracking-tighter font-headline">
                <div className="h-10 w-10 rounded-xl bg-rose-50 flex items-center justify-center">
                    <ArrowDown className="text-rose-500 h-5 w-5"/>
                </div>
                Withdrawal requests
            </CardTitle>
            <CardDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Audit payouts</CardDescription>
        </div>
        <div className="w-48">
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-none font-bold text-[10px] uppercase">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                    <SelectItem value="ALL">ALL STATUS</SelectItem>
                    <SelectItem value="PENDING">PENDING</SelectItem>
                    <SelectItem value="APPROVED">APPROVED</SelectItem>
                    <SelectItem value="REJECTED">REJECTED</SelectItem>
                </SelectContent>
            </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? <div className="p-20 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto opacity-10" /></div> : filtered.length === 0 ? (
           <div className="py-20 text-center opacity-20"><p className="text-[10px] font-black uppercase tracking-[0.2em]">Queue clear</p></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
                <TableHeader className="bg-slate-50/50">
                    <TableRow className="border-slate-50">
                        <TableHead className="text-[9px] font-black uppercase tracking-widest pl-8">Trader identity</TableHead>
                        <TableHead className="text-[9px] font-black uppercase tracking-widest">Amount</TableHead>
                        <TableHead className="text-[9px] font-black uppercase tracking-widest">Status</TableHead>
                        <TableHead className="text-right text-[9px] font-black uppercase tracking-widest pr-8">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                {filtered.map((req) => (
                    <TableRow key={req.id} className="border-slate-50 hover:bg-slate-50/30 transition-colors group">
                    <TableCell className="pl-8 py-5">
                        <div className="font-black text-slate-900 uppercase text-sm tracking-tight">{req.profiles?.full_name || 'Anonymous User'}</div>
                        <div className="text-[10px] font-bold text-primary lowercase mt-0.5 opacity-80">
                            {userMap.get(req.user_id) || 'Sync Pending'}
                        </div>
                        <div className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-1">{new Date(req.created_at).toLocaleString()}</div>
                    </TableCell>
                    <TableCell className="font-black text-rose-600">{formatCurrency(req.amount)}</TableCell>
                    <TableCell>
                        <Badge className={cn(
                            "text-[8px] font-black py-0 px-2 rounded-md border-none",
                            req.status === 'APPROVED' ? "bg-emerald-50 text-emerald-600" : 
                            req.status === 'PENDING' ? "bg-amber-50 text-amber-600" : 
                            "bg-rose-50 text-rose-600"
                        )}>{req.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                        {req.status === 'PENDING' && (
                            <div className='flex gap-2 justify-end'>
                                <Button size="sm" variant="ghost" onClick={() => handleUpdateStatus(req.id, 'REJECTED')} disabled={isPending} className="h-9 px-4 rounded-xl text-rose-600 hover:bg-rose-50 font-bold text-[10px] uppercase">Reject</Button>
                                <Button size="sm" onClick={() => handleUpdateStatus(req.id, 'APPROVED')} disabled={isPending} className="h-9 px-4 rounded-xl bg-[#5D2D91] text-white font-black text-[10px] uppercase">Approve</Button>
                            </div>
                        )}
                    </TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function AdminPage() {
  const [userMap, setUserMap] = useState<Map<string, string>>(new Map());
  const [isSyncing, setIsSyncing] = useState(true);

  // AUTH SYNC PROTOCOL: Fetch emails from server source
  useEffect(() => {
    const syncIdentity = async () => {
        setIsSyncing(true);
        const result = await getTradersList();
        if (result.success) {
            const map = new Map<string, string>();
            result.data.forEach((u: any) => map.set(u.id, u.email));
            setUserMap(map);
        }
        setIsSyncing(false);
    };
    syncIdentity();
  }, []);

  return (
    <div className="space-y-10 animate-in fade-in duration-1000">
      <header className="space-y-1">
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter font-headline uppercase">Admin dashboard</h1>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">System-wide overview and pending actions</p>
      </header>

       <Tabs defaultValue="deposits" className="w-full">
        <TabsList className="bg-white p-1 rounded-2xl h-14 mb-8 border border-slate-200 shadow-sm w-full md:w-auto flex">
          <TabsTrigger value="deposits" className="flex-1 md:flex-none rounded-xl px-8 h-full font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-[#5D2D91] data-[state=active]:text-white data-[state=active]:shadow-lg transition-all">Deposits</TabsTrigger>
          <TabsTrigger value="withdrawals" className="flex-1 md:flex-none rounded-xl px-8 h-full font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-[#5D2D91] data-[state=active]:text-white data-[state=active]:shadow-lg transition-all">Withdrawals</TabsTrigger>
        </TabsList>
        <TabsContent value="deposits" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <DepositRequestsList userMap={userMap} />
        </TabsContent>
        <TabsContent value="withdrawals" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <WithdrawalRequestsList userMap={userMap} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
