'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

/**
 * @fileOverview App Boot Loader
 * Handles the splash transition with friendly, welcoming language.
 */

export function AppBootLoader({ children }: { children: React.ReactNode }) {
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsLoaded(true);
        }, 2000);

        return () => clearTimeout(timer);
    }, []);

    return (
        <>
            <AnimatePresence mode="wait">
                {!isLoaded && (
                    <motion.div
                        key="boot-loader"
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0, scale: 1.1 }}
                        transition={{ duration: 0.8, ease: "easeInOut" }}
                        className="fixed inset-0 z-[10000] bg-[#050508] flex flex-col items-center justify-center"
                    >
                        {/* Gradient Atmosphere */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl h-full max-h-2xl bg-[#5D2D91]/10 blur-[120px] pointer-events-none rounded-full" />
                        
                        <div className="relative space-y-12 flex flex-col items-center">
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ 
                                    duration: 1.2, 
                                    ease: [0.16, 1, 0.3, 1] 
                                }}
                                className="relative w-32 h-32 md:w-40 md:h-40"
                            >
                                {/* Scanning Light Effect */}
                                <motion.div
                                    animate={{ 
                                        top: ['-10%', '110%'],
                                        opacity: [0, 1, 0]
                                    }}
                                    transition={{ 
                                        duration: 2, 
                                        repeat: Infinity,
                                        ease: "linear"
                                    }}
                                    className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent z-20"
                                />
                                
                                <div className="w-full h-full rounded-[2.5rem] bg-white p-6 shadow-2xl relative overflow-hidden group flex items-center justify-center">
                                    <Image 
                                        src="/logo.png" 
                                        alt="StockMint" 
                                        fill 
                                        className="object-contain p-4"
                                        priority
                                    />
                                </div>

                                <motion.div
                                    animate={{ 
                                        scale: [1, 1.1, 1],
                                        opacity: [0.3, 0.6, 0.3]
                                    }}
                                    transition={{ duration: 3, repeat: Infinity }}
                                    className="absolute -inset-4 bg-primary/20 blur-2xl rounded-full -z-10"
                                />
                            </motion.div>

                            <div className="text-center space-y-3">
                                <motion.h1 
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.5 }}
                                    className="text-4xl font-black text-white font-headline tracking-tighter"
                                >
                                    StockMint
                                </motion.h1>
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: 120 }}
                                    transition={{ delay: 0.8, duration: 1 }}
                                    className="h-1 bg-gradient-to-r from-transparent via-primary to-transparent mx-auto rounded-full"
                                />
                                <motion.p 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 1.2 }}
                                    className="text-[11px] font-bold text-[#5D2D91] tracking-wide ml-1"
                                >
                                    Smart Trading Hub
                                </motion.p>
                            </div>
                        </div>

                        <div className="absolute bottom-12 flex flex-col items-center gap-4">
                            <div className="flex gap-1.5">
                                {[0, 1, 2].map((i) => (
                                    <motion.div
                                        key={i}
                                        animate={{ 
                                            scale: [1, 1.5, 1],
                                            opacity: [0.3, 1, 0.3]
                                        }}
                                        transition={{ 
                                            duration: 1, 
                                            repeat: Infinity, 
                                            delay: i * 0.2 
                                        }}
                                        className="h-1 w-1 rounded-full bg-white"
                                    />
                                ))}
                            </div>
                            <p className="text-[8px] font-bold text-slate-600">
                                Loading secure session...
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            {isLoaded && children}
        </>
    );
}