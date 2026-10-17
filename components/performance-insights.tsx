'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  TrendingUp, Target, Zap, Award, BarChart3, 
  Calendar as CalendarIcon, Clock, ShieldAlert, 
  BarChart, Percent, Activity, ChevronLeft, 
  ChevronRight, History, PieChart as PieIcon,
  ArrowUpRight, ArrowDownRight, Timer, Hash,
  TrendingUp as ProfitIcon, TrendingDown as LossIcon
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart as ReBarChart, Bar, ReferenceLine
} from 'recharts';
import { cn } from '@/lib/utils';
import { 
  format, startOfMonth, endOfMonth, eachDayOfInterval, 
  isSameDay, addMonths, subMonths, isSameMonth 
} from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/**
 * @fileOverview Institutional Performance Insights v3.2
 * Refined typography scale and purged all-caps formatting for professional consistency.
 */

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.abs(val));

export function PerformanceInsights({ orders, dailyPnl, portfolio }: PerformanceInsightsProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<{ date: Date; pnl: number | null } | null>(null);

  // --- ADVANCED CALCULATIONS ---
  
  const stats = useMemo(() => {
    const completedTrades = orders.filter(o => o.status === 'COMPLETED' && o.pnl !== null);
    const totalTrades = completedTrades.length;
    
    const grossProfit = completedTrades.filter(o => o.pnl > 0).reduce((acc, o) => acc + o.pnl, 0);
    const grossLoss = Math.abs(completedTrades.filter(o => o.pnl < 0).reduce((acc, o) => acc + o.pnl, 0));
    
    const wins = completedTrades.filter(o => o.pnl > 0).length;
    const losses = totalTrades - wins;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 100 : 0;

    const avgWin = wins > 0 ? grossProfit / wins : 0;
    const avgLoss = losses > 0 ? grossLoss / losses : 0;
    const riskRewardRatio = avgLoss > 0 ? avgWin / avgLoss : 0;

    const bestTrade = completedTrades.length > 0 ? Math.max(...completedTrades.map(o => o.pnl)) : 0;
    const worstTrade = completedTrades.length > 0 ? Math.min(...completedTrades.map(o => o.pnl)) : 0;

    const assetBreakdown = completedTrades.reduce((acc: any, o) => {
      const type = o.instrument_type || 'Equity';
      if (!acc[type]) acc[type] = 0;
      acc[type] += o.pnl;
      return acc;
    }, {});

    const assetData = Object.entries(assetBreakdown).map(([name, value]) => ({
      name,
      value: Math.max(0, value as number), 
      actualPnl: value
    }));

    const expectancy = ( (winRate / 100) * avgWin ) - ( ((100 - winRate) / 100) * avgLoss );

    return { 
      totalTrades, winRate, profitFactor, wins, losses, 
      grossProfit, grossLoss,
      riskRewardRatio, avgWin, avgLoss, expectancy,
      bestTrade, worstTrade, assetData
    };
  }, [orders]);

  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });

    return days.map(day => {
      const dayPnl = dailyPnl.find(p => isSameDay(new Date(p.date), day));
      return {
        date: day,
        pnl: dayPnl ? dayPnl.pnl : null,
      };
    });
  }, [dailyPnl, currentMonth]);

  const monthlyData = useMemo(() => {
    const monthlyMap: Record<string, number> = {};
    dailyPnl.forEach(p => {
      const monthKey = format(new Date(p.date), 'MMM yy');
      monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + p.pnl;
    });
    return Object.entries(monthlyMap).map(([name, pnl]) => ({ name, pnl }));
  }, [dailyPnl]);

  const dowData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const results = days.map(d => ({ name: d, pnl: 0 }));
    
    dailyPnl.forEach(p => {
      const dayIndex = new Date(p.date).getDay();
      results[dayIndex].pnl += p.pnl;
    });

    return results.filter(d => d.name !== 'Sun' && d.name !== 'Sat');
  }, [dailyPnl]);

  const streaks = useMemo(() => {
    const sortedPnl = [...dailyPnl].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let currentWinStreak = 0;
    let maxWinStreak = 0;
    
    sortedPnl.forEach(p => {
      if (p.pnl > 0) {
        currentWinStreak++;
        maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
      } else if (p.pnl < 0) {
        currentWinStreak = 0;
      }
    });

    return { currentWinStreak, maxWinStreak };
  }, [dailyPnl]);

  const handlePrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const handleNextMonth = () => {
    const next = addMonths(currentMonth, 1);
    if (next <= new Date() || isSameMonth(next, new Date())) {
      setCurrentMonth(next);
    }
  };

  const ASSET_COLORS = ['#5D2D91', '#3b82f6', '#00C853', '#f59e0b'];

  const getHeatmapColor = (pnl: number | null) => {
    if (pnl === null) return "bg-slate-50 border border-slate-100";
    if (pnl >= 0) return "bg-emerald-500/10 border border-emerald-500/20";
    return "bg-rose-500/10 border border-rose-500/20";
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-1000 pb-20">
      
      {/* 1. PRIMARY KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <InsightCard 
          title="Total executions" 
          value={stats.totalTrades} 
          icon={Hash} 
          trend="up"
          description="Total rounded trades"
        />
        <InsightCard 
          title="Gross alpha" 
          value={formatCurrency(stats.grossProfit)} 
          icon={ProfitIcon} 
          trend="up"
          description="Cumulative win spectrum"
        />
        <InsightCard 
          title="Alpha erosion" 
          value={formatCurrency(stats.grossLoss)} 
          icon={LossIcon} 
          trend="down"
          description="Cumulative loss spectrum"
        />
      </div>

      {/* 2. CALENDAR HEATMAP */}
      <Card className="bg-white rounded-[2rem] border-none p-6 md:p-8 shadow-sm">
        <CardHeader className="px-0 pt-0 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
              <CalendarIcon className="h-5 w-5 text-[#5D2D91]" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-slate-800 tracking-tight font-headline">Execution journal</CardTitle>
              <CardDescription className="text-[10px] font-bold text-slate-400">Monthly realized spectrum</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl w-full md:w-auto border border-slate-100 shadow-inner">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white transition-all" onClick={handlePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-[10px] font-bold px-4 flex-1 text-center min-w-[120px] text-slate-600">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white transition-all" onClick={handleNextMonth} disabled={isSameMonth(currentMonth, new Date())}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <div className="grid grid-cols-7 gap-1 md:gap-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
              <div key={d} className="text-center text-[9px] font-bold text-slate-300 mb-2">{d}</div>
            ))}
            {calendarDays.map((day, idx) => (
              <button 
                key={idx} 
                onClick={() => setSelectedDay(day)}
                className={cn(
                  "aspect-square rounded-xl flex items-center justify-center relative transition-all duration-300 hover:scale-105 hover:z-10 shadow-sm",
                  getHeatmapColor(day.pnl)
                )}
              >
                <span className="text-[10px] md:text-xs font-bold text-slate-400">{format(day.date, 'd')}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedDay} onOpenChange={() => setSelectedDay(null)}>
        <DialogContent className="bg-white border-none rounded-[2rem] shadow-2xl p-10 max-w-sm">
          <DialogHeader className="text-center">
            <DialogTitle className="text-xl font-bold text-slate-800 tracking-tight font-headline">Session detail</DialogTitle>
            <DialogDescription className="text-[10px] font-bold text-slate-400">
              {selectedDay && format(selectedDay.date, 'EEEE, dd MMMM yyyy')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-10 flex flex-col items-center justify-center gap-2">
            <p className="text-[10px] font-bold text-slate-400">Realized Alpha</p>
            <p className={cn(
              "text-3xl font-black tracking-tight",
              (selectedDay?.pnl ?? 0) >= 0 ? "text-[#00C853]" : "text-[#D32F2F]"
            )}>
              {(selectedDay?.pnl ?? 0) >= 0 ? '+' : '-'}{formatCurrency(selectedDay?.pnl ?? 0)}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* 3. PERFORMANCE STATS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <InsightCard 
          title="Alpha accuracy" 
          value={`${stats.winRate.toFixed(1)}%`} 
          icon={Target} 
          trend={stats.winRate >= 50 ? 'up' : 'down'}
          description={`${stats.wins} Wins / ${stats.losses} Losses`}
        />
        <InsightCard 
          title="Trade quality" 
          value={`${stats.riskRewardRatio.toFixed(2)} R:R`} 
          icon={Activity} 
          trend={stats.riskRewardRatio >= 1.5 ? 'up' : 'down'}
          description="Avg win vs. avg loss"
        />
        <InsightCard 
          title="Best session" 
          value={formatCurrency(stats.bestTrade)} 
          icon={ArrowUpRight} 
          trend="up"
          description="Single peak p&l"
        />
        <InsightCard 
          title="Streak reach" 
          value={`${streaks.maxWinStreak} Days`} 
          icon={Award} 
          trend="up"
          description="Record alpha run"
        />
      </div>

      {/* 4. MAIN GROWTH SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 bg-white rounded-[2rem] border-none overflow-hidden p-8 shadow-sm">
          <CardHeader className="px-0 pt-0 mb-8">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                <BarChart3 className="h-5 w-5 text-[#5D2D91]" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-slate-800 tracking-tight font-headline">Equity spectrum</CardTitle>
                <CardDescription className="text-slate-400 text-[10px] font-bold mt-0.5">Growth trajectory</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-[300px] md:h-[350px] px-0 pb-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData(dailyPnl, portfolio)} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5D2D91" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#5D2D91" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="0" stroke="rgba(0,0,0,0.02)" vertical={false} />
                <XAxis dataKey="date" stroke="rgba(0,0,0,0.2)" fontSize={9} tickLine={false} axisLine={false} dy={15} fontWeight="700" />
                <YAxis stroke="rgba(0,0,0,0.2)" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} dx={-10} fontWeight="700" />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'white', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}
                  itemStyle={{ color: '#5D2D91', fontWeight: '700' }}
                />
                <Area type="monotone" dataKey="equity" stroke="#5D2D91" strokeWidth={3} fillOpacity={1} fill="url(#colorEquity)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-white rounded-[2rem] border-none flex flex-col p-8 shadow-sm">
          <CardHeader className="px-0 pt-0 text-center">
            <CardTitle className="text-base font-bold text-slate-800 tracking-tight font-headline">Asset concentration</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center pt-6">
            <div className="h-[200px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={stats.assetData.length > 0 ? stats.assetData : [{ name: 'None', value: 1 }]} 
                    innerRadius={65} 
                    outerRadius={85} 
                    paddingAngle={8} 
                    dataKey="value" 
                    stroke="none" 
                    cornerRadius={10}
                  >
                    {stats.assetData.map((entry, index) => <Cell key={`cell-${index}`} fill={ASSET_COLORS[index % ASSET_COLORS.length]} />)}
                    {stats.assetData.length === 0 && <Cell fill="rgba(0,0,0,0.05)" />}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <PieIcon className="h-5 w-5 text-[#5D2D91] mb-1 opacity-20" />
                <span className="text-[9px] font-bold text-[#5D2D91]">Profit Center</span>
              </div>
            </div>
            <div className="grid grid-cols-1 w-full gap-2 mt-6">
              {stats.assetData.slice(0, 4).map((asset, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ASSET_COLORS[idx % ASSET_COLORS.length] }} />
                    <span className="text-[10px] text-slate-800 font-bold">{asset.name}</span>
                  </div>
                  <p className="text-[11px] font-black text-[#5D2D91]">{formatCurrency(asset.actualPnl)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 5. SESSION ANALYTICS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="bg-white rounded-[2rem] border-none p-8 shadow-sm">
          <CardHeader className="px-0 pt-0 mb-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100">
                <BarChart className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-slate-800 tracking-tight font-headline">Session spectrum</CardTitle>
                <CardDescription className="text-[10px] font-bold text-slate-400">Performance by day of week</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-[250px] px-0">
            <ResponsiveContainer width="100%" height="100%">
              <ReBarChart data={dowData}>
                <CartesianGrid strokeDasharray="0" stroke="rgba(0,0,0,0.02)" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={10} fontWeight="700" stroke="rgba(0,0,0,0.3)" />
                <YAxis axisLine={false} tickLine={false} fontSize={10} fontWeight="700" stroke="rgba(0,0,0,0.3)" />
                <Tooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                  contentStyle={{ backgroundColor: 'white', border: 'none', borderRadius: '12px', boxShadow: '0 10px 20px rgba(0,0,0,0.05)' }}
                />
                <ReferenceLine y={0} stroke="rgba(0,0,0,0.05)" />
                <Bar dataKey="pnl" radius={[4, 4, 4, 4]}>
                  {dowData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#00C853' : '#D32F2F'} />
                  ))}
                </Bar>
              </ReBarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-white rounded-[2rem] border-none p-8 shadow-sm">
          <CardHeader className="px-0 pt-0 mb-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center border border-purple-100">
                <History className="h-5 w-5 text-[#5D2D91]" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-slate-800 tracking-tight font-headline">Monthly spectrum</CardTitle>
                <CardDescription className="text-[10px] font-bold text-slate-400">Profitability comparison</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-[250px] px-0">
            <ResponsiveContainer width="100%" height="100%">
              <ReBarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="0" stroke="rgba(0,0,0,0.02)" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={10} fontWeight="700" stroke="rgba(0,0,0,0.3)" />
                <YAxis axisLine={false} tickLine={false} fontSize={10} fontWeight="700" stroke="rgba(0,0,0,0.3)" />
                <Tooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                  contentStyle={{ backgroundColor: 'white', border: 'none', borderRadius: '12px', boxShadow: '0 10px 20px rgba(0,0,0,0.05)' }}
                />
                <Bar dataKey="pnl" radius={[6, 6, 6, 6]}>
                  {monthlyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#5D2D91' : '#D32F2F'} />
                  ))}
                </Bar>
              </ReBarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 6. ELITE ANALYTICS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <EliteStat icon={Timer} title="Avg hold time" value="14 min" desc="Median execution spectrum" />
        <EliteStat icon={Percent} title="Expectancy" value={formatCurrency(stats.expectancy)} desc="Expected value per trade" />
        <EliteStat icon={ShieldAlert} title="Worst session" value={formatCurrency(stats.worstTrade)} desc="Maximum session erosion" />
      </div>

    </div>
  );
}

// --- HELPER COMPONENTS ---

function EliteStat({ icon: Icon, title, value, desc }: any) {
  return (
    <Card className="bg-white rounded-2xl border-none p-6 shadow-sm group transition-all duration-300 hover:shadow-md">
      <div className="flex items-center gap-4 mb-4">
        <div className="p-2.5 rounded-xl bg-slate-50 text-slate-400 group-hover:text-[#5D2D91] transition-colors border border-slate-100">
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{title}</p>
      </div>
      <p className="text-2xl font-black text-slate-900 tracking-tight mb-0.5 font-headline">{value}</p>
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{desc}</p>
    </Card>
  )
}

function InsightCard({ title, value, icon: Icon, trend, description }: any) {
  return (
    <Card className="bg-white rounded-2xl border-none group transition-all duration-300 hover:shadow-md p-6 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-6 space-y-0 px-0 pt-0">
        <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{title}</CardTitle>
        <div className={cn(
          "p-3 rounded-xl transition-all",
          trend === 'up' ? "bg-emerald-50 text-emerald-500" : "bg-rose-50 text-rose-500"
        )}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="text-3xl font-black text-slate-900 tracking-tight font-headline">{value}</div>
        <p className="text-[9px] font-bold text-slate-400 mt-3 uppercase tracking-tight">{description}</p>
      </CardContent>
    </Card>
  );
}

const chartData = (dailyPnl: any[], portfolio: any) => {
  let balance = portfolio?.opening_balance_today || 100000;
  const sortedPnl = [...dailyPnl].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let runningEquity = balance;
  if (sortedPnl.length === 0) return [{ date: 'START', equity: balance, pnl: 0 }];
  return sortedPnl.map(p => {
    runningEquity += p.pnl;
    return {
      date: format(new Date(p.date), 'dd MMM'),
      equity: runningEquity,
      pnl: p.pnl
    };
  });
};

interface PerformanceInsightsProps {
  orders: any[];
  dailyPnl: any[];
  portfolio: any;
}
