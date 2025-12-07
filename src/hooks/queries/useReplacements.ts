'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchReplacementsWithPagination, type ReplacementFilters } from '@/lib/api/replacements';

// --- Hook לסטטיסטיקות ---
export function useReplacementsStats() {
  const queryClient = useQueryClient();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const query = useQuery({
    queryKey: ['replacements', 'stats'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('get_replacement_stats');
      if (error) throw error;
      return data as any;
    },
    staleTime: 1000 * 60 * 5,
  });

  // Realtime Subscription
  useEffect(() => {
    const supabase = createClient();

    const triggerRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['replacements', 'stats'] });
      }, 1000);
    };

    const channel = supabase.channel('replacements-stats-monitor')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'replacement_requests' },
        triggerRefresh
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

// --- Hook לטבלה (Pagination) ---
export function useReplacementsTable(
  page: number, 
  pageSize: number, 
  filters: ReplacementFilters
) {
  const queryClient = useQueryClient();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const query = useQuery({
    queryKey: ['replacements', 'list', page, pageSize, filters],
    queryFn: () => fetchReplacementsWithPagination(page, pageSize, filters),
    placeholderData: (prev) => prev,
    staleTime: 1000 * 30,
  });

  // Realtime Subscription
  useEffect(() => {
    const supabase = createClient();
    
    const triggerRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['replacements'] });
      }, 1000);
    };
    
    const channel = supabase.channel('replacements-global-tracker')
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'replacement_requests' }, 
        triggerRefresh
      )
      .subscribe();

    return () => { 
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel); 
    };
  }, [queryClient]);

  return query;
}

// --- Hook לחנות ---
async function fetchStoreReplacementRequests(storeId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('replacement_requests')
    .select(`
      *,
      device:devices(
        *,
        device_model:device_models(model_name),
        warranty:warranties(*)
      ),
      repair:repairs(
        fault_type,
        fault_description,
        lab:users!repairs_lab_id_fkey(full_name, email)
      ),
      requester:users!replacement_requests_requester_id_fkey(full_name, role, email),
      resolver:users!replacement_requests_resolved_by_fkey(full_name)
    `)
    .eq('requester_id', storeId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch replacement requests: ${error.message}`);
  }

  return data || [];
}

export function useStoreReplacementRequests(storeId: string | null) {
  const queryClient = useQueryClient();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const query = useQuery({
    queryKey: ['replacement-requests', 'store', storeId],
    queryFn: () => {
      if (!storeId) throw new Error('Store ID is required');
      return fetchStoreReplacementRequests(storeId);
    },
    enabled: !!storeId,
  });

  useEffect(() => {
    if (!storeId) return;
    const supabase = createClient();

    const triggerRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({
          queryKey: ['replacement-requests', 'store', storeId],
        });
      }, 1000);
    };

    const channel = supabase
      .channel(`replacement-requests-store-${storeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'replacement_requests',
          filter: `requester_id=eq.${storeId}`,
        },
        triggerRefresh
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [storeId, queryClient]);

  return {
    requests: query.data || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useAllReplacementRequests() {
    const { data, isLoading, isFetching, refetch } = useReplacementsTable(1, 1000, { status: 'all', search: '' });
    return {
        requests: data?.data || [],
        isLoading,
        isFetching,
        refetch
    };
}