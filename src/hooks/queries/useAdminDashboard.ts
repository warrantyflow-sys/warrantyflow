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

  // שימוש ב-Promise.all לשליפה מקבילית
  const [devicesResult, repairsResult] = await Promise.all([
    supabase.from('devices_with_status').select('warranty_status'),
    supabase
      .from('repairs')
      .select('id', { count: 'exact', head: true }) // count only, faster
      .in('status', ['received', 'in_progress']),
  ]);

  if (devicesResult.error) throw devicesResult.error;

  const devices = devicesResult.data || [];
  
  return {
    total: devices.length,
    new: devices.filter(d => !d.warranty_status || d.warranty_status === 'new').length,
    active: devices.filter(d => d.warranty_status === 'active').length,
    expired: devices.filter(d => d.warranty_status === 'expired').length,
    replaced: devices.filter(d => d.warranty_status === 'replaced').length,
    inRepair: repairsResult.count || 0,
  };
}

export function useAdminDashboardStats() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['admin', 'dashboard', 'stats'],
    queryFn: fetchAdminDashboardStats,
    staleTime: 1000 * 60, // נחשב טרי לדקה
  });

  // Realtime Subscription
  useEffect(() => {
    const supabase = createClient();
    
    const channel = supabase.channel('admin-dashboard-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, 
          () => queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard', 'stats'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'repairs' }, 
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
  };
}