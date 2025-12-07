'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface StoreDashboardStats {
  activeWarranties: number;
  pendingReplacements: number;
  monthlyActivations: number;
  totalDevices: number;
}

/**
 * שליפת סטטיסטיקות דשבורד חנות
 */
async function fetchStoreDashboardStats(storeId: string): Promise<StoreDashboardStats> {
  const supabase = createClient();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [activeRes, pendingRes, monthlyRes, devicesRes] = await Promise.all([
    supabase
      .from('warranties')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .eq('is_active', true)
      .gte('expiry_date', new Date().toISOString()),

    supabase
      .from('replacement_requests')
      .select('*', { count: 'exact', head: true })
      .eq('requester_id', storeId)
      .eq('status', 'pending'),

    supabase
      .from('warranties')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .gte('activation_date', startOfMonth.toISOString()),

    supabase.rpc('get_store_device_count')
  ]);

  return {
    activeWarranties: activeRes.count || 0,
    pendingReplacements: pendingRes.count || 0,
    monthlyActivations: monthlyRes.count || 0,
    totalDevices: (devicesRes.data as number) || 0,
  };
}

/**
 * Hook לסטטיסטיקות דשבורד חנות
 */
export function useStoreDashboardStats(storeId: string | null) {
  const queryClient = useQueryClient();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const query = useQuery({
    queryKey: ['store', 'dashboard', 'stats', storeId],
    queryFn: () => {
      if (!storeId) throw new Error('Store ID is required');
      return fetchStoreDashboardStats(storeId);
    },
    enabled: !!storeId,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (!storeId) return;
    const supabase = createClient();

    const triggerRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['store', 'dashboard', 'stats', storeId] });
      }, 1000);
    };

    const channel = supabase
      .channel(`store-dashboard-stats-${storeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'warranties', filter: `store_id=eq.${storeId}` },
        triggerRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'replacement_requests', filter: `requester_id=eq.${storeId}` },
        triggerRefresh
      )
      .on(
         'postgres_changes',
         { event: 'INSERT', schema: 'public', table: 'devices' },
         triggerRefresh
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [storeId, queryClient]);

  return {
    stats: query.data || {
      activeWarranties: 0,
      pendingReplacements: 0,
      monthlyActivations: 0,
      totalDevices: 0,
    },
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}