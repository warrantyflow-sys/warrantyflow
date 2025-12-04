'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchRepairsWithPagination, fetchLabRepairs } from '@/lib/api/repairs';

/**
 * Hook לשליפת תיקונים של מעבדה עם Realtime updates
 *
 * @param labId - מזהה המעבדה
 * @returns תיקונים, מצב טעינה ואינדיקטור רענון רקע
 */
export function useLabRepairs(labId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['repairs', 'lab', labId],
    queryFn: () => {
      if (!labId) throw new Error('Lab ID is required');
      return fetchLabRepairs(labId);
    },
    enabled: !!labId, // רק אם יש labId
    // ✅ No refetchInterval needed - Realtime subscription handles updates
    refetchInterval: 60 * 1000, // 60 seconds as backup to Realtime
  });

  // Supabase Realtime subscription
  useEffect(() => {
    if (!labId) return;

    const supabase = createClient();

    // Subscribe to repairs changes for this lab
    const channel = supabase
      .channel(`repairs-lab-${labId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'repairs',
          filter: `lab_id=eq.${labId}`,
        },
        (payload) => {
          console.log('Repair changed:', payload);

          // Invalidate and refetch
          queryClient.invalidateQueries({
            queryKey: ['repairs', 'lab', labId],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [labId, queryClient]);

  return {
    repairs: query.data || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching, // true גם בזמן background refresh
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook לשליפת כל התיקונים (למנהל) עם Realtime updates
 *
 * @returns תיקונים, מצב טעינה ואינדיקטור רענון רקע
 */

export function useRepairsStats() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['repairs', 'stats'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('get_repair_stats');
      if (error) throw error;
      return data as any;
    },
    staleTime: 1000 * 60 * 5, // 5 דקות
  });

  // Realtime לסטטיסטיקות
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel('repairs-stats-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'repairs' }, 
          () => queryClient.invalidateQueries({ queryKey: ['repairs', 'stats'] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}

// Hook לטבלה (עם דיפדוף)
export function useRepairsTable(
  page: number, 
  pageSize: number, 
  filters: { status: string; labId: string; search: string }
) {
  const queryClient = useQueryClient();
  
  const query = useQuery({
    queryKey: ['repairs', 'list', page, pageSize, filters],
    queryFn: () => fetchRepairsWithPagination(page, pageSize, filters),
    placeholderData: (prev) => prev, // מונע הבהוב במעבר עמוד
  });

  // Realtime לטבלה
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel('repairs-list-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'repairs' }, 
          () => queryClient.invalidateQueries({ queryKey: ['repairs', 'list'] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}