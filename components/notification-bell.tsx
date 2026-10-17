'use client';

import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react';
import { 
    Popover, PopoverContent, PopoverTrigger 
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { getNotifications, markNotificationAsRead } from '@/app/actions/get-notifications';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';

/**
 * @fileOverview INSTITUTIONAL NOTIFICATION CENTER v2.2
 * Light-themed drawer with professional sentence-case typography.
 */

export function NotificationBell() {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchNotifications = async () => {
        const res = await getNotifications();
        if (res.success) {
            setNotifications(res.data || []);
            setUnreadCount((res.data || []).filter((n: any) => !n.is_read).length);
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleRead = async (id: number) => {
        await markNotificationAsRead(id);
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'SUCCESS': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
            case 'WARNING': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
            case 'ERROR': return <XCircle className="h-4 w-4 text-rose-500" />;
            default: return <Info className="h-4 w-4 text-blue-500" />;
        }
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 transition-all">
                    <Bell className="h-5 w-5 text-white/60" />
                    {unreadCount > 0 && (
                        <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary flex items-center justify-center text-[8px] font-black text-white purple-glow animate-pulse">
                            {unreadCount}
                        </div>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 bg-white/95 backdrop-blur-3xl border-slate-200 rounded-[1.5rem] shadow-2xl overflow-hidden mt-2">
                <div className="p-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                    <p className="text-xs font-bold text-slate-900 font-headline">Status Center</p>
                    {unreadCount > 0 && <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/20 font-bold">{unreadCount} New</Badge>}
                </div>
                <ScrollArea className="h-80">
                    {notifications.length === 0 ? (
                        <div className="py-20 text-center opacity-20">
                            <Bell className="h-10 w-10 mx-auto mb-2 text-slate-400" />
                            <p className="text-[10px] font-bold text-slate-500">Log empty</p>
                        </div>
                    ) : (
                        notifications.map((n) => (
                            <div 
                                key={n.id} 
                                onClick={() => !n.is_read && handleRead(n.id)}
                                className={cn(
                                    "p-4 border-b border-slate-50 cursor-pointer transition-colors hover:bg-slate-50",
                                    !n.is_read ? "bg-primary/[0.03]" : "opacity-60"
                                )}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5">{getTypeIcon(n.type)}</div>
                                    <div className="flex-1 space-y-1">
                                        <p className="text-xs font-bold text-slate-800 leading-tight tracking-tight">{n.title}</p>
                                        <p className="text-[10px] text-slate-500 leading-relaxed font-medium">{n.content}</p>
                                        <p className="text-[8px] text-slate-400 font-bold">
                                            {formatDistanceToNow(new Date(n.created_at))} ago
                                        </p>
                                    </div>
                                    {!n.is_read && <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1" />}
                                </div>
                            </div>
                        ))
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}
