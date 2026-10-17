
'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export type UserProfile = {
    id: string;
    full_name: string | null;
    email: string | null;
    role: string;
    is_active: boolean;
    is_hidden: boolean;
    cash_balance: number;
    market_type: string;
}

type GetUsersResult = {
    success: true;
    data: UserProfile[];
} | {
    success: false;
    error: string;
};

export async function getAllUsers(): Promise<GetUsersResult> {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) =>
                  cookieStore.set(name, value, options)
                );
              } catch {
                // Ignore if called from RSC
              }
            },
          },
        }
    );
    
    const { data: { user: adminUser }, error: sessionError } = await supabase.auth.getUser();
    if (sessionError || !adminUser) {
        return { success: false, error: 'Not authenticated.' };
    }

    const { data: adminProfile, error: adminProfileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', adminUser.id)
        .single();
    
    if (adminProfileError || adminProfile?.role !== 'admin') {
        return { success: false, error: 'Unauthorized.' };
    }

    // 1. Fetch all user profiles including market_type
    const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select(`id, full_name, role, is_active, is_hidden, market_type`);
    
    if (profilesError) {
        return { success: false, error: `Failed to fetch profiles: ${profilesError.message}` };
    }
    
    const userIds = profiles.map(p => p.id);
    if (userIds.length === 0) {
        return { success: true, data: [] };
    }

    // 2. Fetch all portfolios for these users
    const { data: portfolios, error: portfoliosError } = await supabase
        .from('portfolios')
        .select('user_id, cash_balance')
        .in('user_id', userIds);
    
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
        is_hidden: profile.is_hidden || false,
        cash_balance: portfolioMap.get(profile.id) ?? 0,
        market_type: profile.market_type || 'indian'
    }));

    return { success: true, data: transformedUsers as UserProfile[] };
}
