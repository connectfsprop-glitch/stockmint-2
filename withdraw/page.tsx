'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { requestWithdrawal } from '@/app/actions/request-withdrawal';
import { AppLayout } from '@/components/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useUserProfile } from '@/hooks/use-user-profile';

/**
 * @fileOverview Withdraw Page
 * Simplified payout request interface.
 */

function WithdrawalPageContent() {
    const { toast } = useToast();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { user } = useUserProfile();

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        
        if (!user) {
            setError('Please log in to make a withdrawal request.');
            return;
        }
        
        setIsLoading(true);
        setError(null);

        const formData = new FormData(event.currentTarget);
        const result = await requestWithdrawal(user.id, formData);

        if (result.success) {
            toast({ title: 'Request Sent', description: 'We are processing your withdrawal.' });
            router.push('/funds');
        } else {
            setError(result.message);
            toast({ variant: 'destructive', title: 'Request Failed', description: result.message });
        }

        setIsLoading(false);
    };

    return (
        <div className="flex flex-col gap-6 md:gap-10 animate-in fade-in duration-1000 slide-in-from-bottom-4">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/10">
                <div className="space-y-1">
                    <h1 className="font-headline text-3xl md:text-5xl font-black tracking-tighter text-white">Withdraw.</h1>
                </div>
            </header>

            <main className="flex justify-center items-start">
                <div className="w-full max-w-lg space-y-6">
                    <Card className="w-full border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
                        <CardHeader className="pt-8 px-8">
                            <CardTitle className="font-headline text-xl font-bold text-slate-800">Request payout</CardTitle>
                            <CardDescription className="text-[11px] font-medium text-slate-400">
                                Enter your UPI details and the amount you want to withdraw. We usually process this within 24 hours.
                            </CardDescription>
                        </CardHeader>
                        <form onSubmit={handleSubmit}>
                            <CardContent className="grid gap-4 py-6 px-8">
                                {error && (
                                    <Alert variant="destructive" className="rounded-2xl bg-rose-50 border-rose-100 text-rose-600">
                                        <AlertTitle className="text-xs font-bold">Error</AlertTitle>
                                        <AlertDescription className="text-[11px] font-bold">{error}</AlertDescription>
                                    </Alert>
                                )}
                                <div className="space-y-1.5">
                                    <Label htmlFor="amount" className="text-[11px] font-bold text-slate-400 ml-1">Amount (INR)</Label>
                                    <Input 
                                        id="amount" 
                                        name="amount" 
                                        type="number" 
                                        step="0.01" 
                                        required 
                                        className="bg-slate-50 border-none h-12 rounded-xl px-4 font-bold text-slate-900 focus:ring-2 focus:ring-[#5D2D91]/10"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="upiId" className="text-[11px] font-bold text-slate-400 ml-1">UPI ID</Label>
                                    <Input 
                                        id="upiId" 
                                        name="upiId" 
                                        placeholder="name@bank" 
                                        required 
                                        className="bg-slate-50 border-none h-12 rounded-xl px-4 font-bold text-slate-900 focus:ring-2 focus:ring-[#5D2D91]/10"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="qrCode" className="text-[11px] font-bold text-slate-400 ml-1">Upload UPI QR code</Label>
                                    <Input 
                                        id="qrCode" 
                                        name="qrCode" 
                                        type="file" 
                                        accept="image/*" 
                                        required 
                                        className="bg-slate-50 border-none h-12 rounded-xl px-4 font-bold text-slate-900 file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-[#5D2D91] file:text-white"
                                    />
                                </div>
                            </CardContent>
                            <CardFooter className="pb-8 px-8">
                                <Button 
                                    type="submit" 
                                    disabled={isLoading} 
                                    className="w-full h-14 rounded-[1.25rem] bg-[#5D2D91] text-white hover:bg-[#4A1E7A] font-black text-sm shadow-xl transition-all active:scale-95"
                                >
                                    {isLoading ? (
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span>Processing...</span>
                                        </div>
                                    ) : 'Get my payout'}
                                </Button>
                            </CardFooter>
                        </form>
                    </Card>

                    <Button 
                        asChild 
                        variant="outline" 
                        className="w-full h-14 rounded-2xl bg-white hover:bg-slate-50 text-[#5D2D91] border-slate-200 font-bold text-sm shadow-sm transition-all active:scale-95"
                    >
                        <a href="https://t.me/FundedStock_assistant_bot" target="_blank" rel="noopener noreferrer">
                            <Send className="mr-2 h-4 w-4" /> Message support
                        </a>
                    </Button>
                </div>
            </main>
        </div>
    );
}

export default function WithdrawalPage() {
    return (
        <AppLayout>
            <WithdrawalPageContent />
        </AppLayout>
    );
}
