
'use client';

import React, { useState, useEffect, useCallback, useMemo, useTransition } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useParams, notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { 
    Loader2, RotateCcw, ShieldAlert, AlertTriangle, Coins, 
    ArrowUpRight, UserCircle, Shield, CheckCircle2, XCircle,
    ArrowDown, ArrowUp, Download, User, Zap, Edit2
} from 'lucide-react';
import { formatSimpleInstrumentName } from '@/lib/format-instrument';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { EditUserSettingsSheet } from './edit-user-settings-sheet';
import { EditDetailsSheet } from './edit-details-sheet';
import { EditTradeDialog } from './edit-trade-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { updateUserClassification } from '@/app/actions/update-user-classification';
import { updateUserStatus } from '@/app/actions/update-user-status';
import { resetUserAccount } from '@/app/actions/reset-user-account';
import { updateUserPortfolio } from '@/app/actions/update-user-portfolio';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

type UserProfile = {
    id: string;
    full_name: string | null;
    email: string | null;
    role: 'student' | 'mentor' | 'admin';
    is_active: boolean;
    loss_limit_percentage: number;
    daily_loss_limit_percentage: number;
    per_trade_loss_limit_percentage: number;
    assigned_mentor_id: string | null;
    account_classification: string | null;
};

const formatCurrency = (value: number | null | undefined) => {
    if (value === null || typeof value === 'undefined' || isNaN(value)) return '₹0.00';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Math.abs(value));
};

