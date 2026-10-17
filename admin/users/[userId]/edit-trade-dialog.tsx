'use client';

import { useState, useTransition, useEffect } from 'react';
import { Dialog as UIDialog, DialogContent as UIDialogContent, DialogHeader as UIDialogHeader, DialogTitle as UIDialogTitle, DialogDescription as UIDialogDescription, DialogFooter as UIDialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Calendar, Hash, Clock, ShieldCheck, TrendingUp, TrendingDown, Layers } from 'lucide-react';
import { updateTradeDetails } from '@/app/actions/update-trade-details';
import { getInstruments } from '@/app/actions/search-instruments';
import { supabase } from '@/lib/supabase';

interface EditTradeDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    trade: any;
    onSaved: () => void;
}

export function EditTradeDialog({ isOpen, onOpenChange, trade, onSaved }: EditTradeDialogProps) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [lots, setLots] = useState('');
    const [lotSize, setLotSize] = useState(1);
    const [entryPrice, setEntryPrice] = useState('');
    const [exitPrice, setExitPrice] = useState('');
    
    // Time states
    const [openDate, setOpenDate] = useState('');
    const [openHH, setOpenHH] = useState('00');
    const [openMM, setOpenMM] = useState('00');
    const [openSS, setOpenSS] = useState('00');

    const [closeDate, setCloseDate] = useState('');
    const [closeHH, setCloseHH] = useState('00');
    const [closeMM, setCloseMM] = useState('00');
    const [closeSS, setCloseSS] = useState('00');

    const [isLoadingData, setIsLoadingData] = useState(false);

    useEffect(() => {
        if (trade && isOpen) {
            setIsLoadingData(true);
            
            const parseLocal = (dateStr: string) => {
                const date = new Date(dateStr);
                const y = date.getFullYear();
                const m = (date.getMonth() + 1).toString().padStart(2, '0');
                const d = date.getDate().toString().padStart(2, '0');
                return {
                    date: `${y}-${m}-${d}`,
                    hh: date.getHours().toString().padStart(2, '0'),
                    mm: date.getMinutes().toString().padStart(2, '0'),
                    ss: date.getSeconds().toString().padStart(2, '0')
                };
            };

            const init = async () => {
                // 1. Fetch Lot Size
                const instRes = await getInstruments();
                if (instRes.success) {
                    const inst = instRes.data.find(i => i.tradingsymbol === trade.symbol);
                    const size = inst?.lot_size || 1;
                    setLotSize(size);
                    setLots((trade.quantity / size).toString());
                }

                // 2. Setup Prices
                setExitPrice(trade.price.toString());
                const calculatedEntry = trade.order_type === 'SELL' 
                    ? trade.price - (trade.pnl / trade.quantity)
                    : trade.price + (trade.pnl / trade.quantity);
                setEntryPrice(calculatedEntry.toFixed(2));

                // 3. Setup Exit Time
                const closeParts = parseLocal(trade.created_at);
                setCloseDate(closeParts.date);
                setCloseHH(closeParts.hh);
                setCloseMM(closeParts.mm);
                setCloseSS(closeParts.ss);

                // 4. Fetch Actual Opening Leg (Fixes the "Not Saving" Heuristic bug)
                const { data: openingLeg } = await supabase
                    .from('orders')
                    .select('created_at')
                    .eq('user_id', trade.user_id)
                    .eq('symbol', trade.symbol)
                    .eq('status', 'COMPLETED')
                    .is('pnl', null)
                    .lt('created_at', trade.created_at)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                const entryTime = openingLeg?.created_at || new Date(new Date(trade.created_at).getTime() - 5 * 60 * 1000).toISOString();
                const entryParts = parseLocal(entryTime);
                setOpenDate(entryParts.date);
                setOpenHH(entryParts.hh);
                setOpenMM(entryParts.mm);
                setOpenSS(entryParts.ss);

                setIsLoadingData(false);
            };

            init();
        }
    }, [trade, isOpen]);

    const handleBlur = (val: string, setter: (v: string) => void) => {
        if (!val) return;
        const padded = val.toString().padStart(2, '0');
        setter(padded);
    };

    const combine = (date: string, hh: string, mm: string, ss: string) => {
        if (!date) return new Date().toISOString();
        const h = (hh || '00').toString().padStart(2, '0');
        const m = (mm || '00').toString().padStart(2, '0');
        const s = (ss || '00').toString().padStart(2, '0');
        const d = new Date(`${date}T${h}:${m}:${s}`);
        return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!trade) return;

        const totalQuantity = Math.floor(Number(lots) * lotSize);

        startTransition(async () => {
            const res = await updateTradeDetails({
                orderId: trade.id,
                openingTime: combine(openDate, openHH, openMM, openSS),
                closingTime: combine(closeDate, closeHH, closeMM, closeSS),
                newQuantity: totalQuantity,
                newEntryPrice: Number(entryPrice),
                newExitPrice: Number(exitPrice)
            });

            if (res.success) {
                toast({ title: 'Execution Synchronized', description: res.message });
                onSaved();
                onOpenChange(false);
            } else {
                toast({ variant: 'destructive', title: 'Sync Failed', description: res.message });
            }
        });
    };

    return (
        <UIDialog open={isOpen} onOpenChange={onOpenChange}>
            <UIDialogContent className="bg-white border-none rounded-[2.5rem] p-8 max-w-md shadow-2xl overflow-y-auto max-h-[95vh] focus:outline-none">
                <UIDialogHeader className="space-y-3">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                        <ShieldCheck className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <UIDialogTitle className="text-xl font-black text-slate-900 tracking-tight font-headline uppercase">Edit Execution</UIDialogTitle>
                        <UIDialogDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Official Audit: {trade?.symbol}
                        </UIDialogDescription>
                    </div>
                </UIDialogHeader>

                {isLoadingData ? (
                    <div className="py-20 flex flex-col items-center gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-300">Syncing database values...</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="py-6 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">Entry Price (Buy)</Label>
                                <div className="relative">
                                    <TrendingUp className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                                    <Input 
                                        type="number" 
                                        step="0.01"
                                        value={entryPrice} 
                                        onChange={e => setEntryPrice(e.target.value)} 
                                        className="h-12 pl-11 bg-slate-50 border-none rounded-xl font-bold text-slate-900" 
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">Exit Price (Sell)</Label>
                                <div className="relative">
                                    <TrendingDown className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-rose-500" />
                                    <Input 
                                        type="number" 
                                        step="0.01"
                                        value={exitPrice} 
                                        onChange={e => setExitPrice(e.target.value)} 
                                        className="h-12 pl-11 bg-slate-50 border-none rounded-xl font-bold text-slate-900" 
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center mb-1 pr-1">
                                <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">Execution Lots</Label>
                                <span className="text-[9px] font-black text-primary bg-primary/5 px-2 py-0.5 rounded uppercase">Total: {Math.floor(Number(lots) * lotSize)} Units</span>
                            </div>
                            <div className="relative">
                                <Layers className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                                <Input 
                                    type="number" 
                                    step="1"
                                    value={lots} 
                                    onChange={e => setLots(e.target.value)} 
                                    className="h-12 pl-11 bg-slate-50 border-none rounded-xl font-bold text-slate-900" 
                                />
                            </div>
                        </div>

                        <div className="space-y-6 pt-4 border-t border-slate-50">
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">Entry Timestamp (IST)</Label>
                                <div className="grid grid-cols-4 gap-2">
                                    <Input type="date" value={openDate} onChange={e => setOpenDate(e.target.value)} className="col-span-1 h-11 bg-slate-50 border-none rounded-xl text-[10px] font-bold p-1" />
                                    <Input type="number" placeholder="HH" value={openHH} onBlur={() => handleBlur(openHH, setOpenHH)} onChange={e => setOpenHH(e.target.value)} className="h-11 bg-slate-50 border-none rounded-xl text-center font-bold" min="0" max="23" />
                                    <Input type="number" placeholder="MM" value={openMM} onBlur={() => handleBlur(openMM, setOpenMM)} onChange={e => setOpenMM(e.target.value)} className="h-11 bg-slate-50 border-none rounded-xl text-center font-bold" min="0" max="59" />
                                    <Input type="number" placeholder="SS" value={openSS} onBlur={() => handleBlur(openSS, setOpenSS)} onChange={e => setOpenSS(e.target.value)} className="h-11 bg-slate-50 border-none rounded-xl text-center font-bold" min="0" max="59" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">Exit Timestamp (IST)</Label>
                                <div className="grid grid-cols-4 gap-2">
                                    <Input type="date" value={closeDate} onChange={e => setCloseDate(e.target.value)} className="col-span-1 h-11 bg-slate-50 border-none rounded-xl text-[10px] font-bold p-1" />
                                    <Input type="number" placeholder="HH" value={closeHH} onBlur={() => handleBlur(closeHH, setCloseHH)} onChange={e => setCloseHH(e.target.value)} className="h-11 bg-slate-50 border-none rounded-xl text-center font-bold" min="0" max="23" />
                                    <Input type="number" placeholder="MM" value={closeMM} onBlur={() => handleBlur(closeMM, setCloseMM)} onChange={e => setCloseMM(e.target.value)} className="h-11 bg-slate-50 border-none rounded-xl text-center font-bold" min="0" max="59" />
                                    <Input type="number" placeholder="SS" value={closeSS} onBlur={() => handleBlur(closeSS, setCloseSS)} onChange={e => setCloseSS(e.target.value)} className="h-11 bg-slate-50 border-none rounded-xl text-center font-bold" min="0" max="59" />
                                </div>
                            </div>
                        </div>

                        <UIDialogFooter className="flex-col gap-3">
                            <Button type="submit" disabled={isPending} className="w-full h-14 rounded-2xl bg-primary text-white font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all purple-glow">
                                {isPending ? <Loader2 className="animate-spin h-5 w-5" /> : 'Authorize Adjustments'}
                            </Button>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="w-full text-[10px] font-bold text-slate-400 uppercase">Abort</Button>
                        </UIDialogFooter>
                    </form>
                )}
            </UIDialogContent>
        </UIDialog>
    );
}