
'use client';

import { useState, useEffect, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Trash2, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { getPaymentDetails } from '@/app/actions/get-payment-details';
import { updatePaymentDetails } from '@/app/actions/update-payment-details';
import { addNewsEvent, deleteNewsEvent, getNewsEvents } from '@/app/actions/manage-news-events';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from 'date-fns';
import { cn } from '@/lib/utils';


type PaymentDetails = {
    upi_id: string | null;
    qr_code_url: string | null;
};

export default function AdminSettingsPage() {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Payment State
    const [upiId, setUpiId] = useState('');
    const [qrCodeFile, setQrCodeFile] = useState<File | null>(null);
    const [qrPreview, setQrPreview] = useState<string | null>(null);

    // News Events State
    const [newsEvents, setNewsEvents] = useState<any[]>([]);
    const [newEventName, setNewEventName] = useState('');
    
    // New Date/Time Picker State
    const [newsDate, setNewsDate] = useState<Date | undefined>(new Date());
    const [newsHours, setNewsHours] = useState("12");
    const [newsMinutes, setNewsMinutes] = useState("00");

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const [payRes, newsRes] = await Promise.all([
                getPaymentDetails(),
                getNewsEvents()
            ]);

            if (payRes.success && payRes.data) {
                setUpiId(payRes.data.upi_id || '');
                setQrPreview(payRes.data.qr_code_url);
            }
            if (newsRes.success) {
                setNewsEvents(newsRes.data || []);
            }
            setIsLoading(false);
        };
        fetchData();
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setQrCodeFile(file);
            setQrPreview(URL.createObjectURL(file));
        }
    };

    const handlePaymentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        startTransition(async () => {
            const formData = new FormData();
            formData.append('upiId', upiId);
            if (qrCodeFile) formData.append('qrCodeFile', qrCodeFile);
            const result = await updatePaymentDetails(formData);
            if (result.success) {
                toast({ title: 'Success', description: 'Payment details updated.' });
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.message });
            }
        });
    };

    const handleAddNews = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEventName || !newsDate) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please provide an event name and date.' });
            return;
        }

        startTransition(async () => {
            // Construct the final scheduled date
            const scheduledAt = new Date(newsDate);
            scheduledAt.setHours(parseInt(newsHours), parseInt(newsMinutes), 0, 0);

            const result = await addNewsEvent(newEventName, scheduledAt.toISOString());
            if (result.success) {
                toast({ title: 'Success', description: 'News event scheduled.' });
                setNewEventName('');
                const newsRes = await getNewsEvents();
                if (newsRes.success) setNewsEvents(newsRes.data || []);
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.message });
            }
        });
    };

    const handleDeleteNews = async (id: number) => {
        startTransition(async () => {
            const result = await deleteNewsEvent(id);
            if (result.success) {
                setNewsEvents(prev => prev.filter(e => e.id !== id));
                toast({ title: 'Success', description: 'Event deleted.' });
            }
        });
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-10">
            <header>
                <h1 className="text-3xl font-bold tracking-tight font-headline">Platform Settings</h1>
                <p className="text-muted-foreground">Manage payment information and news restricted windows.</p>
            </header>
            
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <Card>
                    <form onSubmit={handlePaymentSubmit}>
                        <CardHeader>
                            <CardTitle>Deposit Information</CardTitle>
                            <CardDescription>Configure the UPI ID and QR code shown to users for deposits.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="upiId">UPI ID</Label>
                                <Input id="upiId" value={upiId} onChange={e => setUpiId(e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="qrCode">QR Code Image</Label>
                                <div className="flex items-center gap-4">
                                    {qrPreview && (
                                        <div className="w-20 h-20 relative border rounded bg-white">
                                            <Image src={qrPreview} alt="QR" layout="fill" objectFit="contain" />
                                        </div>
                                    )}
                                    <Input type="file" onChange={handleFileChange} accept="image/*" className="max-w-xs" />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" disabled={isPending || isLoading}>
                                {isPending ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                                Save Payment Settings
                            </Button>
                        </CardFooter>
                    </form>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>News restricted windows (Tier 6)</CardTitle>
                        <CardDescription>Schedule events to enforce a ±5 minute trade restriction window.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <form onSubmit={handleAddNews} className="flex flex-col gap-6 bg-muted/30 p-6 rounded-2xl border border-white/5">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Event Name</Label>
                                <Input 
                                    placeholder="e.g. US CPI" 
                                    value={newEventName} 
                                    onChange={e => setNewEventName(e.target.value)} 
                                    required 
                                    className="bg-white/[0.02] border-white/10 h-12 rounded-xl text-sm font-bold"
                                />
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Release Date</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-full h-12 justify-start text-left font-bold rounded-xl bg-white/[0.02] border-white/10",
                                                    !newsDate && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                                                {newsDate ? format(newsDate, "PPP") : <span>Pick a date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0 bg-[#050508] border-white/10 rounded-2xl">
                                            <Calendar
                                                mode="single"
                                                selected={newsDate}
                                                onSelect={setNewsDate}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Release Time (24h)</Label>
                                    <div className="flex items-center gap-2">
                                        <Select value={newsHours} onValueChange={setNewsHours}>
                                            <SelectTrigger className="h-12 bg-white/[0.02] border-white/10 rounded-xl font-bold">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-[#050508] border-white/10">
                                                {Array.from({ length: 24 }).map((_, i) => {
                                                    const val = i.toString().padStart(2, '0');
                                                    return <SelectItem key={val} value={val}>{val}</SelectItem>
                                                })}
                                            </SelectContent>
                                        </Select>
                                        <span className="font-bold text-muted-foreground">:</span>
                                        <Select value={newsMinutes} onValueChange={setNewsMinutes}>
                                            <SelectTrigger className="h-12 bg-white/[0.02] border-white/10 rounded-xl font-bold">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-[#050508] border-white/10">
                                                {Array.from({ length: 60 }).map((_, i) => {
                                                    const val = i.toString().padStart(2, '0');
                                                    return <SelectItem key={val} value={val}>{val}</SelectItem>
                                                })}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            <Button type="submit" className="h-12 rounded-xl bg-primary text-white font-black text-[10px] uppercase tracking-widest purple-glow" disabled={isPending}>
                                {isPending ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <CalendarIcon className="h-4 w-4 mr-2" />}
                                Schedule Restricted Window
                            </Button>
                        </form>

                        <div className="rounded-2xl border border-white/5 overflow-hidden">
                            <Table>
                                <TableHeader className="bg-white/[0.02]">
                                    <TableRow className="border-white/5">
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest opacity-40">Event</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest opacity-40">Scheduled Time</TableHead>
                                        <TableHead className="text-right text-[10px] font-black uppercase tracking-widest opacity-40">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {newsEvents.length === 0 ? (
                                        <TableRow><TableCell colSpan={3} className="text-center py-10 text-[10px] font-black uppercase tracking-widest opacity-20">No events scheduled</TableCell></TableRow>
                                    ) : (
                                        newsEvents.map(event => (
                                            <TableRow key={event.id} className="border-white/5 hover:bg-white/[0.01]">
                                                <TableCell className="font-bold text-white">{event.event_name}</TableCell>
                                                <TableCell className="text-[10px] font-bold text-muted-foreground uppercase">{format(new Date(event.scheduled_at), 'PPP p')}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteNews(event.id)} className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-xl">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
