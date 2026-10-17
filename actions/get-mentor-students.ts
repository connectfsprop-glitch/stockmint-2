'use client';

import { createClient } from '@supabase/supabase-js';
import type { UserProfile } from './get-all-users';

type GetStudentsResult = {
    success: true;
    data: UserProfile[];
} | {
    success: false;
    error: string;
};

export async function getMentorStudents(userId: string): Promise<GetStudentsResult> {
    if (!userId) {
        return { success: false, error: 'Not authenticated' };
    }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    try {
        const { data: profiles, error: profilesError } = await supabaseAdmin
            .from('profiles')
            .select(`id, full_name, role, is_active`)
            .eq('assigned_mentor_id', userId);

        if (profilesError) {
            return { success: false, error: `Failed to fetch profiles: ${profilesError.message}` };
        }

        const studentIds = profiles.map(p => p.id);
        if (studentIds.length === 0) {
            return { success: true, data: [] };
        }

        const { data: portfolios, error: portfoliosError } = await supabaseAdmin
            .from('portfolios')
            .select('user_id, cash_balance')
            .in('user_id', studentIds);
        
        if (portfoliosError) {
            return { success: false, error: `Failed to fetch portfolios: ${portfoliosError.message}` };
        }

        const portfolioMap = new Map(portfolios.map(p => [p.user_id, p.cash_balance]));

        const transformedUsers = profiles.map(profile => ({
            id: profile.id,
            full_name: profile.full_name,
            email: null,
            role: profile.role,
            is_active: profile.is_active,
            cash_balance: portfolioMap.get(profile.id) ?? 0,
        }));

        return { success: true, data: transformedUsers as UserProfile[] };
    } catch (error: any) {
        console.error("Error fetching mentor's students:", error);
        return { success: false, error: error.message || 'An unknown error occurred.' };
    }
}
