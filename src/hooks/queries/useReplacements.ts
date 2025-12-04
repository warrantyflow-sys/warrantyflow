'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchReplacementsWithPagination, type ReplacementFilters } from '@/lib/api/replacements';

// --- Hook לסטטיסטיקות (RPC מהיר) ---
export function useReplacementsStats() {
  const queryClient = useQueryClient();
  
  const query = useQuery({
    queryKey: ['replacements', 'stats'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('get_replacement_stats');
      if (error) throw error;
      return data as any;
    },
    staleTime: 1000 * 60 * 5, // 5 דקות
  });

  // Realtime Subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel('replacements-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'replacement_requests' }, 
          () => queryClient.invalidateQueries({ queryKey: ['replacements', 'stats'] }))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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

  const query = useQuery({
    queryKey: ['replacements', 'list', page, pageSize, filters],
    queryFn: () => fetchReplacementsWithPagination(page, pageSize, filters),
    placeholderData: (prev) => prev, // שומר על המידע הקודם בזמן טעינת עמוד חדש למניעת הבהוב
  });

  // Realtime Subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel('replacements-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'replacement_requests' }, 
          () => queryClient.invalidateQueries({ queryKey: ['replacements', 'list'] }))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}

// --- Hook ישן (תאימות לאחור / שימוש בפורטל חנות) ---
// במידה ופורטל החנות עדיין משתמש בגרסה הישנה, אפשר להשאיר זאת כך או לשדרג גם אותו
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

  const query = useQuery({
    queryKey: ['replacement-requests', 'store', storeId],
    queryFn: () => {
      if (!storeId) throw new Error('Store ID is required');
      return fetchStoreReplacementRequests(storeId);
    },
    enabled: !!storeId,
    refetchInterval: 60 * 1000,
  });

  useEffect(() => {
    if (!storeId) return;
    const supabase = createClient();
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
        () => {
          queryClient.invalidateQueries({
            queryKey: ['replacement-requests', 'store', storeId],
          });
        }
      )
      .subscribe();

    return () => {
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

// Hook ישן (useAllReplacementRequests) - נמחק או הושאר כ-Alias לשימוש במקומות אחרים אם טרם שונו
export function useAllReplacementRequests() {
    // זה רק wrapper זמני למקרה ששכחנו לעדכן קובץ כלשהו
    const { data, isLoading, isFetching, refetch } = useReplacementsTable(1, 1000, { status: 'all', search: '' });
    return {
        requests: data?.data || [],
        isLoading,
        isFetching,
        refetch
    };
}