
'use client';
import { useUserProfile } from "@/hooks/use-user-profile";
import { Skeleton } from "@/components/ui/skeleton";
import { 
    LayoutDashboard, Users, Book, LogOut, Activity, Settings, 
    Menu, ShieldCheck, Server, List, ShieldAlert, BarChart3, 
    CreditCard, ArrowRightLeft, Zap, Layers, Shield, Globe, UserCheck
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import React, { useState, useEffect } from "react";

/**
 * @fileOverview Admin Layout
 * Added Demo Users Terminal.
 */

interface NavItem {
    href: string;
    label: string;
    icon: any;
    market?: 'indian' | 'forex' | 'both';
}

function AdminNavContent({ currentMarket }: { currentMarket: 'indian' | 'forex' }) {
    const pathname = usePathname();
    const router = useRouter();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    const navItems: NavItem[] = [
        { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, market: 'both' },
        { href: '/admin/demo-users', label: 'Demo ledger', icon: UserCheck, market: 'both' },
        { href: '/admin/analytics', label: 'Analytics', icon: BarChart3, market: 'both' },
        { href: '/admin/forex-hub', label: 'Forex Hub', icon: Globe, market: 'forex' },
        { href: '/admin/user-list', label: 'User list', icon: List, market: 'both' },
        { href: '/admin/model-manager', label: 'Move users', icon: ArrowRightLeft, market: 'indian' },
        { href: '/admin/instant-users', label: 'Instant list', icon: Zap, market: 'both' },
        { href: '/admin/instant-pro-users', label: 'Pro list', icon: Zap, market: 'both' },
        { href: '/admin/one-step-users', label: '1-Step list', icon: Activity, market: 'both' },
        { href: '/admin/two-step-users', label: '2-Step list', icon: Layers, market: 'both' },
        { href: '/admin/ptp-users', label: 'PTP list', icon: Shield, market: 'indian' },
        { href: '/admin/ptp-directory', label: 'PTP directory', icon: CreditCard, market: 'indian' },
        { href: '/admin/trades', label: 'Trade activity', icon: Book, market: 'both' },
        { href: '/admin/live-trades', label: 'Live trades', icon: Activity, market: 'both' },
        { href: '/admin/risk-monitor', label: 'Risk monitor', icon: ShieldCheck, market: 'both' },
        { href: '/admin/breaches', label: 'Violations', icon: ShieldAlert, market: 'both' },
        { href: '/admin/status', label: 'System health', icon: Server, market: 'indian' },
        { href: '/admin/settings', label: 'Settings', icon: Settings, market: 'both' },
    ];

    const filteredItems = navItems.filter(item => item.market === 'both' || item.market === currentMarket);

    return (
        <>
            <div className="p-8 border-b border-white/5 flex flex-col gap-6">
                <h2 className="text-xl font-black text-white font-headline tracking-tighter">Admin hub</h2>
            </div>
            <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto no-scrollbar">
                {filteredItems.map(item => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "flex items-center gap-3 rounded-xl px-4 py-3.5 text-[11px] font-bold transition-all duration-300",
                            pathname === item.href 
                                ? "bg-[#5D2D91] text-white shadow-xl" 
                                : "text-slate-500 hover:bg-white/5 hover:text-white"
                        )}
                    >
                        <item.icon className={cn("h-4 w-4", pathname === item.href ? "text-white" : "text-slate-600")} />
                        <span>{item.label}</span>
                    </Link>
                ))}
            </nav>
            <div className="p-4 border-t border-white/5 mt-auto">
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 rounded-xl px-4 py-3.5 text-[11px] font-bold text-rose-500 hover:bg-rose-500/10 transition-colors"
                >
                    <LogOut className="h-4 w-4" />
                    <span>Log out</span>
                </button>
            </div>
        </>
    )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthorized, hasCheckedAuth } = useUserProfile(['admin', 'support']);
  const [selectedMarket, setSelectedMarket] = useState<'indian' | 'forex'>('indian');

  useEffect(() => {
      const saved = localStorage.getItem('admin_market_view');
      if (saved) setSelectedMarket(saved as any);
  }, []);

  const handleMarketChange = (val: 'indian' | 'forex') => {
      setSelectedMarket(val);
      localStorage.setItem('admin_market_view', val);
      window.location.href = '/admin'; 
  };

  if (!hasCheckedAuth || isLoading) return <div className="p-20 text-center"><Skeleton className="h-20 w-full" /></div>;
  if (!isAuthorized) return null;

  return (
    <div className="flex min-h-screen bg-[#F2F4F7]">
        <aside className="w-72 flex-shrink-0 border-r border-white/5 bg-[#050508] flex-col hidden md:flex h-screen sticky top-0">
           <AdminNavContent currentMarket={selectedMarket} />
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
            <header className="h-20 flex items-center justify-between border-b border-slate-200 bg-white px-8 sticky top-0 z-50 shadow-sm">
                <div className="flex items-center gap-6">
                    <h1 className="text-xl font-black font-headline tracking-tighter text-slate-900 md:hidden">Admin</h1>
                    
                    <div className="hidden md:flex items-center gap-2 bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                        <button 
                            onClick={() => handleMarketChange('indian')}
                            className={cn(
                                "px-6 py-2.5 rounded-xl text-[11px] font-bold transition-all", 
                                selectedMarket === 'indian' ? "bg-white text-[#5D2D91] shadow-lg" : "text-slate-400"
                            )}
                        >India market</button>
                        <button 
                            onClick={() => handleMarketChange('forex')}
                            className={cn(
                                "px-6 py-2.5 rounded-xl text-[11px] font-bold transition-all", 
                                selectedMarket === 'forex' ? "bg-white text-[#5D2D91] shadow-lg" : "text-slate-400"
                            )}
                        >Forex market</button>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <Badge className={cn(
                        "text-[10px] font-bold px-4 py-1.5 rounded-full border-none",
                        selectedMarket === 'indian' ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                    )}>
                        {selectedMarket} tools
                    </Badge>
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="md:hidden h-12 w-12 rounded-2xl bg-slate-50 border border-slate-100">
                                <Menu className="h-6 w-6 text-[#5D2D91]" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="w-80 p-0 bg-[#050508] border-r-white/5 flex flex-col">
                            <AdminNavContent currentMarket={selectedMarket} />
                        </SheetContent>
                    </Sheet>
                </div>
            </header>

            <main className="flex-1 overflow-x-hidden">
                <div className="p-4 sm:p-8 lg:p-10 max-w-[1600px] mx-auto">
                    {children}
                </div>
            </main>
        </div>
    </div>
  );
}
