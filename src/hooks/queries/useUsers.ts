'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchUsersWithPagination, UserFilters } from '@/lib/api/users';

// Hook כללי למשתמשים (תומך בכל התפקידים)
export function useUsersTable(
  page: number, 
  pageSize: number, 
  filters: UserFilters
) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['users', 'list', page, pageSize, filters],
    queryFn: () => fetchUsersWithPagination(page, pageSize, filters),
    placeholderData: (prev) => prev,
  });

  // Realtime Subscription
  useEffect(() => {
    const supabase = createClient();
    
    // בניית פילטר ל-Realtime אם אפשר, או האזנה כללית
    let filter = undefined;
    if (filters.role && filters.role !== 'all') {
      filter = `role=eq.${filters.role}`;
    }

    const channel = supabase.channel(`users-list-${filters.role || 'all'}`)
      .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'users',
          filter: filter 
        }, 
        () => queryClient.invalidateQueries({ queryKey: ['users', 'list'] })
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient, filters.role]);

  return query;
}

// --- Hook לסטטיסטיקות משתמש (נשאר לשימוש בדיאלוגים) ---
// (העתקתי את הלוגיקה הקיימת כי היא משמשת לסטטיסטיקה פרטנית של חנות/מעבדה)
export function useUserStats(userId: string | null, role: string | null) {
  const queryClient = useQueryClient();
  const supabase = createClient();

  const query = useQuery({
    queryKey: ['user', 'stats', userId],
    queryFn: async () => {
      if (!userId || !role) throw new Error('User ID and role are required');
      
      const stats = {
        totalWarranties: 0,
        activeWarranties: 0,
        monthlyActivations: 0,
        totalRepairs: 0,
        pendingRepairs: 0,
        completedRepairs: 0,
      };

      if (role === 'store') {
        const { count: total } = await supabase.from('warranties').select('*', { count: 'exact', head: true }).eq('store_id', userId);
        const { count: active } = await supabase.from('warranties').select('*', { count: 'exact', head: true }).eq('store_id', userId).eq('is_active', true).gte('expiry_date', new Date().toISOString());
        
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const { count: monthly } = await supabase.from('warranties').select('*', { count: 'exact', head: true }).eq('store_id', userId).gte('activation_date', startOfMonth.toISOString());

        stats.totalWarranties = total || 0;
        stats.activeWarranties = active || 0;
        stats.monthlyActivations = monthly || 0;
      } else if (role === 'lab') {
        const { count: total } = await supabase.from('repairs').select('*', { count: 'exact', head: true }).eq('lab_id', userId);
        const { count: pending } = await supabase.from('repairs').select('*', { count: 'exact', head: true }).eq('lab_id', userId).in('status', ['received', 'in_progress']);
        const { count: completed } = await supabase.from('repairs').select('*', { count: 'exact', head: true }).eq('lab_id', userId).eq('status', 'completed');

        stats.totalRepairs = total || 0;
        stats.pendingRepairs = pending || 0;
        stats.completedRepairs = completed || 0;
      }
      return stats;
    },
    enabled: !!userId && !!role,
    staleTime: 1000 * 60 * 5, 
  });

  return query;
}

// Hook תאימות לאחור (אם עדיין בשימוש במקומות אחרים)
export function useAllUsers() {
    const { data, isLoading, isFetching } = useUsersTable(1, 1000, { role: 'all', status: 'all' });
    return {
        users: data?.users || [],
        isLoading,
        isFetching
    };
}