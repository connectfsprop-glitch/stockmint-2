
'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Lock, Mail, User, Phone, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { signupDemoUser } from '../actions/signup-demo';

/**
 * @fileOverview Demo Sign Up Page
 * Welcoming Mixed-Case Typography.
 */

export default function SignupPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);

        const formData = new FormData(event.currentTarget);
        const fullName = formData.get('fullName') as string;
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;
        const whatsapp = formData.get('whatsapp') as string;

        if (!fullName || !email || !password || !whatsapp) {
            setError('Please fill in all details.');
            return;
        }

        startTransition(async () => {
            const result = await signupDemoUser({ fullName, email, password, whatsapp });
            if (result.success) {
                toast({ title: 'Welcome to StockMint', description: 'Your demo account is active for 30 hours.' });
                router.push('/dashboard');
            } else {
                setError(result.message);
            }
        });
    };

    return (
        <div className="flex min-h-screen w-full items-center justify-center bg-[#F2F4F7] relative overflow-hidden px-6">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl h-full max-h-2xl bg-[#5D2D91]/5 blur-[120px] pointer-events-none rounded-full" />
            
            <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in-95 duration-1000">
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-black font-headline tracking-tighter text-slate-900">Get started.</h1>
                    <p className="text-sm font-medium text-slate-400">Join the smart practice hub today.</p>
                </div>

                <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
                    <CardHeader className="pt-10 px-8 text-center space-y-1">
                        <CardTitle className="text-2xl font-black text-slate-900 font-headline tracking-tight">Create demo account</CardTitle>
                        <CardDescription className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">30-hour full access</CardDescription>
                    </CardHeader>
                    <form onSubmit={handleSubmit}>
                        <CardContent className="px-8 space-y-5">
                            {error && (
                                <Alert variant="destructive" className="rounded-2xl bg-rose-50 border-rose-100 text-rose-600">
                                    <AlertDescription className="text-[11px] font-bold leading-relaxed">{error}</AlertDescription>
                                </Alert>
                            )}

                            <div className="space-y-1.5">
                                <Label htmlFor="fullName" className="text-[11px] font-bold text-slate-400 ml-1">Full name</Label>
                                <div className="relative group">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-[#5D2D91] transition-colors" />
                                    <Input id="fullName" name="fullName" placeholder="John Doe" required className="bg-slate-50 border-none h-12 pl-11 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-[#5D2D91]/10" />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="email" className="text-[11px] font-bold text-slate-400 ml-1">Email address</Label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-[#5D2D91] transition-colors" />
                                    <Input id="email" name="email" type="email" placeholder="name@email.com" required className="bg-slate-50 border-none h-12 pl-11 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-[#5D2D91]/10" />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="whatsapp" className="text-[11px] font-bold text-slate-400 ml-1">WhatsApp number</Label>
                                <div className="relative group">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-[#5D2D91] transition-colors" />
                                    <Input id="whatsapp" name="whatsapp" placeholder="+91 00000 00000" required className="bg-slate-50 border-none h-12 pl-11 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-[#5D2D91]/10" />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="password" className="text-[11px] font-bold text-slate-400 ml-1">Security key (Password)</Label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-[#5D2D91] transition-colors" />
                                    <Input id="password" name="password" type="password" placeholder="••••••••" required className="bg-slate-50 border-none h-12 pl-11 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-[#5D2D91]/10" />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="p-8 pt-6">
                            <Button type="submit" disabled={isPending} className="w-full h-14 rounded-2xl bg-[#5D2D91] text-white hover:bg-[#4A1E7A] font-black text-xs shadow-xl purple-glow transition-all active:scale-95">
                                {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Start 30-hour demo
                            </Button>
                        </CardFooter>
                    </form>
                </Card>

                <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Already have an account? <button onClick={() => router.push('/login')} className="text-primary hover:underline">Log in</button>
                </p>
            </div>
        </div>
    );
}
