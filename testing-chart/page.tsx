'use client';

import React, { useState } from 'react';
import { AppLayout } from '@/components/app-layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, LineChart, Loader2, Sparkles, Monitor, Globe, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { getInstrumentsForSearch } from '@/app/actions/search-instruments';
import TradingViewChart from '@/components/trading-view-chart';
import { formatSimpleInstrumentName } from '@/lib/format-instrument';
import { cn } from '@/lib/utils';

/**
 * @fileOverview OFFICIAL CHART TEST LAB
 * Simple environment to test the official TradingView charting logic.
 */

export default function TestingChartPage() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedInstrument, setSelectedInstrument] = useState<any>(null);

    const handleSearch = async () => {
        if (!query.trim()) return;
        setIsLoading(true);
        try {
            const res = await getInstrumentsForSearch(query);
            if (res.success) {
                setResults(res.data);
            }
        } catch (error) {
            console.error("Search failed:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AppLayout>
            <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-1000 slide-in-from-bottom-4">
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/5">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <h1 className="font-headline text-3xl md:text-5xl font-black tracking-tight text-white">Chart Lab.</h1>
                            <div className="px-2 py-0.5 rounded bg-primary/20 border border-primary/30">
                                <span className="text-[8px] font-black text-primary uppercase tracking-widest">Official Integration Mode</span>
                            </div>
                        </div>
                        <p className="text-muted-foreground text-[10px] md:text-sm font-medium tracking-wide uppercase opacity-60">Verified Official TradingView Suite</p>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    <div className="lg:col-span-1 space-y-6">
                        <Card className="glass-card border-none rounded-[2rem] p-6 relative overflow-hidden">
                            <div className="relative z-10 space-y-6">
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-40 mb-2">Scanner</p>
                                    <CardTitle className="text-lg font-black text-white tracking-tighter uppercase">Search Engine</CardTitle>
                                </div>
                                
                                <div className="space-y-3">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input 
                                            placeholder="NIFTY 21000 PE..."
                                            value={query}
                                            onChange={(e) => setQuery(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                            className="pl-9 bg-white/[0.03] border-white/10 h-11 rounded-xl text-xs font-bold focus:border-primary/50 transition-all"
                                        />
                                    </div>
                                    <Button 
                                        onClick={handleSearch} 
                                        disabled={isLoading} 
                                        className="w-full h-11 rounded-xl font-black text-[10px] uppercase tracking-widest purple-glow"
                                    >
                                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Run Index Search'}
                                    </Button>
                                </div>

                                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 no-scrollbar border-t border-white/5 pt-4">
                                    {results.map((inst, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setSelectedInstrument(inst)}
                                            className="w-full text-left p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-primary/30 transition-all duration-500 group relative overflow-hidden"
                                        >
                                            <div className="relative z-10">
                                                <p className="text-xs font-black text-white group-hover:text-primary transition-colors">
                                                    {formatSimpleInstrumentName({ tradingsymbol: inst.tradingsymbol })}
                                                </p>
                                                <div className="flex items-center justify-between mt-1">
                                                    <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest opacity-40">
                                                        {inst.exchange} • {inst.instrument_type}
                                                    </span>
                                                    <Sparkles className="h-3 w-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                            </div>
                                            <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </Card>
                    </div>

                    <div className="lg:col-span-3">
                        <div className="glass-card border-none rounded-[3rem] overflow-hidden flex flex-col shadow-2xl h-[650px] relative">
                            {selectedInstrument ? (
                                <TradingViewChart 
                                    symbol={selectedInstrument.tradingsymbol} 
                                    exchange={selectedInstrument.exchange} 
                                />
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center">
                                    <Monitor className="h-24 w-24 text-muted-foreground opacity-10 mb-8" />
                                    <p className="text-2xl font-black text-white tracking-tight uppercase opacity-40">Initialize Terminal</p>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em] mt-3 opacity-20">Select an asset from the scanner</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
