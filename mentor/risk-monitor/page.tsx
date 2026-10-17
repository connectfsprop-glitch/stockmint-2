
'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getMentorRiskOverview } from '@/app/actions/get-mentor-risk-overview';
import type { RiskOverview } from '@/app/actions/get-risk-overview';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Loader2, RefreshCw, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { useUserProfile } from '@/hooks/use-user-profile';

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
    <div className="p-3 bg-muted/50 rounded-lg">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className={cn("text-lg font-semibold", className)}>{typeof value === 'number' ? formatCurrency(value) : value}</p>
    </div>
);

const PnlCard = ({ title, value }: { title: string; value: number }) => (
     <div className="p-3 bg-muted/50 rounded-lg">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className={cn("text-lg font-semibold", value >= 0 ? "text-green-500" : "text-red-500")}>
            {formatCurrency(value, true)}
        </p>
    </div>
)

const BreachCard = ({ title, pnl, limit, percentage }: { title: string; pnl: number; limit: number; percentage: number }) => {
    const isBreached = pnl < -limit;
    const progress = pnl < 0 ? Math.min(100, (Math.abs(pnl) / limit) * 100) : 0;

    return (
        <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <div className="flex justify-between items-baseline">
                <p className="text-xs text-muted-foreground">{title} ({percentage}%)</p>
                 <Badge variant={isBreached ? 'destructive' : 'secondary'}>{isBreached ? 'BREACHED' : 'OK'}</Badge>
            </div>
            <Progress value={progress} className={cn(isBreached && "[&>div]:bg-red-500")} />
            <div className="flex justify-between text-xs">
                <span className={cn("font-bold", pnl < 0 ? (isBreached ? "text-red-500" : "text-amber-500") : "text-green-500")}>
                    {formatCurrency(pnl, true)}
                </span>
                <span className="text-muted-foreground">
                    Limit: <span className="text-red-500 font-medium">-{formatCurrency(limit)}</span>
                </span>
            </div>
        </div>
    );
};

export default function MentorRiskMonitorPage() {
    const { user } = useUserProfile(['mentor']);
    const [overviewData, setOverviewData] = useState<RiskOverview[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchOverview = useCallback(async (isBackgroundRefresh = false) => {
        if (!user) return;
        if (!isBackgroundRefresh) setIsLoading(true);
        setIsRefreshing(true);
        setError(null);
        try {
            const result = await getMentorRiskOverview(user.id);
            if (result.success) {
                setOverviewData(result.data);
            } else {
                setError(result.error);
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [user]);

    useEffect(() => {
        fetchOverview();
        const interval = setInterval(() => fetchOverview(true), 5000);
        return () => clearInterval(interval);
    }, [fetchOverview]);

    const filteredData = useMemo(() => {
        if (!searchQuery) return overviewData;
        return overviewData.filter(user => 
            user.profile.full_name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [overviewData, searchQuery]);

    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }
    
    if (error) {
        return <div className="p-8 text-red-500">Error: {error}</div>;
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight font-headline text-foreground">Student Risk Monitor</h1>
                    <p className="text-muted-foreground">Live risk overview of your assigned students.</p>
                </div>
                <div className="flex w-full md:w-auto items-center gap-2">
                    <div className="relative flex-1 md:flex-initial md:w-64">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search by student name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <Button onClick={() => fetchOverview()} variant="outline" size="icon" disabled={isRefreshing}>
                        {isRefreshing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                    </Button>
                </div>
            </header>
            
            <Accordion type="multiple" defaultValue={filteredData.map(u => u.profile.id)} className="space-y-4">
                {filteredData.map(user => (
                    <AccordionItem key={user.profile.id} value={user.profile.id} className="border-b-0">
                        <Card>
                            <AccordionTrigger className="p-4 hover:no-underline [&[data-state=open]]:border-b">
                                <div className="flex justify-between items-center w-full pr-4">
                                    <p className="font-semibold text-lg">{user.profile.full_name}</p>
                                    <Badge variant={user.profile.is_active ? "default" : "destructive"}>
                                        {user.profile.is_active ? "Active" : "Inactive"}
                                    </Badge>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                                    <DataCard title="Opening Balance" value={user.portfolio.opening_balance_today} />
                                    <DataCard title="High Water Mark" value={user.portfolio.high_water_mark} />
                                    <DataCard title="Cash Balance" value={user.portfolio.cash_balance} />
                                    <PnlCard title="Realized P&L (Today)" value={user.pnl.realized_today} />
                                    <PnlCard title="Total Realized P&L" value={user.pnl.total_overall_pnl} />
                                    <PnlCard title="Live P&L" value={user.pnl.live} />
                                </div>
                                <div className="space-y-4 mb-6">
                                    <BreachCard 
                                        title="Daily Loss" 
                                        pnl={user.pnl.realized_today} 
                                        limit={user.breachLevels.daily_loss_limit} 
                                        percentage={user.profile.daily_loss_limit_percentage}
                                    />
                                    <BreachCard 
                                        title="Max Drawdown" 
                                        pnl={user.pnl.total_overall_pnl}
                                        limit={user.breachLevels.max_drawdown_limit}
                                        percentage={user.profile.loss_limit_percentage}
                                    />
                                </div>
                                <Card>
                                    <CardHeader><CardTitle>Live Positions</CardTitle></CardHeader>
                                    <CardContent>
                                        {user.live_positions.length > 0 ? (
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Instrument</TableHead>
                                                        <TableHead>Qty</TableHead>
                                                        <TableHead>Live P&L</TableHead>
                                                        <TableHead>Breach Level ({user.profile.per_trade_loss_limit_percentage}%)</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {user.live_positions.map(pos => (
                                                        <TableRow key={pos.id}>
                                                            <TableCell>{pos.symbol}</TableCell>
                                                            <TableCell>{pos.quantity}</TableCell>
                                                            <TableCell className={cn(pos.live_pnl < 0 ? "text-red-500" : "text-green-500", pos.live_pnl < pos.breach_level && "font-bold")}>
                                                                {formatCurrency(pos.live_pnl, true)}
                                                            </TableCell>
                                                            <TableCell className="text-red-500">{formatCurrency(pos.breach_level)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        ) : (
                                            <p className="text-center text-muted-foreground p-4">No open positions.</p>
                                        )}
                                    </CardContent>
                                </Card>
                            </AccordionContent>
                        </Card>
                    </AccordionItem>
                ))}
            </Accordion>
            {filteredData.length === 0 && !isLoading && (
                <div className="text-center text-muted-foreground p-8">
                    <p>No students found.</p>
                </div>
            )}
        </div>
    );
}
