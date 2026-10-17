'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
    Users, Activity, ShieldAlert, BarChart3, 
    PieChart as PieIcon, Timer, RefreshCw, TrendingUp,
    Target, Zap, Crown, Flame, ArrowUpRight,
    Trophy
} from 'lucide-react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
    ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line 
} from 'recharts';
import { getAdminAnalytics } from '@/app/actions/get-admin-analytics';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/**
 * @fileOverview Institutional Management Analytics v2.3
 * Clean Mixed-Case UI with Simplified Vocabulary.
 */

const COLORS = ['#5D2D91', '#F43F5E'];

const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(Math.abs(val));
};

export default function AdminAnalyticsPage() {
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchStats = async () => {
        setIsLoading(true);
        const res = await getAdminAnalytics();
        if (res.success) setData(res.data);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchStats();
    }, []);

    const statusData = useMemo(() => {
        if (!data) return [];
        return [
            { name: 'Active', value: data.users.active },
            { name: 'Inactive', value: data.users.inactive }
        ];
    }, [data]);

    if (isLoading && !data) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <RefreshCw className="h-8 w-8 animate-spin text-[#5D2D91] opacity-20" />
            </div>
        );
    }

    return (
        <div className="space-y-10 max-w-7xl mx-auto animate-in fade-in duration-1000">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-8 border-b border-slate-200">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black tracking-tighter font-headline text-slate-900">Analytics Hub</h1>
                    <p className="text-slate-400 text-[10px] font-bold">Network intelligence suite</p>
                </div>
                <Button onClick={fetchStats} disabled={isLoading} className="rounded-xl h-12 px-6 bg-white border border-slate-200 text-slate-900 font-bold text-[10px] shadow-sm hover:bg-slate-50 transition-all">
                    <RefreshCw className={cn("h-3.5 w-3.5 mr-2.5", isLoading && "animate-spin")} />
                    Update Data
                </Button>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <Card className="xl:col-span-2 rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden relative">
                    <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
                                <Crown className="h-6 w-6 text-amber-500" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-800 tracking-tight font-headline">Leaderboard</h3>
                                <p className="text-[10px] font-bold text-slate-400 mt-0.5">Top performing traders</p>
                            </div>
                        </div>
                        <Badge className="bg-[#5D2D91]/10 text-[#5D2D91] border-none text-[9px] font-bold px-4 py-1.5 rounded-full">
                            {data?.performance.leaderboardContext}
                        </Badge>
                    </div>

                    <div className="p-6 space-y-3">
                        {data?.performance.topTraders.length > 0 ? (
                            data.performance.topTraders.map((trader: any, idx: number) => (
                                <div key={idx} className="p-5 rounded-2xl bg-white border border-slate-100 flex items-center justify-between hover:bg-slate-50 transition-all shadow-sm">
                                    <div className="flex items-center gap-5">
                                        <div className={cn(
                                            "h-10 w-10 rounded-xl flex items-center justify-center text-sm font-black",
                                            idx === 0 ? "bg-amber-100 text-amber-600" : 
                                            idx === 1 ? "bg-slate-100 text-slate-400" : 
                                            idx === 2 ? "bg-orange-100 text-orange-600" :
                                            "bg-slate-50 text-slate-300"
                                        )}>
                                            {idx + 1}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">{trader.name}</p>
                                            <p className="text-[9px] font-bold text-slate-400">Active session</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="flex items-center justify-end gap-1.5 text-emerald-600">
                                            <ArrowUpRight className="h-3.5 w-3.5" />
                                            <span className="text-lg font-black tracking-tighter">+{formatCurrency(trader.pnl)}</span>
                                        </div>
                                        <p className="text-[8px] font-bold text-emerald-500/50">Profit</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-24 text-center flex flex-col items-center gap-4 opacity-10">
                                <Trophy className="h-16 w-16" />
                                <p className="font-bold text-[10px]">No sessions detected</p>
                            </div>
                        )}
                    </div>
                </Card>

                <div className="space-y-6">
                    <InstrumentStatCard title="Top Index" value={data?.performance.topIndex} icon={Target} color="text-[#5D2D91]" />
                    <InstrumentStatCard title="Hot Asset" value={data?.performance.topInstrument} icon={Flame} color="text-orange-500" />
                    <Card className="rounded-[2.5rem] border-none bg-white p-8 shadow-xl relative overflow-hidden flex-1">
                        <div className="relative z-10">
                            <p className="text-[10px] font-bold text-slate-400 mb-4">Network efficiency</p>
                            <div className="flex items-baseline gap-2 mb-2">
                                <span className="text-4xl font-black text-slate-900 tracking-tighter">{data?.performance.winRate}%</span>
                                <span className="text-emerald-500 text-[10px] font-bold">Win Rate</span>
                            </div>
                            <p className="text-[9px] font-medium text-slate-400 leading-relaxed max-w-[200px]">
                                Average accuracy across all active trading accounts.
                            </p>
                        </div>
                        <div className="absolute -bottom-10 -right-10 opacity-5">
                            <Zap className="h-40 w-40 text-[#5D2D91]" />
                        </div>
                    </Card>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Total Traders" value={data?.users.total} icon={Users} description="Network size" />
                <StatCard title="Session P&L" value={formatCurrency(data?.performance.totalPnLToday)} icon={TrendingUp} color={data?.performance.totalPnLToday >= 0 ? "text-emerald-600" : "text-rose-600"} description="Daily earnings" />
                <StatCard title="Avg Exposure" value={formatCurrency(data?.performance.avgTradeSize)} icon={Activity} description="Median position size" />
                <StatCard title="Active Terminals" value={data?.users.active} icon={ShieldAlert} color="text-[#5D2D91]" description="Live session pulse" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-2 rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden">
                    <CardHeader className="p-8 pb-0">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                                <BarChart3 className="h-5 w-5 text-[#5D2D91]" />
                            </div>
                            <div>
                                <CardTitle className="text-lg font-bold tracking-tight font-headline text-slate-800">Activity Report</CardTitle>
                                <CardDescription className="text-[10px] font-bold text-slate-400">7-day usage frequency</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="h-[350px] p-8 pt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data?.charts.dailyActivity7}>
                                <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(0,0,0,0.03)" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={9} fontWeight="700" stroke="#94a3b8" dy={10} />
                                <YAxis axisLine={false} tickLine={false} fontSize={10} fontWeight="700" stroke="#94a3b8" />
                                <Tooltip 
                                    cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                                    contentStyle={{ backgroundColor: 'white', border: '1px solid #f1f5f9', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}
                                />
                                <Bar dataKey="trades" fill="#5D2D91" radius={[8, 8, 8, 8]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden">
                    <CardHeader className="p-8 pb-0 text-center">
                        <CardTitle className="text-lg font-bold text-slate-800 font-headline">User Balance</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[350px] p-8 flex flex-col items-center justify-center relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie 
                                    data={statusData} 
                                    innerRadius={70} 
                                    outerRadius={100} 
                                    paddingAngle={8} 
                                    dataKey="value" 
                                    stroke="none" 
                                    cornerRadius={10}
                                >
                                    {statusData.map((_, i) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />)}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{ backgroundColor: 'white', border: 'none', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', fontSize: '10px', fontWeight: '700' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <PieIcon className="h-6 w-6 text-[#5D2D91] mb-1 opacity-20" />
                            <span className="text-[8px] font-bold text-slate-400">Ratio</span>
                        </div>
                        <div className="flex gap-6 mt-4">
                            <LegendItem label="Active" color="bg-[#5D2D91]" />
                            <LegendItem label="Inactive" color="bg-rose-500" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden">
                <CardHeader className="p-8 pb-0">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center border border-amber-100">
                            <Timer className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-bold tracking-tight font-headline text-slate-800">Usage Pulse</CardTitle>
                            <CardDescription className="text-[10px] font-bold text-slate-400">24-hour execution frequency</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="h-[250px] p-8 pt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data?.charts.peakActivity}>
                            <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(0,0,0,0.03)" />
                            <XAxis dataKey="hour" axisLine={false} tickLine={false} fontSize={9} fontWeight="700" stroke="#94a3b8" dy={10} />
                            <YAxis axisLine={false} tickLine={false} fontSize={9} fontWeight="700" stroke="#94a3b8" />
                            <Tooltip 
                                contentStyle={{ backgroundColor: 'white', border: '1px solid #f1f5f9', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}
                            />
                            <Line type="monotone" dataKey="trades" stroke="#f59e0b" strokeWidth={4} dot={{ r: 4, fill: '#f59e0b', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
}

function InstrumentStatCard({ title, value, icon: Icon, color }: any) {
    return (
        <Card className="rounded-[2rem] border-none bg-white p-6 shadow-xl group hover:bg-slate-50 transition-all">
            <div className="flex items-center justify-between mb-4">
                <p className="text-[9px] font-bold text-slate-400">{title}</p>
                <Icon className={cn("h-4 w-4 opacity-20 group-hover:opacity-100 transition-opacity", color)} />
            </div>
            <p className="text-2xl font-black text-slate-900 tracking-tighter truncate">{value}</p>
        </Card>
    );
}

function StatCard({ title, value, icon: Icon, color = "text-slate-900", description }: any) {
    return (
        <Card className="rounded-[2rem] border-none bg-white p-6 shadow-xl transition-all hover:scale-[1.02]">
            <div className="flex items-center justify-between mb-4">
                <p className="text-[9px] font-bold text-slate-400">{title}</p>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <Icon className="h-4 w-4 text-slate-400" />
                </div>
            </div>
            <p className={cn("text-3xl font-black tracking-tighter font-headline", color)}>{value}</p>
            <p className="text-[8px] font-bold text-slate-300 mt-1.5">{description}</p>
        </Card>
    );
}

function LegendItem({ label, color }: { label: string, color: string }) {
    return (
        <div className="flex items-center gap-2">
            <div className={cn("h-2 w-2 rounded-full", color)} />
            <span className="text-[9px] font-bold text-slate-400">{label}</span>
        </div>
    );
}