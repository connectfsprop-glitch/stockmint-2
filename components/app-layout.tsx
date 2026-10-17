
'use client';
import { usePathname } from 'next/navigation';
import { useUserProfile } from '@/hooks/use-user-profile';
import { cn } from '@/lib/utils';
import { Home, Bookmark, Book, LayoutGrid, Wallet, Zap, Search } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { NotificationBell } from './notification-bell';
import { Button } from './ui/button';
import Link from 'next/link';

/**
 * @fileOverview Main App Shell
 * Removed all-caps typography and hardcoded name placeholders.
 */

const navItems = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/watchlist', label: 'Watchlist', icon: Bookmark },
  { href: '/portfolio', label: 'Positions', icon: LayoutGrid, isCenter: true },
  { href: '/orders', label: 'Orders', icon: Book },
  { href: '/funds', label: 'Wallet', icon: Wallet },
];

function MobileBottomNav({ items, pathname }: { items: typeof navItems, pathname: string }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-6 pb-8 md:hidden pointer-events-none">
      <nav className="bg-white/80 backdrop-blur-3xl rounded-[2.5rem] border border-white/40 h-20 flex items-center justify-around shadow-[0_25px_60px_rgba(0,0,0,0.15)] px-2 pointer-events-auto relative">
        {items.map((item) => {
          const active = pathname === item.href;
          
          if (item.isCenter) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center group transform active:scale-95 transition-all duration-200"
              >
                <div className="relative">
                    <div className={cn(
                        "absolute inset-0 rounded-full blur-md transition-all duration-500",
                        active ? "bg-[#5D2D91]/20 opacity-100" : "bg-transparent opacity-0"
                    )} />
                    
                    <div className={cn(
                        "h-14 w-14 rounded-full p-1 transition-all duration-500 relative z-10",
                        active ? "bg-[#5D2D91]/10" : "bg-transparent"
                    )}>
                        <div className={cn(
                            "h-full w-full rounded-full flex items-center justify-center transition-all duration-500 shadow-sm",
                            active ? "bg-gradient-to-br from-[#5D2D91] to-[#4A1E7A] text-white" : "bg-gray-50 text-[#5D2D91]"
                        )}>
                            <Zap className={cn("h-6 w-6", active ? "fill-white" : "fill-none")} />
                        </div>
                    </div>
                </div>
                <span className={cn(
                  "text-[10px] font-bold mt-1 transition-all duration-300 font-headline",
                  active ? "text-[#5D2D91] opacity-100" : "text-gray-400 opacity-60"
                )}>
                  {item.label}
                </span>
              </Link>
            );
          }

          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 transition-all duration-300 transform active:scale-95 px-2",
                active ? "text-[#5D2D91]" : "text-gray-400"
              )}
            >
              <div className="relative">
                  <Icon className={cn("h-5 w-5 transition-all", active ? "stroke-[2.5px]" : "stroke-2 opacity-60")} />
                  {active && (
                      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-[#5D2D91]" />
                  )}
              </div>
              <span className={cn(
                "text-[10px] font-bold mt-0.5 font-headline",
                active ? "opacity-100" : "opacity-40"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile, isLoading } = useUserProfile(['student', 'admin', 'mentor', 'support']);

  return (
    <div className="flex min-h-screen flex-col bg-[#F2F4F7]">
      <header className="dhan-header px-6 md:px-16 pt-8 pb-20 md:pb-32 flex flex-col gap-6">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-10">
             {isLoading ? (
               <Skeleton className="h-12 w-12 rounded-2xl bg-white/10" />
             ) : (
               <div className="flex items-center gap-3">
                 <Link href="/profile">
                   <Avatar className="h-12 w-12 rounded-2xl border-2 border-white/20 shadow-xl overflow-hidden bg-white active:scale-95 transition-transform">
                     <AvatarImage src="/logo.png" alt="Profile Icon" className="object-contain p-2" />
                     <AvatarFallback className="bg-white/10 text-white font-black">{profile?.full_name?.charAt(0) || 'U'}</AvatarFallback>
                   </Avatar>
                 </Link>
                 
                 <div className="flex items-center gap-1.5">
                    <span className="text-white/60 text-sm font-medium">Hello</span>
                    <div className="relative">
                        <span className="text-white text-lg font-black tracking-tight font-headline">
                            Trader
                        </span>
                        <div className="absolute -bottom-1 left-0 right-0 h-[2.5px] bg-amber-400 rounded-full" />
                    </div>
                 </div>
               </div>
             )}
             
             <nav className="hidden xl:flex items-center gap-8 ml-6">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "text-[13px] font-black transition-all font-headline",
                      pathname === item.href 
                        ? "text-amber-400" 
                        : "text-white/60 hover:text-white"
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
             </nav>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
             <NotificationBell />
             <Link href="/watchlist">
                <Button variant="ghost" size="icon" className="h-10 w-10 flex items-center justify-center text-white/80 hover:text-white transition-transform active:scale-90">
                    <Search className="h-6 w-6" />
                </Button>
             </Link>
          </div>
        </div>
      </header>
      
      <main className="flex-1 -mt-10 md:-mt-20 relative z-10 px-4 md:px-16 pb-48">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      <MobileBottomNav items={navItems} pathname={pathname} />
    </div>
  );
}
