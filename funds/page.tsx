'use client';

import {
  Wallet,
  Plus,
  ArrowRightLeft,
  ArrowUp,
  ArrowDown,
  Download,
  Send
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserProfile } from '@/hooks/use-user-profile';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AppLayout } from '@/components/app-layout';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { getFundDetails } from '../actions/get-fund-details';
import { supabase } from '@/lib/supabase';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

/**
 * @fileOverview Wallet Page
 * Simplified financial terminal with easy language.
 */

type FundDetailsData = {
    usedMargin: number;
    payoutToday: number;
    openingBalance: number;
};

type Portfolio = {
    id: string;
    user_id: string;
    cash_balance: number;
};

type Transaction = {
    id: number;
    created_at: string;
    amount: number;
    status: string;
    type: 'DEPOSIT' | 'WITHDRAWAL';
};

const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' + 
           date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function TransactionHistory({ userId, currencySymbol }: { userId: string, currencySymbol: string }) {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const formatCurrency = (amount: number | null | undefined, placeholder = '0.00') => {
        if (amount === null || typeof amount === 'undefined' || isNaN(amount)) return placeholder;
        return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
    };

    const fetchTransactions = useCallback(async () => {
        setIsLoading(true);
        const [{ data: deposits }, { data: withdrawals }] = await Promise.all([
            supabase.from('deposit_requests').select('id, created_at, amount, status').eq('user_id', userId),
            supabase.from('withdrawal_requests').select('id, created_at, amount, status').eq('user_id', userId)
        ]);

        const combined = [
            ...(deposits || []).map(d => ({ ...d, type: 'DEPOSIT' as const })),
            ...(withdrawals || []).map(w => ({ ...w, type: 'WITHDRAWAL' as const }))
        ];
        combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setTransactions(combined);
        setIsLoading(false);
    }, [userId]);

    useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

    if (isLoading) return <div className="space-y-3 p-4">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl bg-white/5" />)}</div>;
    
    if (transactions.length === 0) {
        return (
            <div className="py-20 text-center glass rounded-[2rem] border-dashed border-gray-200 m-4">
                <Wallet className="h-12 w-12 mx-auto mb-4 opacity-10" />
                <p className="text-slate-400 font-bold text-xs">No transactions yet</p>
            </div>
        );
    }

    return (
        <div className="space-y-3 px-4 pb-10">
            {transactions.map(tx => (
                <div key={`${tx.type}-${tx.id}`} className="bg-white rounded-2xl overflow-hidden border border-gray-100 relative shadow-sm">
                    <div className={cn(
                        "absolute left-0 top-0 bottom-0 w-1 transition-all duration-500",
                        tx.type === 'DEPOSIT' ? "bg-emerald-500" : "bg-rose-500"
                    )} />
                    <div className="p-4 flex items-center justify-between gap-4 relative z-10">
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                "h-10 w-10 rounded-xl flex items-center justify-center",
                                tx.type === 'DEPOSIT' ? "bg-emerald-50 text-emerald-500" : "bg-rose-50 text-rose-500"
                            )}>
                                {tx.type === 'DEPOSIT' ? <ArrowUp className="h-5 w-5" /> : <ArrowDown className="h-5 w-5" />}
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-800">{tx.type === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'}</p>
                                <p className="text-[10px] font-medium text-slate-400 mt-0.5">{formatDate(tx.created_at)}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className={cn("text-sm font-black tracking-tight", tx.type === 'DEPOSIT' ? "text-emerald-500" : "text-rose-500")}>
                                {tx.type === 'DEPOSIT' ? '+' : '-'}{currencySymbol}{formatCurrency(tx.amount)}
                            </p>
                            <Badge variant="outline" className={cn(
                                "text-[9px] font-bold py-0 px-2 mt-1 rounded-md border-none",
                                tx.status === 'APPROVED' ? "bg-emerald-50 text-emerald-600" : 
                                tx.status === 'PENDING' ? "bg-amber-50 text-amber-600" : 
                                "bg-rose-50 text-rose-600"
                            )}>
                                {tx.status}
                            </Badge>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}

function FundsPageContent() {
    const { user, profile } = useUserProfile(['student', 'admin', 'mentor', 'support']);
    const isMobile = useIsMobile();
    const router = useRouter();
    const { toast } = useToast();
    const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
    const [fundDetails, setFundDetails] = useState<FundDetailsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    
    const isForex = profile?.market_type === 'forex';
    const currencySymbol = isForex ? '$' : '₹';

    const formatCurrency = (amount: number | null | undefined, placeholder = '0.00') => {
        if (amount === null || typeof amount === 'undefined' || isNaN(amount)) return placeholder;
        return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
    };

    const fetchAllData = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        const [portfolioRes, detailsRes] = await Promise.all([
            supabase.from('portfolios').select('*').eq('user_id', user.id).single(),
            getFundDetails(user.id)
        ]);
        if (portfolioRes.data) setPortfolio(portfolioRes.data);
        if (detailsRes.success) setFundDetails(detailsRes.data);
        setIsLoading(false);
    }, [user]);

    useEffect(() => { fetchAllData(); }, [fetchAllData]);

    const generateReport = async () => {
        if (!user || !profile) return;
        setIsGenerating(true);
        try {
            const doc = new jsPDF();
            const { data: orders } = await supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
            
            doc.setFontSize(18); doc.text("Account Statement", 14, 22);
            doc.setFontSize(10); doc.text(`Trader: ${profile.full_name} (${isForex ? 'USD' : 'INR'})`, 14, 30);
            
            (doc as any).autoTable({
                head: [['Date', 'Instrument', 'Type', 'Qty', 'Price', 'Status', 'Profit/Loss']],
                body: (orders || []).map(o => [
                    new Date(o.created_at).toLocaleString(), 
                    o.symbol, 
                    o.order_type, 
                    o.quantity, 
                    formatCurrency(o.price), 
                    o.status, 
                    o.pnl ? formatCurrency(o.pnl) : '-'
                ]),
                startY: 40,
                headStyles: { fillColor: [93, 45, 145] },
            });
            doc.save(`${profile.full_name}_statement.pdf`);
            toast({ title: "Success", description: "Your report has been generated." });
        } catch (e) {
            toast({ variant: "destructive", title: "Report Failed", description: "Could not generate report." });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <AppLayout>
            <div className="flex flex-col gap-6 md:gap-10 max-w-7xl mx-auto animate-in fade-in duration-1000 slide-in-from-bottom-4">
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/10">
                    <div className="space-y-1">
                        <h1 className="font-headline text-3xl md:text-5xl font-black tracking-tighter text-white">Wallet</h1>
                    </div>

                    <Button 
                        variant="ghost" 
                        disabled={isGenerating || isLoading}
                        className="h-12 px-6 rounded-2xl bg-white/10 text-white border border-white/20 hover:bg-white/20 font-bold text-xs" 
                        onClick={generateReport}
                    >
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        Download statement
                    </Button>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 space-y-6">
                        <Card className="bg-white rounded-[2.5rem] border-none overflow-hidden relative p-8 shadow-xl">
                            <div className="relative z-10 flex flex-col items-center justify-center text-center gap-1">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Available balance</p>
                                {isLoading ? <Skeleton className="h-12 w-48 mt-2 bg-slate-100" /> : 
                                    <p className="text-4xl md:text-5xl font-black tracking-tighter text-slate-900">
                                        {currencySymbol}{formatCurrency(portfolio?.cash_balance)}
                                    </p>
                                }
                                <div className="text-[10px] font-bold px-4 py-1.5 rounded-full mt-6 bg-purple-50 text-purple-600 border border-purple-100 uppercase">
                                    Safe & secure
                                </div>
                            </div>
                        </Card>

                        <Button asChild variant="outline" className="w-full h-14 rounded-2xl bg-white hover:bg-slate-50 text-[#5D2D91] hover:text-[#5D2D91] border-slate-200 font-bold text-sm shadow-sm transition-all active:scale-95">
                            <a href="https://t.me/FundedStock_assistant_bot" target="_blank" rel="noopener noreferrer">
                                <Send className="mr-2 h-4 w-4" /> Message support
                            </a>
                        </Button>

                        <div className="grid grid-cols-2 gap-3">
                            <Button asChild className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold h-14 text-sm rounded-2xl shadow-lg transition-all">
                                <Link href="/add-funds"><Plus className="mr-2 h-5 w-5" /> Add money</Link>
                            </Button>
                            <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-14 text-sm rounded-2xl shadow-lg transition-all">
                                <Link href="/withdraw"><ArrowRightLeft className="mr-2 h-5 w-5" /> Withdraw</Link>
                            </Button>
                        </div>

                        <div className="bg-white rounded-[2rem] p-6 space-y-4 shadow-sm border border-gray-50">
                            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                                <span className="text-slate-400">Starting balance</span>
                                <span className="text-slate-800">{currencySymbol}{formatCurrency(fundDetails?.openingBalance)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                                <span className="text-slate-400">Payout today</span>
                                <span className="text-rose-500">{currencySymbol}{formatCurrency(fundDetails?.payoutToday)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest pt-4 border-t border-gray-50">
                                <span className="text-purple-600">Current balance</span>
                                <span className="text-slate-900">{currencySymbol}{formatCurrency(portfolio?.cash_balance)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-2">
                        <div className="flex items-center gap-3 mb-6 px-4 md:px-0">
                            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Recent history</h2>
                            <span className="text-[11px] font-bold text-slate-400">Your transactions</span>
                        </div>
                        {user && <TransactionHistory userId={user.id} currencySymbol={currencySymbol} />}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

export default function FundsPage() { return <FundsPageContent />; }
