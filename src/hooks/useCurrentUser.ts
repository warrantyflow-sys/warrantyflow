'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { UserData } from '@/types/user';

interface JWTPayload {
  user_role?: string;
  user_active?: boolean;
  sub?: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    phone?: string;
  };
}

export function useCurrentUser() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const query = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // אם אין session (למשל בניווט מיידי אחרי login)
      // ננסה getUser() כ-fallback
      if (!session?.user) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        
        // אין לנו JWT claims, אז נקרא מה-DB
        const { data: userData, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();
          
        if (error) throw error;
        return userData as UserData;
      }

      if (session.user.app_metadata?.user_role && session.user.app_metadata?.user_active !== undefined) {
        return {
          id: session.user.id,
          email: session.user.email || '',
          full_name: session.user.user_metadata?.full_name || '',
          phone: session.user.user_metadata?.phone || '',
          role: session.user.app_metadata?.user_role,
          is_active: session.user.app_metadata?.user_active,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as UserData;
      }

      // 3. Fallback: קריאה למסד הנתונים אם המידע חסר בטוקן
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (userError) throw userError;

      return userData as UserData;
    },
    staleTime: 1000 * 60 * 10,
    retry: false,
  });


  // 1. האזנה לשינויים בסטטוס ההתחברות (Auth)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      }
    });

    return () => subscription.unsubscribe();
  }, [queryClient, supabase]);

  useEffect(() => {
    const userId = query.data?.id;
    if (!userId) return;

    const channel = supabase.channel(`current-user-${userId}`)
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'users', 
          filter: `id=eq.${userId}`
        },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            console.log('User profile updated via Realtime');
            queryClient.invalidateQueries({ queryKey: ['currentUser'] });
          }, 1000);
        }
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [query.data?.id, queryClient, supabase]);

  return { 
    user: query.data ?? null, 
    isLoading: query.isLoading, 
    error: query.error 
  };
}