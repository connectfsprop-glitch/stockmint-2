'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useUserProfile } from '@/hooks/use-user-profile';
import { AppLayout } from '@/components/app-layout';
import { PerformanceInsights } from '@/components/performance-insights';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function InsightsPage() {
  const { user, portfolio, isLoading: userLoading } = useUserProfile(['student', 'admin', 'mentor']);
  const [orders, setOrders] = useState<any[]>([]);
  const [dailyPnl, setDailyPnl] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    
    const [ordersRes, pnlRes] = await Promise.all([
      supabase.from('orders').select('*').eq('user_id', user.id).eq('status', 'COMPLETED'),
      supabase.from('daily_pnl').select('*').eq('user_id', user.id).order('date', { ascending: true })
    ]);

    setOrders(ordersRes.data || []);
    setDailyPnl(pnlRes.data || []);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (userLoading || isLoading) {
    return (
      <AppLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <header>
          <h1 className="font-headline text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
            Performance Hub
          </h1>
          <p className="text-muted-foreground mt-1">Deep analysis of your trading journey.</p>
        </header>
        
        <PerformanceInsights orders={orders} dailyPnl={dailyPnl} portfolio={portfolio} />
      </div>
    </AppLayout>
  );
}