'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface AdminDashboardStats {
  total: number;
  new: number;
  active: number;
  expired: number;
  replaced: number;
  inRepair: number;
}

async function fetchAdminDashboardStats(): Promise<AdminDashboardStats> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('get_dashboard_counts');

  if (error) {
    console.error('Error fetching dashboard stats:', error);
    throw error;
  }

  // המרה לטיפוס המתאים (Supabase מחזיר JSON)
  return data as unknown as AdminDashboardStats;
}

export function useAdminDashboardStats() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['admin', 'dashboard', 'stats'],
    queryFn: fetchAdminDashboardStats,
    staleTime: 1000 * 60 * 5, // אפשר להעלות ל-5 דקות כי יש Realtime
  });

  // Realtime Subscription (נשאר אותו דבר - מרענן את הנתונים בשינוי)
  useEffect(() => {
    const supabase = createClient();
    
    const channel = supabase.channel('admin-dashboard-stats-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, 
          () => queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard', 'stats'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'repairs' }, 
          () => queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard', 'stats'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warranties' }, 
          () => queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard', 'stats'] }))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    stats: query.data || { total: 0, new: 0, active: 0, expired: 0, replaced: 0, inRepair: 0 },
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
  };
}