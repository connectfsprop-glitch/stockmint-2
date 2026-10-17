'use server';

import { createClient } from '@supabase/supabase-js';

/**
 * @fileOverview Institutional Support Actions
 * Simplified for maximum reliability and speed.
 */

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function sendSupportMessage(studentId: string, senderId: string, senderRole: 'student' | 'support', content: string, formData?: FormData) {
    try {
        let attachmentUrl = null;

        if (formData) {
            const file = formData.get('attachment') as File;
            if (file && file.size > 0) {
                const filePath = `support/${studentId}/${Date.now()}-${file.name}`;
                const { error: uploadError } = await supabaseAdmin.storage
                    .from('support_attachments')
                    .upload(filePath, file);

                if (!uploadError) {
                    const { data: { publicUrl } } = supabaseAdmin.storage
                        .from('support_attachments')
                        .getPublicUrl(filePath);
                    attachmentUrl = publicUrl;
                }
            }
        }

        const { error } = await supabaseAdmin
            .from('support_messages')
            .insert({
                student_id: studentId,
                sender_id: senderId,
                sender_role: senderRole,
                content: content || '',
                attachment_url: attachmentUrl,
                is_read: false
            });

        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function sendBulkSupportMessage(studentIds: string[], senderId: string, content: string) {
    try {
        if (!studentIds || studentIds.length === 0) return { success: true };
        
        const messages = studentIds.map(id => ({
            student_id: id,
            sender_id: senderId,
            sender_role: 'support',
            content,
            is_read: false
        }));

        const { error: insertError } = await supabaseAdmin
            .from('support_messages')
            .insert(messages);

        if (insertError) throw insertError;

        // Clear the queue for these users
        await supabaseAdmin
            .from('support_messages')
            .update({ is_read: true })
            .in('student_id', studentIds)
            .eq('sender_role', 'student')
            .eq('is_read', false);

        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function getSupportChatList() {
    try {
        const { data, error } = await supabaseAdmin
            .from('support_messages')
            .select(`
                student_id,
                created_at,
                content,
                profiles:student_id (
                    full_name,
                    id,
                    is_active
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Fetch unread counts separately for precision
        const { data: unreadData } = await supabaseAdmin
            .from('support_messages')
            .select('student_id')
            .eq('sender_role', 'student')
            .eq('is_read', false);

        const unreadCounts = new Map<string, number>();
        unreadData?.forEach(m => {
            unreadCounts.set(m.student_id, (unreadCounts.get(m.student_id) || 0) + 1);
        });

        const latestChats = new Map();
        data?.forEach(msg => {
            if (!latestChats.has(msg.student_id)) {
                // Defensive extraction of profile info
                const rawProfile = msg.profiles;
                const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
                
                latestChats.set(msg.student_id, {
                    student_id: msg.student_id,
                    full_name: profile?.full_name || 'Anonymous User',
                    is_active: profile?.is_active ?? true,
                    last_message: msg.content || '',
                    last_time: msg.created_at || new Date().toISOString(),
                    unread_count: unreadCounts.get(msg.student_id) || 0
                });
            }
        });

        return { success: true, data: Array.from(latestChats.values()) };
    } catch (error: any) {
        console.error("Chat List Fetch Error:", error);
        return { success: false, error: error.message };
    }
}

export async function getSupportMessages(studentId: string) {
    try {
        const { data, error } = await supabaseAdmin
            .from('support_messages')
            .select('*')
            .eq('student_id', studentId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return { success: true, data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function markMessagesAsRead(studentId: string, senderRoleToMark: 'student' | 'support') {
    try {
        const { error } = await supabaseAdmin
            .from('support_messages')
            .update({ is_read: true })
            .eq('student_id', studentId)
            .eq('sender_role', senderRoleToMark)
            .eq('is_read', false);

        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteSupportChat(studentId: string) {
    try {
        const { error } = await supabaseAdmin
            .from('support_messages')
            .delete()
            .eq('student_id', studentId);

        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}