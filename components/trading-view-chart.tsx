'use client';

import React, { useEffect, useRef } from 'react';

/**
 * @fileOverview Official TradingView Advanced Charting Widget.
 * Includes a highly specialized symbol mapper for Indian Derivatives (NFO/BFO).
 */

interface TradingViewChartProps {
  symbol: string;
  exchange: string;
}

export default function TradingViewChart({ symbol, exchange }: TradingViewChartProps) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;

    // Clear previous content
    container.current.innerHTML = '';

    let normalizedExchange = exchange.toUpperCase();
    let normalizedSymbol = symbol.toUpperCase();
    let useDirectSymbol = false;

    // 1. INSTITUTIONAL FUTURES MAPPING
    // Map Zerodha Index Futures to TradingView Continuous Futures (1!)
    if (normalizedSymbol.endsWith('FUT')) {
        if (normalizedSymbol.startsWith('BANKNIFTY')) {
            normalizedSymbol = 'BANKNIFTY1!';
            normalizedExchange = 'NFO';
        } else if (normalizedSymbol.startsWith('NIFTY')) {
            normalizedSymbol = 'NIFTY1!';
            normalizedExchange = 'NFO';
        } else if (normalizedSymbol.startsWith('SENSEX')) {
            normalizedSymbol = 'BSX1!';
            useDirectSymbol = true; 
        }
    }

    // 2. SENSEX / NIFTY OPTION SPECIAL MAPPING
    // This translates Zerodha symbols into TradingView character-mapped symbols
    // Example: NIFTY24O2724000CE -> NFO:NIFTY24O2724000CE
    const optRegex = /^([A-Z&]+)(\d{2})([1-9OND])(\d{1,2})(\d+)(CE|PE)$/i;
    const match = normalizedSymbol.match(optRegex);
    
    if (match) {
        const [, name, year, monthChar, day, strike, type] = match;
        // Map standard exchanges to Derivative exchanges for TV compliance
        if (normalizedExchange === 'NSE') normalizedExchange = 'NFO';
        if (normalizedExchange === 'BSE') normalizedExchange = 'BFO';
        
        // Handle Nifty vs BankNifty vs Sensex base names
        if (name === 'SENSEX') {
            normalizedSymbol = `BSX${year}${monthChar}${day.padStart(2, '0')}${type === 'CE' ? 'C' : 'P'}${strike}`;
            useDirectSymbol = true;
        }
    }

    // 3. GENERAL DERIVATIVE ROUTING
    const isDerivative = normalizedSymbol.match(/\d+(CE|PE)$/i) || 
                       normalizedSymbol.match(/FUT$/i) || 
                       normalizedExchange === 'NFO' || 
                       normalizedExchange === 'BFO';

    if (isDerivative && !normalizedSymbol.includes('1!') && !useDirectSymbol) {
        if (normalizedExchange === 'NSE') normalizedExchange = 'NFO';
        if (normalizedExchange === 'BSE') normalizedExchange = 'BFO';
    }

    // 4. SPOT INDEX MAPPING
    if (normalizedSymbol === 'NIFTY 50') {
        normalizedSymbol = 'NIFTY';
        normalizedExchange = 'NSE';
    } else if (normalizedSymbol === 'SENSEX' && !normalizedSymbol.includes('1!')) {
        normalizedSymbol = 'SENSEX';
        normalizedExchange = 'BSE';
    }

    const tvSymbol = useDirectSymbol ? normalizedSymbol : `${normalizedExchange}:${normalizedSymbol}`;

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      "autosize": true,
      "symbol": tvSymbol,
      "interval": "5",
      "timezone": "Asia/Kolkata",
      "theme": "dark",
      "style": "1",
      "locale": "en",
      "enable_publishing": false,
      "hide_side_toolbar": false, // ENABLE SIDEBAR
      "allow_symbol_change": true,
      "save_image": false,
      "details": true, // SHOW SYMBOL DETAILS
      "hotlist": true, // SHOW HOTLIST
      "calendar": false,
      "show_popup_button": true,
      "popup_width": "1000",
      "popup_height": "650",
      "support_host": "https://www.tradingview.com",
      "container_id": "tradingview_widget_container"
    });

    container.current.appendChild(script);

    return () => {
      if (container.current) {
        container.current.innerHTML = '';
      }
    };
  }, [symbol, exchange]);

  return (
    <div className="tradingview-widget-container h-full w-full bg-[#050508]">
      <div id="tradingview_widget_container" ref={container} className="h-full w-full" />
    </div>
  );
}
