'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { format } from 'date-fns';

/**
 * @fileOverview Institutional News & Event Management
 * Now features automated notification broadcasting for restricted windows.
 */

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function addNewsEvent(eventName: string, scheduledAt: string) {
    try {
        const { data: newEvent, error } = await supabaseAdmin
            .from('news_events')
            .insert({ event_name: eventName, scheduled_at: scheduledAt })
            .select()
            .single();

        if (error) throw error;

        // --- BROADCAST NOTIFICATION ---
        // Create an alert for all users about the upcoming restricted window
        // For MVP, we alert the current admin and suggest a batch trigger
        const { data: profiles } = await supabaseAdmin.from('profiles').select('id');
        
        if (profiles && profiles.length > 0) {
            const formattedTime = format(new Date(scheduledAt), 'hh:mm a');
            const notifications = profiles.map(p => ({
                user_id: p.id,
                title: 'Upcoming Restricted Window',
                content: `Institutional restricted window scheduled for ${eventName} at ${formattedTime}. No trading ±5 mins.`,
                type: 'WARNING',
                is_read: false
            }));

            // Batch insert to avoid rate limits
            await supabaseAdmin.from('user_notifications').insert(notifications);
        }

        revalidatePath('/admin/settings');
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function deleteNewsEvent(id: number) {
    try {
        const { error } = await supabaseAdmin
            .from('news_events')
            .delete()
            .eq('id', id);

        if (error) throw error;
        revalidatePath('/admin/settings');
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function getNewsEvents() {
    try {
        const { data, error } = await supabaseAdmin
            .from('news_events')
            .select('*')
            .order('scheduled_at', { ascending: true });

        if (error) throw error;
        return { success: true, data };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}
