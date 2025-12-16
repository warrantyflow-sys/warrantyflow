'use client';

import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchUsersWithPagination, UserFilters } from '@/lib/api/users';

// Hook כללי למשתמשים (תומך בכל התפקידים)
export function useUsersTable(
  page: number, 
  pageSize: number, 
  filters: UserFilters
) {
  const queryClient = useQueryClient();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const query = useQuery({
    queryKey: ['users', 'list', page, pageSize, filters],
    queryFn: () => fetchUsersWithPagination(page, pageSize, filters),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60,
  });

  // Realtime Subscription
  useEffect(() => {
    const supabase = createClient();
    
    const triggerRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['users', 'list'] });
        queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard', 'stats'] });
      }, 1000);
    };

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
        triggerRefresh
      )
      .subscribe();

    return () => { 
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel); 
    };
  }, [queryClient, filters.role]);

  return query;
}

// --- Hook לסטטיסטיקות משתמש (עבור דיאלוגים) ---
export function useUserStats(userId: string | null, role: string | null) {
  const queryClient = useQueryClient();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const query = useQuery({
    queryKey: ['user', 'stats', userId],
    queryFn: async () => {
      const supabase = createClient();
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
        const { count: pending } = await supabase.from('repairs').select('*', { count: 'exact', head: true }).eq('lab_id', userId).eq('status', 'received');
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

  // Realtime
  useEffect(() => {
    if (!userId || !role) return;
    const supabase = createClient();

    const triggerStatsRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['user', 'stats', userId] });
      }, 1000);
    };

    let channel = null;
    if (role === 'store') {
      channel = supabase.channel(`user-stats-store-${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'warranties', filter: `store_id=eq.${userId}` }, triggerStatsRefresh)
        .subscribe();
    } else if (role === 'lab') {
      channel = supabase.channel(`user-stats-lab-${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'repairs', filter: `lab_id=eq.${userId}` }, triggerStatsRefresh)
        .subscribe();
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (channel) supabase.removeChannel(channel);
    };
  }, [queryClient, userId, role]);

  return query;
}

export function useAllUsers() {
    const { data, isLoading, isFetching } = useUsersTable(1, 1000, { role: 'all', status: 'all' });
    return {
        users: data?.users || [],
        isLoading,
        isFetching
    };
}