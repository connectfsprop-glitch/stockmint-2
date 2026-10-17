'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  LogOut, ShieldAlert, Target, Loader2, Key, MessageSquare, 
  Clock, History, CheckCircle2, TrendingUp, ShieldCheck, Volume2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/app-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { PerformanceInsights } from '@/components/performance-insights';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { LiveSupport } from '@/components/live-support';
import Image from 'next/image';

/**
 * @fileOverview Institutional Profile Terminal v3.3
 * Enhanced Transparency: Displays the official breach reason from the execution audit.
 */

function DetailedBreachCard({ reason }: { reason: string }) {
    return (
        <Card className="border-rose-100 bg-white rounded-3xl p-6 md:p-8 shadow-sm border-2">
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-50 pb-6">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-rose-50 flex items-center justify-center border border-rose-100">
                            <ShieldAlert className="h-6 w-6 text-rose-500" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800 tracking-tight font-headline">Terminal breach</h3>
                            <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mt-0.5">Audit protocol violation</p>
                        </div>
                    </div>
                    <Badge variant="outline" className="bg-rose-50 border-none text-rose-600 px-4 py-1.5 rounded-lg font-bold uppercase tracking-tight text-[9px] h-fit">
                        Access Restricted
                    </Badge>
                </div>
                <div className="p-6 rounded-2xl bg-slate-50/50 border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-3">Official audit log</p>
                    <p className="text-base font-bold text-rose-600 leading-relaxed tracking-tight">
                        {reason || "Your account has been restricted due to a risk protocol violation. Please contact support for restoration details."}
                    </p>
                </div>
            </div>
        </Card>
    );
}

