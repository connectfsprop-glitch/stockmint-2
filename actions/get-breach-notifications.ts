
'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export type BreachNotification = {
    id: number;
    created_at: string;
    breach_reason: string;
    profiles: {
        full_name: string | null;
    } | null;
};

/**
 * Fetches platform violation history from the orders ledger.
 * Captured from the same source as the user-panel "Shield Icon".
 */
export async function getBreachNotifications() {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() { return cookieStore.getAll(); },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
              } catch {}
            },
          },
        }
    );

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return { success: false, error: 'Not authenticated.' };

        // Robust query: capture any record with a reason (not null and not empty)
        const { data, error } = await supabase
            .from('orders')
            .select(`
                id,
                created_at,
                breach_reason,
                profiles (
                    full_name
                )
            `)
            .not('breach_reason', 'is', null)
            .neq('breach_reason', '')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        return { success: true, data: data as BreachNotification[] };

    } catch (error: any) {
        console.error('Error in getBreachNotifications:', error);
        return { success: false, error: error.message || 'An unknown error occurred.' };
    }
}
