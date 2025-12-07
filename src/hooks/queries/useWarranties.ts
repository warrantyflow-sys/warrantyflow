'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchStoreWarranties, fetchWarrantiesWithPagination } from '@/lib/api/warranties';

// --- Hooks למנהל (Admin) ---

export function useWarrantiesStats() {
  const queryClient = useQueryClient();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

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
    
    const triggerRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['warranties', 'stats'] });
      }, 1000);
    };

    const channel = supabase.channel('warranties-stats-monitor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warranties' }, triggerRefresh)
      .subscribe();

    return () => { 
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel); 
    };
  }, [queryClient]);

  return query;
}

export function useWarrantiesTable(page: number, pageSize: number, filters: { status: string; search: string }) {
  const queryClient = useQueryClient();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const query = useQuery({
    queryKey: ['warranties', 'list', page, pageSize, filters],
    queryFn: () => fetchWarrantiesWithPagination(page, pageSize, filters),
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    const supabase = createClient();

    const triggerRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['warranties', 'list'] });
      }, 1000);
    };

    const channel = supabase.channel('warranties-list-monitor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warranties' }, triggerRefresh)
      .subscribe();

    return () => { 
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel); 
    };
  }, [queryClient]);

  return query;
}

// --- Hook לחנות (Store) ---

export function useStoreWarranties(storeId: string | null, page: number = 1, pageSize: number = 50) {
  const queryClient = useQueryClient();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const query = useQuery({
    queryKey: ['warranties', 'store', storeId, page, pageSize],
    queryFn: () => {
      if (!storeId) throw new Error('Store ID is required');
      return fetchStoreWarranties(storeId, page, pageSize);
    },
    enabled: !!storeId,
    placeholderData: (prev) => prev, 
  });
  
  useEffect(() => {
    if (!storeId) return;
    const supabase = createClient();

    const triggerRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ 
          predicate: (query) => 
            query.queryKey[0] === 'warranties' && 
            query.queryKey[1] === 'store' && 
            query.queryKey[2] === storeId
        });
        
        queryClient.invalidateQueries({ queryKey: ['store', 'dashboard', 'stats'] });
      }, 1000);
    };

    const channel = supabase
      .channel(`store-warranties-${storeId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'warranties',
          filter: `store_id=eq.${storeId}`
        },
        triggerRefresh
      )

      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'devices' },
        triggerRefresh
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [queryClient, storeId]);

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