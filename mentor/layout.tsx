'use client';
import { useUserProfile } from "@/hooks/use-user-profile";
import { Skeleton } from "@/components/ui/skeleton";
import { LayoutDashboard, Users, Activity, ShieldCheck, LogOut, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import React from "react";

function MentorLayoutSkeleton() {
    return (
        <div className="flex min-h-screen bg-muted/40">
            <aside className="w-64 flex-shrink-0 border-r bg-background flex-col hidden md:flex h-screen sticky top-0 p-4 space-y-2">
                 <div className="p-4 border-b">
                    <Skeleton className="h-6 w-3/4" />
                </div>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <div className="p-4 border-t mt-auto">
                    <Skeleton className="h-10 w-full" />
                </div>
            </aside>
            <div className="flex-1 flex flex-col">
                 <header className="flex md:hidden h-16 items-center justify-between border-b bg-background px-4 sticky top-0 z-10">
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-8 w-8" />
                </header>
                <main className="flex-1 overflow-y-auto p-8">
                    <Skeleton className="h-96 w-full" />
                </main>
            </div>
        </div>
    );
}

function MentorNavContent() {
    const pathname = usePathname();
    const router = useRouter();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    const navItems = [
        { href: '/mentor/dashboard', label: 'My Students', icon: Users },
        { href: '/mentor/live-trades', label: 'Live Trades', icon: Activity },
        { href: '/mentor/risk-monitor', label: 'Risk Monitor', icon: ShieldCheck },
    ];

    return (
        <>
            <div className="p-4 border-b">
                <h2 className="text-xl font-bold text-foreground">Mentor Panel</h2>
            </div>
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                {navItems.map(item => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "flex items-center gap-3 rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                            pathname.startsWith(item.href) && "bg-primary/10 text-primary font-semibold"
                        )}
                    >
                        <item.icon className="h-5 w-5" />
                        <span>{item.label}</span>
                    </Link>
                ))}
            </nav>
            <div className="p-4 border-t mt-auto">
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                    <LogOut className="h-5 w-5" />
                    <span>Logout</span>
                </button>
            </div>
        </>
    )
}

function DesktopMentorNav() {
    return (
        <aside className="w-64 flex-shrink-0 border-r bg-background flex-col hidden md:flex h-screen sticky top-0">
           <MentorNavContent />
        </aside>
    )
}

function MobileMentorNav() {
    const [isOpen, setIsOpen] = React.useState(false);
    return (
        <header className="flex md:hidden h-16 items-center justify-between border-b bg-background px-4 sticky top-0 z-10">
            <h1 className="text-lg font-bold">Mentor Panel</h1>
             <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetTrigger asChild>
                    <Button variant="outline" size="icon">
                        <Menu className="h-6 w-6" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0 bg-background flex flex-col">
                    <SheetHeader className="sr-only">
                        <SheetTitle>Mentor Menu</SheetTitle>
                        <SheetDescription>
                            Navigation panel for mentor tasks.
                        </SheetDescription>
                    </SheetHeader>
                    <MentorNavContent />
                </SheetContent>
            </Sheet>
        </header>
    )
}

export default function MentorLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthorized, hasCheckedAuth } = useUserProfile(['mentor']);

  if (!hasCheckedAuth || isLoading) {
    return <MentorLayoutSkeleton />;
  }

  if (!isAuthorized) {
    return null; // The hook will handle the redirect
  }

  return (
    <div className="flex min-h-screen bg-muted/40">
        <DesktopMentorNav />
        <div className="flex-1 flex flex-col">
            <MobileMentorNav />
            <main className="flex-1 overflow-y-auto">
                {children}
            </main>
        </div>
    </div>
  );
}
