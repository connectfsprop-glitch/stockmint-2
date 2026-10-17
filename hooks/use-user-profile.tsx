'use client';

import { useState, useEffect, useCallback, createContext, useContext, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  is_active: boolean;
  is_kyc_blocked: boolean;
  market_type: 'indian' | 'forex';
  created_at: string;
  email?: string;
  account_classification: string | null;
};

type Portfolio = {
  id: string;
  user_id: string;
  cash_balance: number;
  opening_balance_today: number;
  high_water_mark: number;
};

type Leverages = {
    user_id: string;
    equity: number;
    futures: number;
    options: number;
    currency: number;
    commodity: number;
};

type UserProfileContextType = {
  user: User | null;
  profile: Profile | null;
  portfolio: Portfolio | null;
  leverages: Leverages | null;
  isLoading: boolean;
  hasCheckedAuth: boolean;
  revalidate: () => void;
};

const UserProfileContext = createContext<UserProfileContextType | null>(null);

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
    const [leverages, setLeverages] = useState<Leverages | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

    const revalidate = useCallback(async () => {
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            
            if (sessionError) {
                if (sessionError.message?.toLowerCase().includes('refresh token')) {
                    await supabase.auth.signOut();
                }
                console.error("Session revalidation error:", sessionError.message);
                setIsLoading(false);
                setHasCheckedAuth(true);
                return;
            }

            const currentUser = session?.user ?? null;
            setUser(currentUser);

            if (currentUser) {
                 const { data: fetchedProfile, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', currentUser.id)
                    .single();

                if (profileError) {
                    console.error("Profile fetch error on revalidate:", profileError.message);
                }
                setProfile(fetchedProfile ? { ...fetchedProfile, email: currentUser.email } : null);

                const { data: fetchedPortfolio, error: portfolioError } = await supabase
                    .from('portfolios')
                    .select('*')
                    .eq('user_id', currentUser.id)
                    .single();
                if (portfolioError && portfolioError.code !== 'PGRST116') {
                     console.error("Portfolio fetch error on revalidate:", portfolioError.message);
                }
                setPortfolio(fetchedPortfolio || null);

                const { data: fetchedLeverages, error: leveragesError } = await supabase
                    .from('leverages')
                    .select('*')
                    .eq('user_id', currentUser.id)
                    .single();
                if (leveragesError && leveragesError.code !== 'PGRST116') {
                     console.error("Leverages fetch error on revalidate:", leveragesError.message);
                }
                setLeverages(fetchedLeverages || null);

            } else {
                setProfile(null);
                setPortfolio(null);
                setLeverages(null);
            }
        } catch (e) {
            console.error("Revalidate Exception:", e);
        } finally {
            setIsLoading(false);
            setHasCheckedAuth(true);
        }
    }, []);

    useEffect(() => {
        const theme = localStorage.getItem('theme');
        if (theme === 'light') {
            document.documentElement.classList.remove('dark');
        } else {
            document.documentElement.classList.add('dark');
        }
    }, []);

    useEffect(() => {
        revalidate();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const currentUser = session?.user ?? null;
            setUser(currentUser);
            if (!currentUser) {
                setProfile(null);
                setPortfolio(null);
                setLeverages(null);
            } else {
                revalidate();
            }
        });

        return () => {
            subscription?.unsubscribe();
        };
    }, [revalidate]);

    const value = useMemo(() => ({
        user,
        profile,
        portfolio,
        leverages,
        isLoading,
        hasCheckedAuth,
        revalidate,
    }), [user, profile, portfolio, leverages, isLoading, hasCheckedAuth, revalidate]);

    return (
        <UserProfileContext.Provider value={value}>
            {children}
        </UserProfileContext.Provider>
    );
}

export function useUserProfile(allowedRoles?: string[]) {
  const context = useContext(UserProfileContext);
  const router = useRouter();
  
  if (!context) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }

  const { profile, hasCheckedAuth } = context;

  useEffect(() => {
    if (!hasCheckedAuth) return;

    // Only redirect to login if roles are explicitly requested (guarded route)
    if (!profile) {
      if (allowedRoles) {
        router.push('/login');
      }
      return;
    }

    if (profile.is_kyc_blocked) {
      router.push('/login?error=restricted');
    } else if (allowedRoles && !allowedRoles.includes(profile.role)) {
      router.push('/login?error=unauthorized');
    }
  }, [profile, hasCheckedAuth, allowedRoles, router]);

  const isAuthorized = hasCheckedAuth && !!profile && !profile.is_kyc_blocked && (!allowedRoles || allowedRoles.includes(profile.role));

  return { ...context, isAuthorized };
}