
'use client';

import React, { useEffect, useState } from 'react';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Button } from '@/components/ui/button';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * @fileOverview Demo Guardian
 * Implements the 30-hour kill-switch for direct-signup users with correct message.
 */

export function DemoGuardian({ children }: { children: React.ReactNode }) {
    const { user, profile } = useUserProfile();
    const [isExpired, setIsExpired] = useState(false);
    const router = useRouter();

    useEffect(() => {
        if (!profile || profile.role === 'admin' || profile.role === 'support') return;

        if (profile.account_classification === 'demo') {
            const createdAt = new Date(profile.created_at).getTime();
            const now = new Date().getTime();
            const diffHours = (now - createdAt) / (1000 * 60 * 60);

            if (diffHours >= 30) {
                setIsExpired(true);
            }
        }
    }, [profile]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/login');
        setIsExpired(false);
    };

    if (isExpired) {
        return (
            <div className="relative min-h-screen">
                <div className="fixed inset-0 blur-3xl opacity-50 bg-[#050508] pointer-events-none z-0" />
                <div className="relative z-50 flex items-center justify-center min-h-screen p-6">
                    <div className={cn("bg-white border-none rounded-[2.5rem] shadow-2xl p-10 max-w-md w-full animate-in zoom-in duration-500")}>
                        <div className="flex flex-col items-center text-center space-y-6">
                            <div className="h-16 w-16 rounded-2xl bg-rose-50 flex items-center justify-center border border-rose-100 shadow-inner">
                                <ShieldAlert className="h-8 w-8 text-rose-500" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight font-headline">Session expired</h2>
                                <p className="text-sm font-medium text-slate-500 leading-relaxed">
                                    Your demo has expired. Please go to <span className="text-primary font-bold">fundedstock.io</span> to explore more.
                                </p>
                            </div>
                            <div className="w-full pt-4 space-y-3">
                                <Button asChild className="w-full h-14 rounded-2xl bg-[#5D2D91] text-white font-bold text-sm shadow-xl active:scale-95 transition-all">
                                    <a href="https://fundedstock.io" target="_blank" rel="noopener noreferrer">
                                        Visit fundedstock.io <ArrowRight className="ml-2 h-4 w-4" />
                                    </a>
                                </Button>
                                <Button variant="ghost" onClick={handleSignOut} className="w-full text-slate-400 font-bold text-xs">
                                    Sign out
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>
}
