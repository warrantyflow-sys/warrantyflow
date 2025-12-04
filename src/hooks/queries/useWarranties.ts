'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchStoreWarranties, fetchWarrantiesWithPagination } from '@/lib/api/warranties';

// --- Hooks למנהל ---

export function useWarrantiesStats() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['warranties', 'stats'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('get_warranty_stats');
      if (error) throw error;
      return data as any;
    },
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel('warranties-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warranties' }, 
          () => queryClient.invalidateQueries({ queryKey: ['warranties', 'stats'] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}

export function useWarrantiesTable(page: number, pageSize: number, filters: { status: string; search: string }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['warranties', 'list', page, pageSize, filters],
    queryFn: () => fetchWarrantiesWithPagination(page, pageSize, filters),
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel('warranties-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warranties' }, 
          () => queryClient.invalidateQueries({ queryKey: ['warranties', 'list'] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}

// --- Hooks לחנות ---

export function useStoreWarranties(storeId: string | null, page: number = 1, pageSize: number = 50) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['warranties', 'store', storeId, page, pageSize],
    queryFn: () => {
      if (!storeId) throw new Error('Store ID is required');
      return fetchStoreWarranties(storeId, page, pageSize);
    },
    enabled: !!storeId,
  });
  
  useEffect(() => {
    const supabase = createClient();

    const handleChange = () => {
      queryClient.invalidateQueries({
        queryKey: ['warranties', 'all'],
      });
    };

    // Single channel monitoring all relevant tables
    const channel = supabase
      .channel('warranties-all-combined')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'warranties' },
        handleChange
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'devices' },
        handleChange
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    warranties: query.data?.warranties || [],
    total: query.data?.total || 0,
    page: query.data?.page || 1,
    pageSize: query.data?.pageSize || pageSize,
    totalPages: query.data?.totalPages || 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
