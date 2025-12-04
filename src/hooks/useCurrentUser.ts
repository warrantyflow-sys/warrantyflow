'use client';

import { useQuery } from '@tanstack/react-query';
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
  const query = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const supabase = createClient();
      
      // 1. קבלת הסשן הנוכחי
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) return null;

      // 2. אופטימיזציה: ניסיון לקרוא claims מה-JWT
      if (session.access_token) {
        try {
          const tokenParts = session.access_token.split('.');
          if (tokenParts.length === 3) {
            // פענוח בטוח של ה-Payload
            const base64Url = tokenParts[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));

            const payload: JWTPayload = JSON.parse(jsonPayload);
            
            // אם המידע קיים בטוקן (Custom Claims), נחזיר אותו מיד
            if (payload.user_role && payload.user_active !== undefined) {
              return {
                id: session.user.id,
                email: session.user.email || '',
                full_name: session.user.user_metadata?.full_name || '',
                phone: session.user.user_metadata?.phone || '',
                role: payload.user_role,
                is_active: payload.user_active,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              } as UserData;
            }
          }
        } catch (e) {
          console.warn('JWT parsing failed, falling back to DB', e);
        }
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

  return { 
    user: query.data ?? null, 
    isLoading: query.isLoading, 
    error: query.error 
  };
}