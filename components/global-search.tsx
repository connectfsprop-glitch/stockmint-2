'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search as SearchIcon, Loader2, Sparkles, Zap } from 'lucide-react';
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getInstrumentsForSearch } from '@/app/actions/search-instruments';
import { formatSimpleInstrumentName } from '@/lib/format-instrument';
import { InstrumentActionSheet } from './instrument-action-sheet';
import { useUserProfile } from '@/hooks/use-user-profile';
import { cn } from '@/lib/utils';

/**
 * @fileOverview INSTITUTIONAL GLOBAL SEARCH v2.3
 * Context-Aware: Filters assets based on the trader's market_type.
 */

export function GlobalSearch() {
    const { profile } = useUserProfile();
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // Instrument Sheet States
    const [selectedInstrument, setSelectedInstrument] = useState<any>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    const handleSearch = useCallback(async (val: string) => {
        setQuery(val);
        if (!val.trim()) {
            setResults([]);
            return;
        }

        setIsLoading(true);
        try {
            const res = await getInstrumentsForSearch(val, profile?.market_type || 'indian');
            if (res.success) {
                setResults(res.data);
            }
        } catch (e) {
            console.error("Search error", e);
        } finally {
            setIsLoading(false);
        }
    }, [profile?.market_type]);

    const handleSelect = (inst: any) => {
        setSelectedInstrument(inst);
        setIsSheetOpen(true);
    };

    return (
        <>
            <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsOpen(true)}
                className="h-10 w-10 flex items-center justify-center text-white/80 hover:text-white transition-transform active:scale-90"
            >
                <SearchIcon className="h-6 w-6" />
            </Button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="bg-white/95 backdrop-blur-3xl border-slate-200 rounded-[2.5rem] p-0 overflow-hidden max-w-xl top-[20%] translate-y-0 shadow-2xl">
                    <DialogHeader className="p-6 pb-4 border-b border-slate-50 bg-slate-50/50">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                <SearchIcon className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold text-slate-900 tracking-tight font-headline">Search Terminal</DialogTitle>
                                <DialogDescription className="text-[10px] font-bold text-slate-400">
                                    {profile?.market_type === 'forex' ? 'Global asset scanner' : 'Indian asset scanner'}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="p-6 space-y-6">
                        <div className="relative group">
                            <div className="absolute inset-0 bg-primary/5 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
                            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                            <Input 
                                placeholder={profile?.market_type === 'forex' ? "Search Forex, Crypto, Global Indices..." : "Search Nifty, Stocks, Options..."}
                                value={query}
                                onChange={(e) => handleSearch(e.target.value)}
                                className="h-14 bg-slate-50 border-slate-200 pl-11 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-300 focus:border-primary/50 focus:ring-0 transition-all relative z-10"
                                autoFocus
                            />
                            {isLoading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary z-10" />}
                        </div>

                        <div className="space-y-2 max-h-[350px] overflow-y-auto no-scrollbar pb-4 px-1">
                            {results.length === 0 ? (
                                <div className="py-20 text-center opacity-20">
                                    <Sparkles className="h-10 w-10 mx-auto mb-4 text-slate-400" />
                                    <p className="text-xs font-bold text-slate-500">Type to begin scanning</p>
                                </div>
                            ) : (
                                results.map((inst, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleSelect(inst)}
                                        className="w-full flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-100 hover:bg-slate-50 hover:border-primary/30 transition-all group"
                                    >
                                        <div className="text-left">
                                            <p className="font-bold text-slate-800 text-sm group-hover:text-primary transition-colors">
                                                {formatSimpleInstrumentName({ tradingsymbol: inst.tradingsymbol })}
                                            </p>
                                            <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                                                {inst.exchange} • {inst.instrument_type}
                                            </p>
                                        </div>
                                        <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Zap className="h-3.5 w-3.5 text-primary" />
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <InstrumentActionSheet 
                instrument={selectedInstrument} 
                isOpen={isSheetOpen} 
                onOpenChange={setIsSheetOpen} 
            />
        </>
    );
}