function BreachEducationTerminal({ reason }: { reason: string }) {
    const [lang, setLang] = useState<'EN' | 'HI'>('EN');
    const [isSpeaking, setIsSpeaking] = useState(false);

    const educationalData = useMemo(() => ({
        EN: reason.includes("News") ? "Restricted news window violation (±5 min)." : "Risk protocol violation. Terminal access deactivated.",
        HI: reason.includes("News") ? "News window ke dauran trade karne par account band hua." : "Risk niyam todne par terminal band kar diya gaya hai."
    }), [reason]);

    const handleSpeak = () => {
        if (typeof window === 'undefined' || !window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(educationalData[lang]);
        utterance.lang = lang === 'EN' ? 'en-US' : 'hi-IN';
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
    };

    return (
        <Card className="bg-white rounded-3xl border-none p-6 md:p-8 shadow-sm">
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800 tracking-tight font-headline">Voice analysis</h3>
                    <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
                        <button onClick={() => setLang('EN')} className={cn("px-3 py-1 rounded-md text-[9px] font-bold uppercase transition-all", lang === 'EN' ? "bg-white text-[#5D2D91] shadow-sm" : "text-slate-400")}>EN</button>
                        <button onClick={() => setLang('HI')} className={cn("px-3 py-1 rounded-md text-[9px] font-bold uppercase transition-all", lang === 'HI' ? "bg-white text-[#5D2D91] shadow-sm" : "text-slate-400")}>HI</button>
                    </div>
                </div>
                <p className="text-xs font-bold text-slate-500 leading-relaxed">{educationalData[lang]}</p>
                <Button onClick={handleSpeak} disabled={isSpeaking} className="w-full h-12 rounded-xl bg-[#5D2D91] text-white font-bold text-xs uppercase tracking-tight shadow-md">
                    <Volume2 className="mr-2 h-4 w-4" /> {isSpeaking ? 'Analyzing...' : 'Play analysis'}
                </Button>
            </div>
        </Card>
    );
}

export default function ProfilePage() {
    const { user, profile, portfolio, isLoading: userLoading } = useUserProfile(['student', 'admin', 'mentor', 'support']);
    const [orders, setOrders] = useState<any[]>([]);
    const [dailyPnl, setDailyPnl] = useState<any[]>([]);
    const [audits, setAudits] = useState<any[]>([]);
    const [latestBreach, setLatestBreach] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
    const [isSupportOpen, setIsSupportOpen] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
    
    const { toast } = useToast();
    const router = useRouter();

    const fetchData = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        const [ordersRes, pnlRes, breachRes, auditRes] = await Promise.all([
            supabase.from('orders').select('*').eq('user_id', user.id).eq('status', 'COMPLETED'),
            supabase.from('daily_pnl').select('*').eq('user_id', user.id).order('date', { ascending: true }),
            supabase.from('orders').select('breach_reason').eq('user_id', user.id).not('breach_reason', 'is', null).neq('breach_reason', '').order('created_at', { ascending: false }).limit(1).maybeSingle(),
            supabase.from('performance_audits').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
        ]);

        setOrders(ordersRes.data || []);
        setDailyPnl(pnlRes.data || []);
        if (breachRes.data) setLatestBreach(breachRes.data.breach_reason);
        setAudits(auditRes.data || []);
        setIsLoading(false);
    }, [user]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleUpdatePassword = async () => {
        if (!newPassword || newPassword !== confirmPassword) {
            toast({ variant: 'destructive', title: 'Error', description: 'Passwords do not match or are empty.' });
            return;
        }
        setIsUpdatingPassword(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            toast({ title: 'Success', description: 'Identity security key synchronized.' });
            setIsPasswordDialogOpen(false);
            setNewPassword('');
            setConfirmPassword('');
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed', description: e.message });
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    const riskMetrics = useMemo(() => {
        if (!profile || !portfolio) return null;
        const totalOverallPnl = dailyPnl.reduce((acc, curr) => acc + curr.pnl, 0);
        const isLive = ['one_step_live', 'two_step_live', 'instant_live', 'passthenpay'].includes(profile.account_classification || '');
        
        const targets: Record<string, number> = { 
            'one_step_phase_1': 0.10, 
            'two_step_phase_1': 0.08, 
            'two_step_phase_2': 0.05 
        };
        const targetPercent = targets[profile.account_classification || ''] || 0;
        const profitTarget = portfolio.opening_balance_today * targetPercent;
        const profitProgress = profitTarget > 0 ? Math.min(100, (totalOverallPnl / profitTarget) * 100) : 0;

        let countdown = null;
        if (isLive && profile.audit_cycle_start) {
            const cycleEnd = new Date(new Date(profile.audit_cycle_start).getTime() + 7 * 24 * 60 * 60 * 1000);
            const diff = cycleEnd.getTime() - new Date().getTime();
            countdown = Math.max(0, Math.floor(diff / (1000 * 60 * 60)));
        }

        return { totalOverallPnl, profitProgress, countdown, isLive };
    }, [profile, portfolio, dailyPnl]);

    if (userLoading) return <AppLayout><div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-[#5D2D91]" /></div></AppLayout>;

    return (
        <AppLayout>
            <LiveSupport isOpen={isSupportOpen} onOpenChange={setIsSupportOpen} />
            <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-1000 slide-in-from-bottom-2 overflow-x-hidden">
                <header className="flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-start pb-8 border-b border-white/10">
                    <div className="h-20 w-24 md:h-28 md:w-28 rounded-2xl bg-white border-2 border-white/20 shadow-xl overflow-hidden relative active:scale-95 transition-transform cursor-pointer flex items-center justify-center">
                        <Image src="/logo.png" alt="Profile Avatar" fill className="object-contain p-4" priority />
                    </div>
                    <div className="text-center md:text-left flex-1 space-y-2">
                        <h1 className="text-3xl md:text-5xl font-headline font-black text-white tracking-tight">{profile?.full_name}</h1>
                        <div className="flex flex-wrap justify-center md:justify-start gap-2">
                            <Badge className="bg-amber-400 text-black px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-tight">
                                {profile?.account_classification?.replace(/_/g, ' ') || 'Evaluation'}
                            </Badge>
                            <Badge variant="outline" className={cn("px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-tight border-none shadow-sm text-white", profile?.is_active ? "bg-emerald-500" : "bg-rose-500")}>
                                Terminal: {profile?.is_active ? 'Active' : 'Restricted'}
                            </Badge>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto justify-center md:justify-end">
                        <Button variant="ghost" className="bg-white/10 text-white hover:bg-white/20 h-11 px-5 rounded-xl font-bold text-[11px] transition-all" onClick={() => setIsSupportOpen(true)}>
                            <MessageSquare className="h-4 w-4 mr-2.5" /> Support
                        </Button>
                        <Button variant="ghost" className="bg-rose-500/20 text-rose-100 hover:bg-rose-500/30 h-11 px-5 rounded-xl font-bold text-[11px] transition-all" onClick={() => { supabase.auth.signOut(); router.push('/login'); }}>
                            <LogOut className="h-4 w-4 mr-2.5" /> Sign out
                        </Button>
                    </div>
                </header>

                {!profile?.is_active && latestBreach && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2"><DetailedBreachCard reason={latestBreach} /></div>
                        <div className="lg:col-span-1"><BreachEducationTerminal reason={latestBreach} /></div>
                    </div>
                )}

                <Tabs defaultValue="performance" className="w-full">
                    <TabsList className="bg-slate-100 p-1 rounded-xl h-12 mb-8 border border-slate-200 w-full md:w-auto shadow-inner flex overflow-x-auto no-scrollbar">
                        <TabsTrigger value="performance" className="flex-1 md:flex-none rounded-lg px-8 h-full font-bold text-[11px] data-[state=active]:bg-white data-[state=active]:text-[#5D2D91] data-[state=active]:shadow-sm transition-all">Analysis</TabsTrigger>
                        <TabsTrigger value="audits" className="flex-1 md:flex-none rounded-lg px-8 h-full font-bold text-[11px] data-[state=active]:bg-white data-[state=active]:text-[#5D2D91] data-[state=active]:shadow-sm transition-all">Performance report</TabsTrigger>
                        <TabsTrigger value="security" className="flex-1 md:flex-none rounded-lg px-8 h-full font-bold text-[11px] data-[state=active]:bg-white data-[state=active]:text-[#5D2D91] data-[state=active]:shadow-sm transition-all">Security</TabsTrigger>
                    </TabsList>

                    <TabsContent value="performance">
                        {isLoading ? <Skeleton className="h-96 w-full rounded-3xl bg-white" /> : <PerformanceInsights orders={orders} dailyPnl={dailyPnl} portfolio={portfolio} />}
                    </TabsContent>

                    <TabsContent value="audits" className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="bg-white rounded-3xl border-none p-6 md:p-8 shadow-sm">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                                            {riskMetrics?.isLive ? <Clock className="h-5 w-5 text-[#5D2D91]" /> : <TrendingUp className="h-5 w-5 text-[#5D2D91]" />}
                                        </div>
                                        <CardTitle className="text-lg font-bold text-slate-800 tracking-tight font-headline">{riskMetrics?.isLive ? 'Session pulse' : 'Profit target'}</CardTitle>
                                    </div>
                                    {riskMetrics?.isLive ? (
                                        <div>
                                            <p className="text-3xl font-black text-slate-900 tracking-tight">{riskMetrics.countdown} hours</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Next behavior check in</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                <span>Target progress</span>
                                                <span className="text-[#5D2D91]">{riskMetrics?.profitProgress.toFixed(1)}%</span>
                                            </div>
                                            <Progress value={riskMetrics?.profitProgress} className="h-2.5 bg-slate-100" />
                                        </div>
                                    )}
                                </div>
                            </Card>

                            <Card className="bg-white rounded-3xl border-none p-6 md:p-8 shadow-sm">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center border border-amber-100"><Target className="h-5 w-5 text-amber-600" /></div>
                                        <CardTitle className="text-lg font-bold text-slate-800 tracking-tight font-headline">Pass requirements</CardTitle>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-slate-50 rounded-xl text-center border border-slate-100">
                                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Min score</p>
                                            <p className="text-base font-bold text-slate-900">60 / 100</p>
                                        </div>
                                        <div className="p-4 bg-slate-50 rounded-xl text-center border border-slate-100">
                                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Audit mode</p>
                                            <p className="text-base font-bold text-emerald-600">Active</p>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </div>

                        <Card className="bg-white rounded-3xl border-none p-6 md:p-8 shadow-sm overflow-hidden">
                            <CardHeader className="px-0 pt-0 pb-6 border-b border-slate-50 mb-6"><CardTitle className="text-lg font-bold text-slate-800 tracking-tight font-headline">Performance history</CardTitle></CardHeader>
                            <CardContent className="px-0 pb-0 space-y-4">
                                {audits.length === 0 ? (
                                    <div className="py-20 text-center opacity-20 text-[10px] font-bold uppercase tracking-widest">No reports found yet.</div>
                                ) : (
                                    audits.map(audit => (
                                        <div key={audit.id} className="p-5 rounded-2xl bg-white border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:bg-slate-50 transition-all shadow-sm">
                                            <div className="flex items-start gap-4">
                                                <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0 shadow-sm", audit.status === 'PASS' ? "bg-emerald-50 text-emerald-500" : "bg-rose-50 text-rose-600")}>
                                                    {audit.status === 'PASS' ? <CheckCircle2 className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                                                </div>
                                                <div className="space-y-0.5">
                                                    <p className="text-[11px] font-bold text-slate-800 uppercase tracking-tight">{audit.audit_type.replace(/_/g, ' ')}</p>
                                                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed">{audit.reasoning}</p>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-xl font-black text-slate-900 tracking-tight">{audit.score}</p>
                                                <Badge variant={audit.status === 'PASS' ? 'default' : 'destructive'} className="text-[8px] font-bold px-1.5 py-0 rounded-md uppercase">{audit.status}</Badge>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="security">
                        <Card className="bg-white rounded-3xl border-none p-6 md:p-8 max-w-md shadow-sm">
                            <CardHeader className="px-0 pt-0 mb-6">
                                <CardTitle className="text-lg font-bold text-slate-800 tracking-tight font-headline">Identity security</CardTitle>
                            </CardHeader>
                            <Button variant="outline" className="w-full h-12 rounded-xl border-slate-100 bg-slate-50 justify-between px-5 hover:bg-slate-100 transition-all shadow-inner" onClick={() => setIsPasswordDialogOpen(true)}>
                                <span className="font-bold text-[10px] uppercase tracking-widest text-slate-600">Update security key</span>
                                <Key className="h-4 w-4 opacity-40 text-[#5D2D91]" />
                            </Button>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                <DialogContent className="bg-white border-none rounded-3xl max-w-md p-8 shadow-2xl">
                    <DialogHeader className="space-y-2">
                        <DialogTitle className="text-xl font-bold text-slate-800 tracking-tight font-headline">Secure identity change</DialogTitle>
                        <DialogDescription className="text-[11px] font-medium text-slate-400">Synchronize your institutional access key.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-6">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">New password</label>
                            <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" className="bg-slate-50 border-none h-11 rounded-xl px-4 font-bold focus:ring-2 focus:ring-[#5D2D91]/10" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Confirm password</label>
                            <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" className="bg-slate-50 border-none h-11 rounded-xl px-4 font-bold focus:ring-2 focus:ring-[#5D2D91]/10" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button className="w-full h-12 rounded-xl bg-[#5D2D91] hover:bg-[#4A1E7A] text-white font-bold uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-all" onClick={handleUpdatePassword} disabled={isUpdatingPassword}>
                            {isUpdatingPassword ? <Loader2 className="animate-spin" /> : 'Confirm change'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
