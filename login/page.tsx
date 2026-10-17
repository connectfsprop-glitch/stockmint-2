'use client';

import React, { useState, useTransition, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Lock, Mail, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/**
 * @fileOverview Login Page
 * Simplified authentication terminal with welcoming language.
 */

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const errorType = searchParams.get('error');
    if (errorType === 'restricted') {
      setError('Account restricted: Please complete your verification to resume trading.');
    } else if (errorType === 'unauthorized') {
      setError('Unauthorized: You do not have permission to access this area.');
    }
  }, [searchParams]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    startTransition(async () => {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, is_kyc_blocked')
          .eq('id', data.user.id)
          .single();

        if (profile?.is_kyc_blocked) {
          await supabase.auth.signOut();
          setError('Access restricted: Verification pending.');
          return;
        }

        toast({ title: 'Welcome back', description: 'Login successful.' });
        
        if (profile?.role === 'admin') router.push('/admin');
        else if (profile?.role === 'mentor') router.push('/mentor/dashboard');
        else if (profile?.role === 'support') router.push('/support-team');
        else router.push('/dashboard');
      }
    });
  };

  return (
    <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <CardHeader className="pt-10 px-8 text-center space-y-2">
        <CardTitle className="text-2xl font-black text-slate-900 font-headline tracking-tight">Welcome back</CardTitle>
        <CardDescription className="text-[11px] font-bold text-slate-400">Enter your details to log in</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="px-8 space-y-6">
          {error && (
            <Alert variant="destructive" className="rounded-2xl bg-rose-50 border-rose-100 text-rose-600">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle className="text-[11px] font-black ml-2">Login Failed</AlertTitle>
              <AlertDescription className="text-[11px] font-bold leading-relaxed ml-2">{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[11px] font-bold text-slate-400 ml-1">Email address</Label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-[#5D2D91] transition-colors" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@email.com"
                  required
                  className="bg-slate-50 border-none h-12 pl-11 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-[#5D2D91]/10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[11px] font-bold text-slate-400 ml-1">Password</Label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-[#5D2D91] transition-colors" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  className="bg-slate-50 border-none h-12 pl-11 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-[#5D2D91]/10"
                />
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="p-8 pt-6">
          <Button
            type="submit"
            disabled={isPending}
            className="w-full h-14 rounded-2xl bg-[#5D2D91] text-white hover:bg-[#4A1E7A] font-black text-xs shadow-xl purple-glow transition-all active:scale-95"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Log in
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#F2F4F7] relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl h-full max-h-2xl bg-[#5D2D91]/5 blur-[120px] pointer-events-none rounded-full" />
      
      <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in-95 duration-1000 px-6">
        <div className="text-center space-y-1">
            <h1 className="text-4xl font-black font-headline tracking-tighter text-slate-900">StockMint</h1>
            <p className="text-[11px] font-bold text-[#5D2D91] tracking-wide">Professional Trading Hub</p>
        </div>

        <Suspense fallback={<div className="h-64 w-full flex items-center justify-center"><Loader2 className="animate-spin text-[#5D2D91]" /></div>}>
          <LoginForm />
        </Suspense>

        <div className="text-center">
            <p className="text-[9px] font-bold text-slate-300 tracking-wider">Secure encrypted login</p>
        </div>
      </div>
    </div>
  );
}
