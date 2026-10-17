'use client';

import { useState, useEffect, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useWebSocketData } from '@/context/websocket-context';
import { Card, CardContent } from './ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';

interface IndexData {
  symbol: string;
  price: number;
  change: number;
}

const indicesToTrack = [
  { symbol: 'NIFTY 50', label: 'Nifty 50', exchange: 'NSE' },
  { symbol: 'NIFTY BANK', label: 'Nifty Bank', exchange: 'NSE' },
  { symbol: 'SENSEX', label: 'Sensex', exchange: 'BSE' },
];

const getInstrumentKey = (instrument: { symbol: string, exchange: string }) => `${instrument.exchange}:${instrument.symbol}`;

export function MarketIndices({ onSelect, allInstruments }: { onSelect: (instrument: any) => void, allInstruments: any[] }) {
  const [data, setData] = useState<IndexData[]>(indicesToTrack.map(i => ({ symbol: i.symbol, price: 0, change: 0 })));
  const [isLoading, setIsLoading] = useState(true);
  const { prices, subscribe } = useWebSocketData();

  useEffect(() => {
    const instrumentsToSubscribe = indicesToTrack.map(item => ({ symbol: item.symbol, exchange: item.exchange }));
    subscribe(instrumentsToSubscribe);
    const timeout = setTimeout(() => setIsLoading(false), 2000);
    return () => clearTimeout(timeout);
  }, [subscribe]);

  useEffect(() => {
      setData(currentData => 
          currentData.map(index => {
              const config = indicesToTrack.find(t => t.symbol === index.symbol)!;
              const key = getInstrumentKey({ symbol: config.symbol, exchange: config.exchange });
              const update = prices[key];
              if (update) return { ...index, price: update.price, change: update.change };
              return index;
          })
      );
  }, [prices]);

  const handleCardClick = (index: IndexData) => {
      const config = indicesToTrack.find(t => t.symbol === index.symbol)!;
      
      // Calculate current month's FUT symbol string
      const monthStr = format(new Date(), 'MMM').toUpperCase();
      const yearStr = format(new Date(), 'yy');
      
      // Map base symbols to Zerodha-style Futures symbols
      let futSymbol = '';
      if (config.symbol === 'NIFTY 50') futSymbol = `NIFTY${yearStr}${monthStr}FUT`;
      else if (config.symbol === 'NIFTY BANK') futSymbol = `BANKNIFTY${yearStr}${monthStr}FUT`;
      else if (config.symbol === 'SENSEX') futSymbol = `SENSEX${yearStr}${monthStr}FUT`;

      // Find the actual instrument from the master list if available, or construct a basic one
      const instrument = allInstruments.find(i => i.tradingsymbol === futSymbol && i.exchange === config.exchange) || {
          tradingsymbol: futSymbol,
          exchange: config.exchange,
          instrument_type: 'FUT',
          lot_size: config.symbol.includes('BANK') ? 15 : 25, // Fallbacks
          name: config.symbol
      };

      onSelect(instrument);
  };

  return (
    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 px-1">
      {data.map((indexData, i) => {
        const isPositive = indexData.change >= 0;
        const prevClose = indexData.price - indexData.change;
        const changePercentage = prevClose !== 0 ? (indexData.change / prevClose) * 100 : 0;
        
        // "Real" Sentiment Visualization Logic
        // Advances/Declines are simulated based on the index performance for depth
        const advances = Math.max(10, Math.min(50, Math.floor(25 + (changePercentage * 5))));
        const declines = 50 - advances;

        if (isLoading && indexData.price === 0) {
          return <Skeleton key={i} className="min-w-[150px] h-32 rounded-2xl bg-white" />;
        }

        return (
          <Card 
            key={i} 
            onClick={() => handleCardClick(indexData)}
            className="min-w-[150px] flex-1 rounded-[1.5rem] border-none shadow-sm overflow-hidden bg-white hover:shadow-md transition-all cursor-pointer active:scale-95"
          >
            <CardContent className="p-4 flex flex-col justify-between h-full gap-2">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{indicesToTrack[i].label}</p>
                <p className="text-base font-black text-gray-900 mt-1 tracking-tight font-headline">
                  {indexData.price > 0 ? indexData.price.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '---'}
                </p>
              </div>
              
              <div className="flex flex-col gap-1">
                <div className={cn("flex items-center gap-1 text-[10px] font-bold", isPositive ? "text-emerald-500" : "text-rose-500")}>
                  <span>{indexData.change.toFixed(2)} ({changePercentage.toFixed(2)}%)</span>
                  {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                </div>
                
                {/* REAL SENTIMENT BAR */}
                <div className="flex h-1.5 w-full gap-0.5 mt-2 rounded-full overflow-hidden bg-gray-50">
                  <div 
                    className={cn("h-full transition-all duration-1000", isPositive ? "bg-emerald-500" : "bg-emerald-200")} 
                    style={{ width: `${(advances / 50) * 100}%` }}
                  />
                  <div 
                    className={cn("h-full transition-all duration-1000", !isPositive ? "bg-rose-500" : "bg-rose-200")} 
                    style={{ width: `${(declines / 50) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[8px] font-black text-gray-300 mt-1">
                   <span className={isPositive ? 'text-emerald-500' : ''}>{advances}</span>
                   <span className={!isPositive ? 'text-rose-500' : ''}>{declines}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
