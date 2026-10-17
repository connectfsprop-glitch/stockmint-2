'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AppLayout } from '@/components/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Image from 'next/image';
import { getPaymentDetails } from '../actions/get-payment-details';
import { submitDepositRequest } from '../actions/submit-deposit-request';
import { useUserProfile } from '@/hooks/use-user-profile';

/**
 * @fileOverview Add Funds Page
 * Simplified language for adding capital.
 */

type PaymentDetails = {
    upi_id: string | null;
    qr_code_url: string | null;
};

function AddFundsPageContent() {
    const { toast } = useToast();
    const router = useRouter();
    const { user } = useUserProfile(['student', 'admin', 'mentor']);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [amount, setAmount] = useState('');
    const [transactionId, setTransactionId] = useState('');
    const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
    const [isLoadingDetails, setIsLoadingDetails] = useState(true);

    useEffect(() => {
        const fetchDetails = async () => {
            const result = await getPaymentDetails();
            if (result.success) {
                setPaymentDetails(result.data);
            } else {
                setError(result.error);
            }
            setIsLoadingDetails(false);
        };
        fetchDetails();
    }, []);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);

        if (!user) {
            setError("Please log in to continue.");
            return;
        }
        
        startTransition(async () => {
            const numericAmount = parseFloat(amount);
            if (isNaN(numericAmount) || numericAmount <= 0) {
                setError('Please enter a valid amount.');
                return;
            }
            if (!transactionId) {
                setError('Please enter your transaction ID.');
                return;
            }
            
            const result = await submitDepositRequest({ 
                userId: user.id, 
                amount: numericAmount, 
                transactionId 
            });

            if (result.success) {
                toast({ title: 'Request Sent', description: 'We are verifying your deposit now.' });
                router.push('/funds');
            } else {
                setError(result.message);
                toast({ variant: 'destructive', title: 'Submission Failed', description: result.message });
            }
        });
    };

    return (
        <div className="flex flex-col gap-6 md:gap-10 animate-in fade-in duration-1000 slide-in-from-bottom-4">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/10">
                <div className="space-y-1">
                    <h1 className="font-headline text-3xl md:text-5xl font-black tracking-tighter text-white">Add money.</h1>
                </div>
            </header>

            <main className="flex justify-center items-start">
                <div className="w-full max-w-lg space-y-8">
                     <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
                        <CardHeader className="pt-8 px-8">
                            <CardTitle className="font-headline text-xl font-bold text-slate-800">Payment details</CardTitle>
                            <CardDescription className="text-[11px] font-medium text-slate-400">
                                Send the money using the details below, then share the transaction ID.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="px-8 pb-8">
                             {isLoadingDetails ? (
                                <div className="flex justify-center items-center h-48"><Loader2 className="animate-spin text-[#5D2D91]" /></div>
                            ) : error || !paymentDetails || !paymentDetails.upi_id ? (
                                <Alert variant="destructive" className="rounded-2xl">
                                    <AlertDescription className="text-xs font-bold">{error || "Payment details are not available right now."}</AlertDescription>
                                </Alert>
                            ) : (
                                <div className="flex flex-col items-center gap-6">
                                    {paymentDetails.qr_code_url && (
                                        <div className="text-center w-full">
                                            <div className="relative w-full aspect-square max-w-[240px] mx-auto border-2 border-slate-50 rounded-[2rem] overflow-hidden bg-slate-50/30 p-4">
                                                <div className="relative w-full h-full">
                                                    <Image src={paymentDetails.qr_code_url} alt="QR Code" fill className="object-contain" />
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="sm" asChild className="mt-4 text-[#5D2D91] font-bold text-[11px]">
                                                <a href={paymentDetails.qr_code_url} download target="_blank" rel="noopener noreferrer">
                                                    <Download className="mr-2 h-4 w-4"/> Download QR
                                                </a>
                                            </Button>
                                        </div>
                                    )}
                                    <div className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 block">UPI ID</Label>
                                        <p className="text-lg font-bold text-slate-900 font-mono break-all">{paymentDetails.upi_id}</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
                        <CardHeader className="pt-8 px-8">
                            <CardTitle className="font-headline text-xl font-bold text-slate-800">Submit request</CardTitle>
                            <CardDescription className="text-[11px] font-medium text-slate-400">
                                Enter your payment details after you have sent the money.
                            </CardDescription>
                        </CardHeader>
                        <form onSubmit={handleSubmit}>
                            <CardContent className="grid gap-4 py-6 px-8">
                                {error && <Alert variant="destructive" className="rounded-2xl"><AlertDescription className="text-xs font-bold">{error}</AlertDescription></Alert>}
                                <div className="space-y-1.5">
                                    <Label htmlFor="amount" className="text-[11px] font-bold text-slate-400 ml-1">Amount sent (INR)</Label>
                                    <Input 
                                        id="amount" 
                                        name="amount" 
                                        type="number" 
                                        step="100" 
                                        placeholder="e.g. 5000"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="bg-slate-50 border-none h-12 rounded-xl px-4 font-bold text-slate-900 focus:ring-2 focus:ring-[#5D2D91]/10"
                                        required 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="transactionId" className="text-[11px] font-bold text-slate-400 ml-1">Transaction ID / UTR</Label>
                                    <Input 
                                        id="transactionId" 
                                        name="transactionId" 
                                        type="text" 
                                        placeholder="From your payment app"
                                        value={transactionId}
                                        onChange={(e) => setTransactionId(e.target.value)}
                                        className="bg-slate-50 border-none h-12 rounded-xl px-4 font-bold text-slate-900 focus:ring-2 focus:ring-[#5D2D91]/10"
                                        required 
                                    />
                                </div>
                            </CardContent>
                            <CardFooter className="pb-8 px-8">
                                <Button type="submit" disabled={isPending || isLoadingDetails || !paymentDetails?.upi_id} className="w-full h-14 rounded-[1.25rem] bg-[#5D2D91] text-white hover:bg-[#4A1E7A] font-black text-sm shadow-xl transition-all active:scale-95">
                                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Confirm payment
                                </Button>
                            </CardFooter>
                        </form>
                    </Card>
                </div>
            </main>
        </div>
    );
}

export default function AddFundsPage() {
    return (
        <AppLayout>
            <AddFundsPageContent />
        </AppLayout>
    );
}
