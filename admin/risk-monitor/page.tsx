'use client';
import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Loader2, RefreshCw, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { useWebSocketData } from '@/context/websocket-context';
import { useSearchParams } from 'next/navigation';
import { getMultipleStockPrices } from '@/app/actions/get-stock-price';

/**
 * @fileOverview Institutional Risk Sentinel - Spectrum Isolated.
 * Real-time monitoring of all open positions for specific market identities.
 */

const formatCurrency = (value: number, showSign = false) => {
    if (isNaN(value)) return '₹0.00';
    const formatted = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Math.abs(value));
    if (showSign) {
        return value >= 0 ? `+${formatted}` : `-${formatted}`;
    }
    return formatted;
};

const DataCard = ({ title, value, className }: { title: string; value: string | number; className?: string }) => (
    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">{title}</p>
        <p className={cn("text-lg font-black text-slate-900 tracking-tight", className)}>{typeof value === 'number' ? formatCurrency(value) : value}</p>
    </div>
);

const PnlCard = ({ title, value }: { title: string; value: number }) => (
     <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">{title}</p>
        <p className={cn("text-lg font-black tracking-tight", value >= 0 ? "text-emerald-600" : "text-rose-600")}>
            {formatCurrency(value, true)}
        </p>
    </div>
)

const BreachCard = ({ title, pnl, limit, percentage }: { title: string; pnl: number; limit: number; percentage: number }) => {
    const isBreached = pnl < -limit;
    const progress = pnl < 0 ? Math.min(100, (Math.abs(pnl) / limit) * 100) : 0;

    return (
        <div className="p-6 bg-slate-50 border border-slate-100 rounded-2xl space-y-4">
            <div className="flex justify-between items-baseline">
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{title} ({percentage}%)</p>
                 <Badge className={cn("text-[9px] font-black uppercase border-none px-3", isBreached ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600")}>
                    {isBreached ? 'BREACHED' : 'OK'}
                 </Badge>
            </div>
            <Progress value={progress} className={cn("h-2 bg-slate-200", isBreached && "[&>div]:bg-rose-500")} />
            <div className="flex justify-between text-[10px] font-black uppercase tracking-tight">
                <span className={cn(pnl < 0 ? (isBreached ? "text-rose-600" : "text-amber-600") : "text-emerald-600")}>
                    {formatCurrency(pnl, true)}
                </span>
                <span className="text-slate-400">
                    Limit: <span className="text-rose-600">-{formatCurrency(limit)}</span>
                </span>
            </div>
        </div>
    );
};

function RiskMonitorContent() {
    const [overviewData, setOverviewData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const { prices, subscribe } = useWebSocketData();
    const searchParams = useSearchParams();
    const isMasterView = searchParams.get('master_view') === 'TRUE';
    const [selectedMarket, setSelectedMarket] = useState('indian');

    useEffect(() => {
        const saved = localStorage.getItem('admin_market_view');
        if (saved) setSelectedMarket(saved);
    }, []);

    const fetchOverview = useCallback(async (isBackgroundRefresh = false) => {
        if (!isBackgroundRefresh) setIsLoading(true);
        setIsRefreshing(true);
        setError(null);
        try {
            // 1. Concurrent Fetch
            const [
                { data: profiles, error: pe },
                { data: portfolios, error: pte },
                { data: openPositions, error: pose },
                { data: pnlData, error: pnle }
            ] = await Promise.all([
                supabase.from('profiles').select('*'),
                supabase.from('portfolios').select('*'),
                supabase.from('positions').select('*'),
                supabase.from('daily_pnl').select('*')
            ]);

            if (pe || pte || pose || pnle) throw (pe || pte || pose || pnle);

            // 2. INSTANT BATCH INJECTION
            const uniqueInstruments = Array.from(new Set(openPositions?.map(p => `${p.exchange.toUpperCase()}:${p.symbol.toUpperCase()}`)))
                .map(key => ({ exchange: key.split(':')[0], symbol: key.split(':')[1] }));
            
            const priceRes = uniqueInstruments.length > 0 ? await getMultipleStockPrices(uniqueInstruments) : { success: true, data: {} };

            // 3. Group and Enrich Data
            const results = (profiles || []).map(profile => {
                const portfolio = portfolios?.find(p => p.user_id === profile.id);
                if (!portfolio) return null;

                const userPositions = openPositions?.filter(p => p.user_id === profile.id) || [];
                const userPnlData = pnlData?.filter(p => p.user_id === profile.id) || [];
                
                const todayStr = new Date().toISOString().split('T')[0];
                const realizedToday = userPnlData.filter(p => p.date === todayStr).reduce((acc, curr) => acc + curr.pnl, 0);
                const totalOverall = userPnlData.reduce((acc, curr) => acc + curr.pnl, 0);

                let initialLivePnl = 0;
                const enrichedPositions = userPositions.map(pos => {
                    const key = `${pos.exchange.toUpperCase()}:${pos.symbol.toUpperCase()}`;
                    const ltp = priceRes.success && priceRes.data[key] ? priceRes.data[key].price : pos.average_price;
                    const livePnl = (ltp - pos.average_price) * pos.quantity;
                    initialLivePnl += livePnl;
                    return { ...pos, live_pnl: livePnl };
                });

                const dailyLossLimit = portfolio.opening_balance_today * (profile.daily_loss_limit_percentage / 100);
                const maxDrawdownLimit = portfolio.high_water_mark * (profile.loss_limit_percentage / 100);
                const perTradeLossLimit = portfolio.opening_balance_today * (profile.per_trade_loss_limit_percentage / 100);

                return {
                    profile,
                    portfolio,
                    pnl: { realized_today: realizedToday, total_overall_pnl: totalOverall, live: initialLivePnl },
                    breachLevels: { daily_loss_limit: dailyLossLimit, max_drawdown_limit: maxDrawdownLimit, per_trade_loss_limit: perTradeLossLimit },
                    live_positions: enrichedPositions
                };
            }).filter(Boolean);

            setOverviewData(results);
            
            // Subscribe for continuous updates
            if (uniqueInstruments.length > 0) subscribe(uniqueInstruments.map(i => ({ symbol: i.symbol, exchange: i.exchange })));

        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [subscribe]);

    useEffect(() => {
        fetchOverview();
        const interval = setInterval(() => fetchOverview(true), 15000); 
        return () => clearInterval(interval);
    }, [fetchOverview]);

    // WebSocket Update Loop
    const enrichedData = useMemo(() => {
        return overviewData.map(user => {
            let totalLivePnl = 0;
            const livePositions = user.live_positions.map((pos: any) => {
                const key = `${pos.exchange.toUpperCase()}:${pos.symbol.toUpperCase()}`;
                const ltp = prices[key]?.price || pos.average_price || 0;
                const livePnl = (ltp - pos.average_price) * pos.quantity;
                totalLivePnl += livePnl;
                return { ...pos, live_pnl: livePnl, breach_level: -user.breachLevels.per_trade_loss_limit };
            });
            return { ...user, pnl: { ...user.pnl, live: totalLivePnl }, live_positions: livePositions };
        });
    }, [overviewData, prices]);

    const filteredData = useMemo(() => {
        return enrichedData.filter(user => {
            // 1. Isolation by Market Type
            if (user.profile.market_type !== selectedMarket) return false;

            // 2. Absolute Stealth Logic
            const visibilityMatch = isMasterView ? user.profile.is_hidden : !user.profile.is_hidden;
            if (!visibilityMatch) return false;

            const matchesSearch = user.profile.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesSearch;
        });
    }, [enrichedData, isMasterView, searchQuery, selectedMarket]);

    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" /></div>;
    }
    
    if (error) {
        return <div className="p-8 text-rose-500 font-bold">Terminal Connection Error: {error}</div>;
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-8 animate-in fade-in duration-1000">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter font-headline text-slate-900 uppercase">
                        {isMasterView ? 'Stealth Monitor' : 'Risk Monitor'}
                    </h1>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
                        {selectedMarket.toUpperCase()} Spectrum Pulse
                    </p>
                </div>
                <div className="flex w-full md:w-auto items-center gap-3">
                    <div className="relative flex-1 md:flex-initial md:w-64 group">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="Search identity..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-11 bg-white border-slate-200 rounded-xl text-xs font-bold"
                        />
                    </div>
                    <Button onClick={() => fetchOverview()} className="h-11 w-11 p-0 rounded-xl bg-white border border-slate-200 shadow-sm" disabled={isRefreshing}>
                        <RefreshCw className={cn("h-4 w-4 text-slate-700", isRefreshing && "animate-spin")} />
                    </Button>
                </div>
            </header>

            <Accordion type="multiple" defaultValue={filteredData.map(u => u.profile.id)} className="space-y-4 pb-20">
                {filteredData.map(user => (
                    <AccordionItem key={user.profile.id} value={user.profile.id} className="border-none">
                        <Card className="rounded-[2rem] border-none shadow-lg bg-white overflow-hidden group">
                            <AccordionTrigger className="p-6 md:p-8 hover:no-underline hover:bg-slate-50/50 transition-all [&[data-state=open]]:border-b border-slate-100">
                                <div className="flex justify-between items-center w-full pr-6">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black uppercase">{user.profile.full_name?.charAt(0)}</div>
                                        <div>
                                            <p className="font-black text-lg text-slate-800 uppercase tracking-tight text-left">{user.profile.full_name}</p>
                                            {user.profile.is_hidden && <Badge className="bg-primary text-white text-[8px] h-4 mt-0.5">STEALTH IDENTITY</Badge>}
                                        </div>
                                    </div>
                                    <Badge className={cn(
                                        "text-[9px] font-black px-3 py-1 rounded-md border-none uppercase",
                                        user.profile.is_active ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                                    )}>
                                        {user.profile.is_active ? "Active" : "Restricted"}
                                    </Badge>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="p-6 md:p-8 space-y-8 animate-in slide-in-from-top-2 duration-300">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <DataCard title="Opening Balance" value={user.portfolio.opening_balance_today} />
                                    <DataCard title="High Water Mark" value={user.portfolio.high_water_mark} />
                                    <DataCard title="Cash Balance" value={user.portfolio.cash_balance} />
                                    <PnlCard title="Realized Today" value={user.pnl.realized_today} />
                                    <PnlCard title="Total overall" value={user.pnl.total_overall_pnl} />
                                    <PnlCard title="Live alpha" value={user.pnl.live} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <BreachCard 
                                        title="Daily session cap" 
                                        pnl={user.pnl.realized_today} 
                                        limit={user.breachLevels.daily_loss_limit} 
                                        percentage={user.profile.daily_loss_limit_percentage}
                                    />
                                    <BreachCard 
                                        title="Overall drawdown" 
                                        pnl={user.pnl.total_overall_pnl}
                                        limit={user.breachLevels.max_drawdown_limit}
                                        percentage={user.profile.loss_limit_percentage}
                                    />
                                </div>
                                
                                <div className="rounded-[1.5rem] border border-slate-100 overflow-hidden">
                                    <Table>
                                        <TableHeader className="bg-slate-50/50">
                                            <TableRow className="border-slate-100">
                                                <TableHead className="text-[10px] font-black uppercase text-slate-400 pl-6 py-4">Instrument</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase text-slate-400">Lots/Qty</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase text-slate-400">Live P&L</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase text-slate-400 pr-6 text-right">Violation Threshold</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {user.live_positions.length > 0 ? (
                                                user.live_positions.map((pos: any) => (
                                                    <TableRow key={pos.id} className="border-slate-100 hover:bg-slate-50/30">
                                                        <TableCell className="font-bold text-slate-700 pl-6 uppercase">{pos.symbol}</TableCell>
                                                        <TableCell className="font-black text-slate-900">{pos.quantity}</TableCell>
                                                        <TableCell className={cn("font-black", pos.live_pnl < 0 ? "text-rose-600" : "text-emerald-600", pos.live_pnl < pos.breach_level && "text-glow-red")}>
                                                            {formatCurrency(pos.live_pnl, true)}
                                                        </TableCell>
                                                        <TableCell className="text-rose-600 font-bold pr-6 text-right">-{formatCurrency(Math.abs(pos.breach_level))}</TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow><TableCell colSpan={4} className="text-center py-10 text-[9px] font-black uppercase tracking-widest text-slate-300">No active exposure on terminal</TableCell></TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </AccordionContent>
                        </Card>
                    </AccordionItem>
                ))}
            </Accordion>
        </div>
    );
}

export default function RiskMonitorPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>}>
            <RiskMonitorContent />
        </Suspense>
    );
}