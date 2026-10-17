
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';

interface PriceData {
    symbol: string;
    price: number;
    change: number;
    dayLow: number;
    dayHigh: number;
}

interface PriceUpdateMap {
    [key: string]: PriceData;
}

interface Instrument {
    symbol: string;
    exchange: string;
}

interface WebSocketContextType {
    prices: PriceUpdateMap;
    readyState: ReadyState;
    subscribe: (instruments: Instrument[]) => void;
    unsubscribe: (instruments: Instrument[]) => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const useWebSocketData = () => {
    const context = useContext(WebSocketContext);
    if (!context) {
        throw new Error('useWebSocketData must be used within a WebSocketProvider');
    }
    return context;
};

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [prices, setPrices] = useState<PriceUpdateMap>({});
    const activeSubsRef = useRef<Instrument[]>([]);
    const lastMessageTime = useRef<number>(Date.now());
    const [reconnectKey, setReconnectKey] = useState(0);

    const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080';

    const { sendMessage, lastMessage, readyState } = useWebSocket(`${WS_URL}?v=${reconnectKey}`, {
        shouldReconnect: () => true,
        reconnectAttempts: 100,
        reconnectInterval: 3000,
        onOpen: () => {
             console.log('⚡️ Railway Feed Online');
             // ALWAYS use ref for resubscribe to avoid stale closure trap
             if (activeSubsRef.current.length > 0) {
                 sendMessage(JSON.stringify({ type: 'subscribe', instruments: activeSubsRef.current }));
             }
        },
    });

    // WATCHDOG: Force reconnect if no data/heartbeat arrives for 15s
    useEffect(() => {
        const checkStale = setInterval(() => {
            const timeSinceLast = Date.now() - lastMessageTime.current;
            // Only force if we have active subs and no data for a long time
            if (timeSinceLast > 15000 && activeSubsRef.current.length > 0 && readyState === ReadyState.OPEN) {
                console.warn('⚠️ Connection stalled. Forcing restart...');
                setReconnectKey(prev => prev + 1);
                lastMessageTime.current = Date.now();
            }
        }, 5000);
        return () => clearInterval(checkStale);
    }, [readyState]);

    // Handle Delta updates and Heartbeats
    useEffect(() => {
        if (lastMessage?.data) {
            lastMessageTime.current = Date.now();
            try {
                const data = JSON.parse(lastMessage.data as string);
                // Handle Heartbeat (hb)
                if (data.type === 'hb') return;
                
                // Handle Price Delta
                setPrices(prev => ({ ...prev, ...data }));
            } catch (e) {
                console.error("Delta Parse Error", e);
            }
        }
    }, [lastMessage]);

    const subscribe = useCallback((instruments: Instrument[]) => {
        if (!instruments || instruments.length === 0) return;
        
        // Filter out what we already have to prevent spamming the socket
        const newOnes = instruments.filter(inst => 
            !activeSubsRef.current.some(p => p.symbol === inst.symbol && p.exchange === inst.exchange)
        );

        if (newOnes.length > 0) {
            activeSubsRef.current = [...activeSubsRef.current, ...newOnes];
            if (readyState === ReadyState.OPEN) {
                sendMessage(JSON.stringify({ type: 'subscribe', instruments: newOnes }));
            }
        }
    }, [readyState, sendMessage]);
    
    const unsubscribe = useCallback((instruments: Instrument[]) => {
        activeSubsRef.current = activeSubsRef.current.filter(p => 
            !instruments.some(i => i.symbol === p.symbol && i.exchange === p.exchange)
        );
    }, []);

    const value = useMemo(() => ({
        prices,
        readyState,
        subscribe,
        unsubscribe,
    }), [prices, readyState, subscribe, unsubscribe]);

    return (
        <WebSocketContext.Provider value={value}>
            {children}
        </WebSocketContext.Provider>
    );
};
