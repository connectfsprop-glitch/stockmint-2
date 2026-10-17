
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useUserProfile } from '@/hooks/use-user-profile';
import { 
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription 
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
    Send, Paperclip, MessageSquare, Loader2, 
    ShieldCheck, Image as ImageIcon, X 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSupportMessages, sendSupportMessage, markMessagesAsRead } from '@/app/actions/support-actions';
import { format } from 'date-fns';
import Image from 'next/image';

/**
 * @fileOverview User-side Live Support Terminal
 * Handles individual chat sessions with the support team with unread marking.
 */

interface LiveSupportProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function LiveSupport({ isOpen, onOpenChange }: LiveSupportProps) {
    const { user, profile } = useUserProfile();
    const [messages, setMessages] = useState<any[]>([]);
    const [messageInput, setMessageInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchMessages = async () => {
        if (!user) return;
        setIsLoading(true);
        const res = await getSupportMessages(user.id);
        if (res.success) {
            setMessages(res.data || []);
            // Mark support replies as read when student views the chat
            await markMessagesAsRead(user.id, 'support');
        }
        setIsLoading(false);
    };

    useEffect(() => {
        if (isOpen) {
            fetchMessages();
            
            const channel = supabase.channel(`support-user-${user?.id}`)
                .on('postgres_changes', { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'support_messages',
                    filter: `student_id=eq.${user?.id}`
                }, (payload) => {
                    setMessages(prev => [...prev, payload.new]);
                    if (payload.new.sender_role === 'support') {
                        markMessagesAsRead(user!.id, 'support');
                    }
                })
                .subscribe();

            return () => { supabase.removeChannel(channel); };
        }
    }, [isOpen, user?.id]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if ((!messageInput.trim() && !fileInputRef.current?.files?.[0]) || !user) return;

        setIsSending(true);
        const formData = new FormData();
        if (fileInputRef.current?.files?.[0]) {
            formData.append('attachment', fileInputRef.current.files[0]);
        }

        const res = await sendSupportMessage(user.id, user.id, 'student', messageInput, formData);
        if (res.success) {
            setMessageInput('');
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
        setIsSending(false);
    };

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full sm:max-w-md bg-[#050508] border-l-white/5 p-0 flex flex-col">
                <SheetHeader className="p-6 border-b border-white/5 bg-black/20">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                            <MessageSquare className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <SheetTitle className="text-xl font-black text-white uppercase tracking-tighter">Live Support</SheetTitle>
                            <SheetDescription className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Terminal Active</SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                <div 
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar"
                >
                    {isLoading ? (
                        <div className="h-full flex items-center justify-center opacity-20"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    ) : messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-20 p-8">
                            <ShieldCheck className="h-16 w-16 mb-4" />
                            <p className="text-[10px] font-black uppercase tracking-[0.2em]">Institutional Guard Online</p>
                            <p className="text-[8px] font-bold mt-2 uppercase tracking-widest leading-relaxed">Send a message to initialize session</p>
                        </div>
                    ) : (
                        messages.map((msg) => {
                            const isMe = msg.sender_role === 'student';
                            return (
                                <div key={msg.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                                    {!isMe && <span className="text-[8px] font-black text-primary uppercase tracking-[0.2em] mb-1.5 ml-1">Support Team</span>}
                                    <div className={cn(
                                        "p-4 rounded-2xl relative max-w-[85%] shadow-xl",
                                        isMe 
                                            ? "bg-white/[0.03] border border-white/5 text-white rounded-tr-none" 
                                            : "bg-primary text-white rounded-tl-none"
                                    )}>
                                        {msg.attachment_url && (
                                            <div className="mb-2 rounded-lg overflow-hidden bg-black/40">
                                                <Image src={msg.attachment_url} alt="Screenshot" width={300} height={200} className="w-full h-auto" />
                                            </div>
                                        )}
                                        {msg.content && <p className="text-xs font-bold leading-relaxed">{msg.content}</p>}
                                        <p className="text-[7px] font-black opacity-40 mt-2 uppercase text-right">
                                            {format(new Date(msg.created_at), 'HH:mm')}
                                        </p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <footer className="p-6 border-t border-white/5 bg-black/40">
                    <form onSubmit={handleSend} className="flex items-center gap-3">
                        <input type="file" className="hidden" ref={fileInputRef} accept="image/*" />
                        <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="h-11 w-11 rounded-xl bg-white/[0.03] hover:bg-white/10 shrink-0"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Paperclip className="h-4 w-4" />
                        </Button>
                        <Input 
                            placeholder="INITIALIZE MESSAGE..." 
                            className="bg-white/[0.03] border-white/10 h-11 rounded-xl px-4 text-[10px] font-black tracking-widest uppercase focus:border-primary/50 transition-all placeholder:opacity-20"
                            value={messageInput}
                            onChange={e => setMessageInput(e.target.value)}
                        />
                        <Button 
                            type="submit" 
                            className="h-11 w-11 rounded-xl bg-primary text-white purple-glow shrink-0"
                            disabled={isSending}
                        >
                            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                    </form>
                </footer>
            </SheetContent>
        </Sheet>
    );
}
