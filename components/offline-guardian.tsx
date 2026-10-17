'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, ShieldAlert, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

/**
 * @fileOverview Offline Guardian
 * Friendly interface for handling internet connectivity issues.
 */

export function OfflineGuardian({ children }: { children: React.ReactNode }) {
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsOnline(window.navigator.onLine);

            const handleOnline = () => setIsOnline(true);
            const handleOffline = () => setIsOnline(false);

            window.addEventListener('online', handleOnline);
            window.addEventListener('offline', handleOffline);

            return () => {
                window.removeEventListener('online', handleOnline);
                window.removeEventListener('offline', handleOffline);
            };
        }
    }, []);

    const handleRetry = () => {
        if (typeof window !== 'undefined' && window.navigator.onLine) {
            setIsOnline(true);
        }
    };

    return (
        <>
            <AnimatePresence>
                {!isOnline && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] bg-[#050508] flex flex-col items-center justify-center p-8 text-center"
                    >
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="space-y-8 max-w-sm"
                        >
                            <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
                                <motion.div
                                    animate={{ 
                                        scale: [1, 1.2, 1],
                                        opacity: [0.1, 0.2, 0.1]
                                    }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="absolute inset-0 bg-rose-500 rounded-full"
                                />
                                <WifiOff className="h-12 w-12 text-rose-500 relative z-10" />
                            </div>

                            <div className="space-y-2">
                                <h2 className="text-2xl font-black text-white tracking-tighter font-headline">
                                    Connection Lost
                                </h2>
                                <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
                                    Your internet seems to be disconnected. We are waiting for you to get back online.
                                </p>
                            </div>

                            <div className="p-6 rounded-[2rem] bg-white/5 border border-white/10 space-y-4">
                                <div className="flex items-center gap-3 text-left">
                                    <div className="h-8 w-8 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
                                        <ShieldAlert className="h-4 w-4 text-rose-500" />
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-300 leading-tight">
                                        Trading is paused to keep your money safe while you are offline.
                                    </p>
                                </div>
                            </div>

                            <Button 
                                onClick={handleRetry}
                                className="w-full h-14 rounded-2xl bg-white text-black font-black text-[11px] shadow-xl active:scale-95 transition-all"
                            >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Try connecting again
                            </Button>
                        </motion.div>

                        <div className="absolute bottom-12">
                            <p className="text-[9px] font-bold text-slate-500 tracking-wider">
                                StockMint Safety Guardian
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            {children}
        </>
    );
}