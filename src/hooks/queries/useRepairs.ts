'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchRepairsWithPagination, fetchLabRepairsWithPagination } from '@/lib/api/repairs';

/**
 * Hook לשליפת תיקונים של מעבדה עם Realtime updates + PAGINATION
 * משמש את עמוד התיקונים של המעבדה
 *
 * @param labId
 * @param page - מספר עמוד (1-based)
 * @param pageSize - כמה רשומות בעמוד
 */
export function useLabRepairs(
  labId: string | null,
  page: number = 1,
  pageSize: number = 50
) {
  const queryClient = useQueryClient();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const query = useQuery({
    queryKey: ['repairs', 'lab', labId, page, pageSize],
    queryFn: async () => {
      if (!labId) throw new Error('Lab ID is required');
      
      // שימוש בפונקציה החדשה עם pagination
      const result = await fetchLabRepairsWithPagination(labId, page, pageSize);

      return {
        data: result.data,
        count: result.count,
        page,
        pageSize,
        totalPages: Math.ceil(result.count / pageSize),
      };
    },
    enabled: !!labId,
    placeholderData: (prev) => prev, // שומר נתונים קודמים בזמן טעינה
  });

  // Supabase Realtime subscription
  useEffect(() => {
    if (!labId) return;

    const supabase = createClient();

    const triggerRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        console.log('♻️ Refreshing lab repairs list...');
        queryClient.invalidateQueries({ queryKey: ['repairs', 'lab', labId] });
      }, 1000);
    };

    // Subscribe to repairs changes for this lab ONLY
    const channel = supabase
      .channel(`repairs-lab-${labId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'repairs',
          filter: `lab_id=eq.${labId}`,
        },
        triggerRefresh
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [labId, queryClient]);

  return {
    repairs: query.data?.data || [],
    count: query.data?.count || 0,
    page: query.data?.page || page,
    pageSize: query.data?.pageSize || pageSize,
    totalPages: query.data?.totalPages || 1,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook לשליפת סטטיסטיקות תיקונים (למנהל) עם Realtime updates
 */
export function useRepairsStats() {
  const queryClient = useQueryClient();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const query = useQuery({
    queryKey: ['repairs', 'stats'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('get_repair_stats');
      if (error) throw error;
      return data as any;
    },
    staleTime: 1000 * 60 * 5,
  });

  // Realtime לסטטיסטיקות
  useEffect(() => {
    const supabase = createClient();

    const triggerRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['repairs', 'stats'] });
      }, 1000);
    };

    const channel = supabase.channel('repairs-stats-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'repairs' }, triggerRefresh)
      .subscribe();

    return () => { 
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel); 
    };
  }, [queryClient]);

  return query;
}

/**
 * Hook לטבלה הראשית של המנהל (עם דיפדוף)
 */
export function useRepairsTable(
  page: number, 
  pageSize: number, 
  filters: { status: string; labId: string; search: string; repairTypeId?: string; modelId?: string; }
) {
  const queryClient = useQueryClient();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  
  const query = useQuery({
    queryKey: ['repairs', 'list', page, pageSize, filters],
    queryFn: () => fetchRepairsWithPagination(page, pageSize, filters),
    placeholderData: (prev) => prev,
    staleTime: 1000 * 30, // 30 שניות
  });

  useEffect(() => {
    const supabase = createClient();

    const triggerRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['repairs', 'list'] });
      }, 1000);
    };

    const channel = supabase.channel('repairs-list-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'repairs' }, triggerRefresh)
      .subscribe();

    return () => { 
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel); 
    };
  }, [queryClient]);

  return query;
}