function UserHistory({ userId, type, onRefresh }: { userId: string, type: 'orders' | 'trades', onRefresh?: () => void }) {
    const [data, setData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingTrade, setEditingTrade] = useState<any>(null);
    const [isEditTradeOpen, setIsEditTradeOpen] = useState(false);
    
    const fetch = useCallback(async () => {
        setIsLoading(true);
        let q = supabase.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        if (type === 'trades') q = q.eq('status', 'COMPLETED').not('pnl', 'is', null);
        const { data: res } = await q;
        setData(res || []);
        setIsLoading(false);
    }, [userId, type]);

    useEffect(() => {
        fetch();
    }, [fetch]);

    const calculateEntryPrice = (item: any) => {
        if (item.pnl === null || !item.quantity) return 0;
        return item.order_type === 'SELL' 
            ? item.price - (item.pnl / item.quantity)
            : item.price + (item.pnl / item.quantity);
    };

    const getStatusBadge = (item: any) => {
        const isBreach = item.breach_reason && item.breach_reason !== '' && !item.breach_reason.includes('System');
        const isAuto = item.breach_reason?.includes('System');

        if (isBreach) {
            return (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Badge variant="destructive" className="gap-1 px-2 font-black text-[9px]">
                                <Shield className="h-3 w-3" />
                                BREACH
                            </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="bg-rose-500 text-white border-none font-bold text-[10px]">
                            {item.breach_reason}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            );
        }

        if (item.status === 'COMPLETED') {
            const label = isAuto ? (item.breach_reason?.includes('TP') ? 'TP Hit' : 'SL Hit') : 'Settled';
            return (
                <Badge variant="outline" className={cn(
                    "text-[9px] font-black border-none px-2 uppercase",
                    isAuto ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"
                )}>
                    {isAuto && <Zap className="h-2 w-2 mr-1 fill-amber-600" />}
                    {!isAuto && <User className="h-2 w-2 mr-1" />}
                    {label}
                </Badge>
            );
        }

        return (
            <Badge variant="outline" className="text-[9px] font-black border-none px-2 uppercase bg-slate-50 text-slate-400">
                {item.status}
            </Badge>
        );
    };

    return (
        <>
            <EditTradeDialog 
                isOpen={isEditTradeOpen} 
                onOpenChange={setIsEditTradeOpen} 
                trade={editingTrade} 
                onSaved={() => {
                    fetch();
                    if (onRefresh) onRefresh();
                }} 
            />
            <Table>
                <TableHeader className="bg-slate-50/50">
                    <TableRow className="border-slate-100">
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Instrument</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Type</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Qty</TableHead>
                        {type === 'trades' ? (
                            <>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Entry</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Exit</TableHead>
                            </>
                        ) : (
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Price</TableHead>
                        )}
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">P&L</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Settlement</TableHead>
                        <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Date</TableHead>
                        {type === 'trades' && <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Actions</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? <TableRow><TableCell colSpan={8} className="text-center py-10"><Loader2 className="animate-spin h-5 w-5 mx-auto text-primary opacity-20" /></TableCell></TableRow> : 
                        data.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-24 text-slate-300 font-black text-[10px] uppercase tracking-[0.2em] opacity-40">No activity detected</TableCell></TableRow> :
                        data.map(item => (
                        <TableRow key={item.id} className="border-slate-50 hover:bg-slate-50/30 transition-colors group">
                            <TableCell className="font-black text-slate-800 uppercase text-xs">{formatSimpleInstrumentName({ tradingsymbol: item.symbol })}</TableCell>
                            <TableCell>
                                <div className="flex items-center gap-1.5">
                                    {item.order_type === 'BUY' ? <ArrowUp className="h-3 w-3 text-blue-500" /> : <ArrowDown className="h-3 w-3 text-rose-500" />}
                                    <span className={cn("text-[10px] font-black uppercase", item.order_type === 'BUY' ? "text-blue-600" : "text-rose-600")}>
                                        {item.order_type}
                                    </span>
                                </div>
                            </TableCell>
                            <TableCell className="font-bold text-slate-600 text-xs">{item.quantity}</TableCell>
                            {type === 'trades' ? (
                                <>
                                    <TableCell className="font-bold text-slate-700 text-xs">{formatCurrency(calculateEntryPrice(item))}</TableCell>
                                    <TableCell className="font-bold text-slate-700 text-xs">{formatCurrency(item.price)}</TableCell>
                                </>
                            ) : (
                                <TableCell className="font-bold text-slate-700 text-xs">{formatCurrency(item.price)}</TableCell>
                            )}
                            <TableCell className={cn("font-black text-xs", (item.pnl ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600")}>
                                {item.pnl !== null ? formatCurrency(item.pnl) : '-'}
                            </TableCell>
                            <TableCell>{getStatusBadge(item)}</TableCell>
                            <TableCell className="text-right text-[10px] text-slate-400 font-bold uppercase">{new Date(item.created_at).toLocaleString()}</TableCell>
                            {type === 'trades' && (
                                <TableCell className="text-right">
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-primary/5 hover:text-primary"
                                        onClick={() => {
                                            setEditingTrade(item);
                                            setIsEditTradeOpen(true);
                                        }}
                                    >
                                        <Edit2 className="h-3.5 w-3.5" />
                                    </Button>
                                </TableCell>
                            )}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </>
    );
}

export default function UserDetailPage() {
    const params = useParams();
    const userId = params.userId as string;
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [portfolio, setPortfolio] = useState<any>(null);
    const [leverages, setLeverages] = useState<any>(null);
    const [audits, setAudits] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [isDetailsSheetOpen, setIsDetailsSheetOpen] = useState(false);
    const { toast } = useToast();

    // Status Toggle State
    const [isStatusPending, startStatusTransition] = useTransition();
    const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);
    const [deactivationReason, setDeactivationReason] = useState('');

    // Reset State
    const [isResetOpen, setIsResetOpen] = useState(false);
    const [resetBalance, setResetBalance] = useState('');
    const [resetHWM, setResetHWM] = useState('');
    const [isResetPending, startResetTransition] = useTransition();

    // Calibration State (Non-destructive)
    const [isCalibratePending, startCalibrateTransition] = useTransition();

    const fetchData = useCallback(async () => {
        if (!userId) return;
        setIsLoading(true);
        try {
            const [pRes, poRes, lRes, aRes] = await Promise.all([
                supabase.from('profiles').select('*').eq('id', userId).single(),
                supabase.from('portfolios').select('*').eq('user_id', userId).single(),
                supabase.from('leverages').select('*').eq('user_id', userId).single(),
                supabase.from('performance_audits').select('*').eq('user_id', userId).order('created_at', { ascending: false })
            ]);
            
            setProfile(pRes.data as UserProfile);
            setPortfolio(poRes.data);
            setLeverages(lRes.data);
            setAudits(aRes.data || []);
            
            if (poRes.data) {
                setResetBalance(poRes.data.cash_balance.toString());
                setResetHWM(poRes.data.high_water_mark.toString());
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }, [userId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleToggleStatus = async (newStatus: boolean) => {
        if (!newStatus) {
            setIsDeactivateOpen(true);
            return;
        }

        startStatusTransition(async () => {
            const result = await updateUserStatus(userId, true);
            if (result.success) {
                toast({ title: 'Terminal Activated', description: 'User access has been restored.' });
                fetchData();
            }
        });
    };

    const confirmDeactivation = async () => {
        if (!deactivationReason.trim()) {
            toast({ variant: 'destructive', title: 'Action Blocked', description: 'Please provide an institutional reason for deactivation.' });
            return;
        }

        startStatusTransition(async () => {
            const result = await updateUserStatus(userId, false);
            if (result.success) {
                await supabase.from('user_notifications').insert({
                    user_id: userId,
                    title: 'Terminal Restricted',
                    content: `Your trading access has been manually restricted. Reason: ${deactivationReason}`,
                    type: 'ERROR',
                    is_read: false
                });

                toast({ title: 'Terminal Restricted', description: 'Identity restricted and reason logged.' });
                setIsDeactivateOpen(false);
                setDeactivationReason('');
                fetchData();
            }
        });
    };

    const handleClassificationChange = async (newVal: string) => {
        const result = await updateUserClassification(userId, newVal === 'none' ? null : newVal);
        if (result.success) {
            toast({ title: 'Spectrum Updated', description: 'User classification successfully shifted.' });
            fetchData();
        }
    };

    const handleFactoryReset = async () => {
        if (!resetBalance || !resetHWM) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please provide valid balance values.' });
            return;
        }
        startResetTransition(async () => {
            const res = await resetUserAccount(userId, Number(resetBalance), Number(resetHWM));
            if (res.success) {
                toast({ title: 'Factory Reset Complete', description: 'Account history purged and re-calibrated.' });
                setIsResetOpen(false);
                fetchData();
            } else {
                toast({ variant: 'destructive', title: 'Reset Failed', description: res.message });
            }
        });
    };

    const handleCalibrate = async () => {
        if (!resetBalance || !resetHWM) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please provide valid values.' });
            return;
        }
        startCalibrateTransition(async () => {
            const res = await updateUserPortfolio(userId, Number(resetBalance), Number(resetHWM));
            if (res.success) {
                toast({ title: 'Capital Sync Complete', description: res.message });
                fetchData();
            } else {
                toast({ variant: 'destructive', title: 'Sync Failed', description: res.message });
            }
        });
    };

    const downloadReport = async () => {
        if (!profile) return;
        const doc = new jsPDF();
        const { data: orders } = await supabase.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        
        doc.setFontSize(18);
        doc.text("Institutional Execution Audit", 14, 22);
        doc.setFontSize(10);
        doc.text(`Trader: ${profile.full_name} | ID: ${profile.id}`, 14, 30);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 35);
        
        (doc as any).autoTable({
            head: [['Date', 'Instrument', 'Type', 'Qty', 'Price', 'Status', 'P&L', 'Source']],
            body: (orders || []).map(o => [
                new Date(o.created_at).toLocaleString(),
                o.symbol,
                o.order_type,
                o.quantity,
                formatCurrency(o.price),
                o.status,
                o.pnl ? formatCurrency(o.pnl) : '-',
                o.breach_reason?.includes('System') ? 'Engine' : 'Manual'
            ]),
            startY: 45,
            headStyles: { fillColor: [93, 45, 145] },
        });

        doc.save(`${profile.full_name}_audit_report.pdf`);
        toast({ title: "Report Ready", description: "The execution audit has been downloaded." });
    };

    if (isLoading) return <div className="p-8 space-y-4"><Skeleton className="h-20 w-1/3" /><Skeleton className="h-96 w-full" /></div>;
    if (!profile) return notFound();

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-8 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-slate-200">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-4xl font-black tracking-tight font-headline uppercase text-slate-900">{profile.full_name}</h1>
                        <Button variant="ghost" size="icon" onClick={downloadReport} title="Download Trade Report" className="h-10 w-10 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100">
                            <Download className="h-4 w-4 text-[#5D2D91]" />
                        </Button>
                    </div>
                    {profile.email && <p className="text-[11px] font-bold text-primary lowercase mt-1 opacity-70">{profile.email}</p>}
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">
                        <span className="text-primary mr-2">•</span>
                        ID: {profile.id.slice(0, 8)} • {profile.role}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={() => setIsDetailsSheetOpen(true)} className="rounded-xl border-slate-200 bg-white hover:bg-slate-50 font-black text-[10px] uppercase tracking-widest px-6 h-12 shadow-sm transition-all active:scale-95">
                        <UserCircle className="h-3.5 w-3.5 mr-2" />
                        Edit Identity
                    </Button>
                    <Button variant="outline" onClick={() => setIsSheetOpen(true)} className="rounded-xl border-slate-200 bg-white hover:bg-slate-50 font-black text-[10px] uppercase tracking-widest px-6 h-12 shadow-sm transition-all active:scale-95">
                        Edit Risk & Leverage
                    </Button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden">
                        <CardContent className="p-10 grid grid-cols-1 md:grid-cols-3 gap-10">
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Liquid alpha</p>
                                <p className="text-3xl font-black text-primary tracking-tighter">{formatCurrency(portfolio?.cash_balance)}</p>
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">High water mark</p>
                                <p className="text-3xl font-black text-slate-800 tracking-tighter">{formatCurrency(portfolio?.high_water_mark)}</p>
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Active phase</p>
                                <Badge className="uppercase font-black text-[10px] px-4 py-1.5 bg-slate-100 text-slate-600 border-none rounded-lg mt-1">
                                    {profile.account_classification?.replace(/_/g, ' ') || 'Evaluation'}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>

                    <Tabs defaultValue="orders" className="w-full">
                        <TabsList className="bg-slate-100 p-1 rounded-2xl h-14 border border-slate-200 w-full md:w-auto shadow-inner flex mb-8">
                            <TabsTrigger value="orders" className="flex-1 md:flex-none rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg px-8 transition-all">Order Ledger</TabsTrigger>
                            <TabsTrigger value="trades" className="flex-1 md:flex-none rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg px-8 transition-all">Trade Log</TabsTrigger>
                            <TabsTrigger value="performance" className="flex-1 md:flex-none rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg px-8 transition-all">AI Behavioral Trail</TabsTrigger>
                        </TabsList>
                        <TabsContent value="orders" className="mt-0"><Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden"><UserHistory userId={userId} type="orders" onRefresh={fetchData} /></Card></TabsContent>
                        <TabsContent value="trades" className="mt-0"><Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden"><UserHistory userId={userId} type="trades" onRefresh={fetchData} /></Card></TabsContent>
                        <TabsContent value="performance" className="mt-0">
                            <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-slate-50/50">
                                        <TableRow className="border-slate-100">
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Audit type</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Behavioral score</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</TableHead>
                                            <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Timestamp</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {audits.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-24 text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">No AI audits found</TableCell></TableRow> : audits.map(a => (
                                            <TableRow key={a.id} className="border-slate-50 hover:bg-slate-50/30 transition-all">
                                                <TableCell className="font-bold text-xs uppercase text-slate-800 tracking-tight">{a.audit_type.replace(/_/g, ' ')}</TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-xl font-black text-slate-900">{a.score}</span>
                                                        <span className="text-[8px] font-black text-slate-300">WEIGHTED 60%</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell><Badge variant={a.status === 'PASS' ? 'default' : 'destructive'} className="font-black text-[9px] px-3 py-1 rounded-md uppercase">{a.status}</Badge></TableCell>
                                                <TableCell className="text-right text-[10px] font-bold text-slate-400 uppercase">{new Date(a.created_at).toLocaleString()}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>

                <div className="space-y-8">
                    <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8">
                            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Manual Override</CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="space-y-0.5">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Terminal access</Label>
                                    <p className="text-xs font-bold text-slate-700">{profile.is_active ? 'Identity Active' : 'Identity Restricted'}</p>
                                </div>
                                <Switch 
                                    checked={profile.is_active} 
                                    onCheckedChange={handleToggleStatus}
                                    disabled={isStatusPending}
                                />
                            </div>

                            <Dialog open={isDeactivateOpen} onOpenChange={setIsDeactivateOpen}>
                                <DialogContent className="bg-white border-none rounded-[2rem] shadow-2xl p-8 max-w-md">
                                    <DialogHeader>
                                        <DialogTitle className="text-xl font-black text-slate-900 uppercase tracking-tighter">Restriction Logic</DialogTitle>
                                        <DialogDescription className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Specify violation reason</DialogDescription>
                                    </DialogHeader>
                                    <div className="py-6 space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-slate-400">Reason for deactivation</Label>
                                            <Input 
                                                placeholder="e.g. Unusual execution pattern detected" 
                                                value={deactivationReason}
                                                onChange={(e) => setDeactivationReason(e.target.value)}
                                                className="bg-slate-50 border-slate-100 rounded-xl h-12 font-bold focus:ring-rose-500/10"
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter className="flex-col gap-3">
                                        <Button variant="destructive" onClick={confirmDeactivation} disabled={isStatusPending} className="w-full h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl">
                                            {isStatusPending ? <Loader2 className="animate-spin h-4 w-4" /> : 'Confirm Restriction'}
                                        </Button>
                                        <Button variant="ghost" onClick={() => setIsDeactivateOpen(false)} className="w-full h-10 font-bold text-[10px] text-slate-400 uppercase">Abort</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>

                            <div className="space-y-3">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block ml-1">Account Classification</Label>
                                <Select defaultValue={profile.account_classification || 'none'} onValueChange={handleClassificationChange}>
                                    <SelectTrigger className="h-12 rounded-xl bg-white border-slate-200 font-bold uppercase text-[10px] tracking-widest text-slate-700 focus:ring-primary/20">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white border-slate-200 rounded-2xl shadow-2xl">
                                        <SelectItem value="none" className="text-[10px] font-bold uppercase">UNCLASSIFIED</SelectItem>
                                        <SelectItem value="passthenpay" className="text-[10px] font-bold uppercase">PASS THEN PAY</SelectItem>
                                        <SelectItem value="instant_live" className="text-[10px] font-bold uppercase">INSTANT LIVE</SelectItem>
                                        <SelectItem value="instant_pro" className="text-[10px] font-bold uppercase">INSTANT PRO</SelectItem>
                                        <SelectItem value="one_step_phase_1" className="text-[10px] font-bold uppercase">1-STEP PHASE 1</SelectItem>
                                        <SelectItem value="one_step_live" className="text-[10px] font-bold uppercase">1-STEP LIVE</SelectItem>
                                        <SelectItem value="two_step_phase_1" className="text-[10px] font-bold uppercase">2-STEP PHASE 1</SelectItem>
                                        <SelectItem value="two_step_phase_2" className="text-[10px] font-bold uppercase">2-STEP PHASE 2</SelectItem>
                                        <SelectItem value="two_step_live" className="text-[10px] font-bold uppercase">2-STEP LIVE</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-[2.5rem] border-amber-100 bg-white overflow-hidden shadow-xl border-2">
                        <CardHeader className="bg-amber-50/50 border-b border-amber-100 p-8">
                            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-amber-600">Capital Calibration</CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Update Balance (Non-destructive)</Label>
                                    <Input 
                                        type="number" 
                                        value={resetBalance} 
                                        onChange={e => setResetBalance(e.target.value)}
                                        className="bg-slate-50 border-slate-100 h-11 rounded-xl font-bold text-slate-900 focus:ring-amber-500/10"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Update HWM (Non-destructive)</Label>
                                    <Input 
                                        type="number" 
                                        value={resetHWM} 
                                        onChange={e => setResetHWM(e.target.value)}
                                        className="bg-slate-50 border-slate-100 h-11 rounded-xl font-bold text-slate-900 focus:ring-amber-500/10"
                                    />
                                </div>
                            </div>
                            <Button onClick={handleCalibrate} disabled={isCalibratePending} className="w-full h-14 rounded-xl bg-amber-500 text-black font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-amber-500/20 active:scale-95 transition-all">
                                {isCalibratePending ? <Loader2 className="animate-spin h-4 w-4" /> : <Coins className="h-4 w-4 mr-2.5" />}
                                Sync Capital
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="rounded-[2.5rem] border-rose-100 bg-white overflow-hidden shadow-xl border-2">
                        <CardHeader className="bg-rose-50/50 border-b border-rose-100 p-8">
                            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-rose-500">Institutional Reset</CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="destructive" className="w-full h-14 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-rose-500/20 active:scale-95 transition-all">
                                        <RotateCcw className="h-4 w-4 mr-2.5" />
                                        Factory Reset (Purge)
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="bg-white border-none rounded-[2.5rem] p-10 max-w-md shadow-2xl">
                                    <DialogHeader className="space-y-5">
                                        <div className="h-16 w-16 rounded-2xl bg-rose-50 flex items-center justify-center mx-auto border border-rose-100">
                                            <ShieldAlert className="h-8 w-8 text-rose-500" />
                                        </div>
                                        <DialogTitle className="text-2xl font-black text-slate-900 text-center uppercase tracking-tighter">Authorize Purge</DialogTitle>
                                        <DialogDescription className="text-center text-slate-500 font-bold text-[10px] uppercase leading-relaxed tracking-wider px-4">
                                            This action will permanently delete all trade history, AI audits, and logs. Account will be re-initialized at ₹{Number(resetBalance).toLocaleString()}.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="flex flex-col gap-4 mt-8">
                                        <Button variant="destructive" className="h-14 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl" onClick={handleFactoryReset} disabled={isResetPending}>
                                            {isResetPending ? <Loader2 className="animate-spin h-5 w-5" /> : 'Confirm Wipe'}
                                        </Button>
                                        <Button variant="ghost" className="h-12 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-900 hover:bg-slate-50" onClick={() => setIsResetOpen(false)}>
                                            Abort Operation
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </CardContent>
                    </Card>
                    
                    <EditUserSettingsSheet isOpen={isSheetOpen} onOpenChange={setIsSheetOpen} userProfile={profile} userLeverages={leverages} onSettingsSaved={fetchData} />
                    <EditDetailsSheet isOpen={isDetailsSheetOpen} onOpenChange={setIsDetailsSheetOpen} userProfile={profile} onDetailsSaved={fetchData} />
                </div>
            </div>
        </div>
    );
}
