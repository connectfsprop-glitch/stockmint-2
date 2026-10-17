'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
    Search, Send, Paperclip, MessageSquare, 
    ChevronRight, Trash2, Megaphone, Loader2, Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
    getSupportChatList, 
    getSupportMessages, 
    sendSupportMessage, 
    markMessagesAsRead, 
    deleteSupportChat,
    sendBulkSupportMessage
} from '../actions/support-actions';
import { format } from 'date-fns';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

/**
 * @fileOverview INSTITUTIONAL SUPPORT HUB
 * Bulletproof terminal for support agents.
 * Optimized with extreme defensive rendering to fix client-side exceptions.
 */

export default function SupportTeamPage() {
    const { user } = useUserProfile(['support', 'admin']);
    const [chats, setChats] = useState<any[]>([]);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [isLoadingChats, setIsLoadingChats] = useState(true);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [messageInput, setMessageInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Broadcast States
    const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
    const [broadcastInput, setBroadcastInput] = useState('');
    const [isBroadcasting, setIsBroadcasting] = useState(false);

    const fetchChats = useCallback(async () => {
        const res = await getSupportChatList();
        if (res.success) setChats(res.data || []);
        setIsLoadingChats(false);
    }, []);

    const fetchMessages = useCallback(async (id: string) => {
        if (!id) return;
        setIsLoadingMessages(true);
        const res = await getSupportMessages(id);
        if (res.success) {
            setMessages(res.data || []);
            await markMessagesAsRead(id, 'student');
        }
        setIsLoadingMessages(false);
    }, []);

    useEffect(() => {
        fetchChats();
        const chatChannel = supabase.channel('support-global')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages' }, () => {
                fetchChats();
            })
            .subscribe();
        return () => { supabase.removeChannel(chatChannel); };
    }, [fetchChats]);

    useEffect(() => {
        if (!selectedStudentId) return;
        fetchMessages(selectedStudentId);

        const msgChannel = supabase.channel(`support-chat-${selectedStudentId}`)
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'support_messages',
                filter: `student_id=eq.${selectedStudentId}` 
            }, (payload) => {
                setMessages(prev => [...prev, payload.new]);
                if (payload.new.sender_role === 'student') {
                    markMessagesAsRead(selectedStudentId, 'student');
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(msgChannel); };
    }, [selectedStudentId, fetchMessages]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if ((!messageInput.trim() && !fileInputRef.current?.files?.[0]) || !selectedStudentId || !user) return;

        setIsSending(true);
        const formData = new FormData();
        if (fileInputRef.current?.files?.[0]) {
            formData.append('attachment', fileInputRef.current.files[0]);
        }

        const res = await sendSupportMessage(selectedStudentId, user.id, 'support', messageInput, formData);
        if (res.success) {
            setMessageInput('');
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
        setIsSending(false);
    };

    const handleSendBroadcast = async () => {
        if (!broadcastInput.trim() || !user || !Array.isArray(chats)) return;
        setIsBroadcasting(true);
        const unreadStudentIds = chats.filter(c => c && c.unread_count > 0).map(c => c.student_id);
        
        if (unreadStudentIds.length > 0) {
            const res = await sendBulkSupportMessage(unreadStudentIds, user.id, broadcastInput);
            if (res.success) {
                setBroadcastInput('');
                setIsBroadcastOpen(false);
                fetchChats();
            }
        }
        setIsBroadcasting(false);
    };

    const handleDeleteChat = async (e: React.MouseEvent, studentId: string) => {
        e.stopPropagation();
        if (!studentId) return;
        const res = await deleteSupportChat(studentId);
        if (res.success) {
            if (selectedStudentId === studentId) {
                setSelectedStudentId(null);
                setMessages([]);
            }
            fetchChats();
        }
    };

    const filteredChats = useMemo(() => {
        if (!Array.isArray(chats)) return [];
        return chats.filter(c => (c?.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()));
    }, [chats, searchQuery]);

    const activeChat = useMemo(() => {
        if (!Array.isArray(chats) || !selectedStudentId) return null;
        return chats.find(c => c.student_id === selectedStudentId);
    }, [chats, selectedStudentId]);

    const unreadChatCount = useMemo(() => {
        if (!Array.isArray(chats)) return 0;
        return chats.filter(c => c && c.unread_count > 0).length;
    }, [chats]);

    const safeFormatTime = (dateStr: any) => {
        try {
            if (!dateStr) return '--:--';
            return format(new Date(dateStr), 'HH:mm');
        } catch (e) {
            return '--:--';
        }
    }

    return (
        <div className="flex h-screen overflow-hidden bg-[#030305] text-white">
            {/* Sidebar: Chat List */}
            <aside className="w-80 md:w-96 border-r border-white/5 flex flex-col bg-[#050508]">
                <header className="p-6 border-b border-white/5 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Shield className="h-5 w-5 text-primary" />
                        </div>
                        <h1 className="font-headline font-black tracking-tighter text-xl uppercase">Support Hub</h1>
                    </div>
                    
                    <Button 
                        variant="outline" 
                        className={cn(
                            "w-full h-12 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest border-white/5",
                            unreadChatCount > 0 ? "bg-primary text-white purple-glow" : "bg-white/[0.02] text-muted-foreground opacity-20"
                        )}
                        onClick={() => unreadChatCount > 0 && setIsBroadcastOpen(true)}
                        disabled={unreadChatCount === 0}
                    >
                        <Megaphone className="h-4 w-4 mr-3" />
                        Broadcast to Unread ({unreadChatCount})
                    </Button>

                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="SEARCH TRADERS..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="bg-white/[0.03] border-white/10 pl-10 h-11 rounded-xl text-[10px] font-black tracking-widest"
                        />
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto no-scrollbar">
                    {isLoadingChats ? (
                        <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto opacity-20" /></div>
                    ) : filteredChats.length === 0 ? (
                        <div className="p-12 text-center opacity-20"><p className="text-[10px] font-black uppercase tracking-[0.2em]">Queue Clear</p></div>
                    ) : (
                        filteredChats.map(chat => (
                            <button 
                                key={chat?.student_id || Math.random()}
                                onClick={() => setSelectedStudentId(chat?.student_id)}
                                className={cn(
                                    "w-full p-5 flex items-start gap-4 border-b border-white/[0.02] transition-all hover:bg-white/[0.02] group relative",
                                    selectedStudentId === chat?.student_id ? "bg-white/[0.04] border-l-4 border-l-primary" : "border-l-4 border-l-transparent"
                                )}
                            >
                                <div className="h-12 w-12 rounded-2xl bg-white/[0.05] border border-white/5 flex items-center justify-center text-lg font-black text-white/40">
                                    {String(chat?.full_name || 'A').charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                    <div className="flex justify-between items-center mb-1">
                                        <p className="font-black text-xs text-white uppercase truncate">{chat?.full_name || 'Anonymous'}</p>
                                        <span className="text-[8px] font-bold text-muted-foreground opacity-40">
                                            {safeFormatTime(chat?.last_time)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center gap-2">
                                        <p className={cn("text-[10px] truncate opacity-60 flex-1", chat?.unread_count > 0 && "text-white font-bold opacity-100")}>
                                            {chat?.last_message || 'Attachment sent'}
                                        </p>
                                        {chat?.unread_count > 0 && (
                                            <div className="bg-primary h-4 min-w-4 px-1 rounded-full flex items-center justify-center text-[8px] font-black text-white">
                                                {chat?.unread_count}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <ChevronRight className={cn("h-4 w-4 text-white/10 self-center", selectedStudentId === chat?.student_id && "text-primary")} />
                                <div className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity p-2 text-rose-500 hover:text-rose-400" onClick={(e) => handleDeleteChat(e, chat?.student_id)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </aside>

            {/* Main: Chat Window */}
            <main className="flex-1 flex flex-col relative bg-[#030305]">
                {selectedStudentId && activeChat ? (
                    <>
                        <header className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-[#050508]/50 backdrop-blur-xl">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black">
                                    {String(activeChat?.full_name || 'A').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h2 className="font-black text-sm text-white uppercase tracking-tight">{activeChat?.full_name || 'Anonymous'}</h2>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <div className={cn("h-1.5 w-1.5 rounded-full", activeChat?.is_active ? "bg-emerald-500" : "bg-rose-500")} />
                                        <p className={cn("text-[8px] font-black uppercase tracking-widest", activeChat?.is_active ? "text-emerald-500" : "text-rose-500")}>
                                            {activeChat?.is_active ? 'Active Terminal' : 'Restricted Terminal'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </header>

                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar">
                            {isLoadingMessages ? (
                                <div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" /></div>
                            ) : (
                                messages.map((msg) => (
                                    <div key={msg.id} className={cn("flex flex-col max-w-[70%]", msg.sender_role === 'support' ? "ml-auto items-end" : "items-start")}>
                                        <div className={cn("p-4 rounded-2xl relative shadow-2xl", msg.sender_role === 'support' ? "bg-primary text-white rounded-tr-none" : "bg-white/[0.03] border border-white/5 text-white rounded-tl-none")}>
                                            {msg.attachment_url && (
                                                <div className="mb-3 rounded-xl overflow-hidden border border-white/10">
                                                    <Image src={msg.attachment_url} alt="Attachment" width={400} height={300} className="w-full h-auto object-contain max-h-60" />
                                                </div>
                                            )}
                                            {msg.content && <p className="text-xs font-bold leading-relaxed">{msg.content}</p>}
                                            <div className="flex items-center gap-2 mt-2 opacity-40 justify-end">
                                                <span className="text-[8px] font-black uppercase tracking-widest">{safeFormatTime(msg.created_at)}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <footer className="p-6 bg-[#050508]/50 border-t border-white/5 backdrop-blur-xl">
                            <form onSubmit={handleSendMessage} className="flex items-center gap-4 max-w-5xl mx-auto">
                                <input type="file" className="hidden" ref={fileInputRef} accept="image/*" />
                                <Button type="button" variant="ghost" size="icon" className="h-12 w-12 rounded-xl bg-white/[0.03] hover:bg-white/10" onClick={() => fileInputRef.current?.click()}>
                                    <Paperclip className="h-5 w-5" />
                                </Button>
                                <Input 
                                    placeholder="TYPE REPLY..." 
                                    className="flex-1 bg-white/[0.03] border-white/10 h-12 rounded-2xl px-6 text-xs font-bold uppercase"
                                    value={messageInput}
                                    onChange={e => setMessageInput(e.target.value)}
                                />
                                <Button type="submit" className="h-12 w-12 rounded-xl bg-primary text-white purple-glow" disabled={isSending}>
                                    {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                                </Button>
                            </form>
                        </footer>
                    </>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center opacity-10 p-12 text-center">
                        <MessageSquare className="h-32 w-32 mb-8" />
                        <h2 className="text-4xl font-black uppercase tracking-tighter">Terminal Standby</h2>
                    </div>
                )}
            </main>

            {/* Broadcast Dialog */}
            <Dialog open={isBroadcastOpen} onOpenChange={setIsBroadcastOpen}>
                <DialogContent className="bg-[#050508]/95 backdrop-blur-2xl border-white/10 rounded-[2.5rem] max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black text-white tracking-tighter uppercase">Broadcast Response</DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">Send common response to {unreadChatCount} traders in queue.</DialogDescription>
                    </DialogHeader>
                    <div className="py-6">
                        <Input 
                            placeholder="TYPE BROADCAST MESSAGE..." 
                            value={broadcastInput}
                            onChange={e => setBroadcastInput(e.target.value)}
                            className="bg-white/[0.02] border-white/10 h-14 rounded-2xl px-4 font-bold text-sm uppercase"
                        />
                    </div>
                    <DialogFooter>
                        <Button className="w-full h-14 rounded-2xl bg-primary text-white font-black text-[10px] uppercase tracking-widest purple-glow" onClick={handleSendBroadcast} disabled={isBroadcasting || !broadcastInput.trim()}>
                            {isBroadcasting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 'Authorize Broadcast'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}