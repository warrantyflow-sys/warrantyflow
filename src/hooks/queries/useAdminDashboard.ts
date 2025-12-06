'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
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

  return data as unknown as AdminDashboardStats;
}

export function useAdminDashboardStats() {
  const queryClient = useQueryClient();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const query = useQuery({
    queryKey: ['admin', 'dashboard', 'stats'],
    queryFn: fetchAdminDashboardStats,
    staleTime: 1000 * 60 * 5, 
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const supabase = createClient();

    // פונקציית רענון בטוחה
    const triggerRefresh = () => {
      // אם כבר יש רענון שממתין, נבטל אותו (כדי לאחד עדכונים רצופים)
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      
      // הורדתי את ההשהיה ל-1000ms (שניה אחת) כדי שהעדכון ירגיש יותר מיידי למשתמש,
      // אך עדיין יגן מפני הצפה במקרה של ייבוא קובץ גדול
      debounceRef.current = setTimeout(() => {
        console.log('♻️ Admin Dashboard: Detecting DB changes -> Refreshing stats...');
        queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard', 'stats'] });
      }, 1000);
    };

    const channel = supabase.channel('admin-stats-monitor')
      // האזנה פשוטה ובטוחה - כל שינוי בטבלאות הליבה יגרור רענון של הדשבורד
      // הסרנו את בדיקות ה-IF המסובכות שגרמו לפספוסים
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, triggerRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'repairs' }, triggerRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warranties' }, triggerRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'replacement_requests' }, triggerRefresh)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [queryClient]);

  return {
    stats: query.data || { total: 0, new: 0, active: 0, expired: 0, replaced: 0, inRepair: 0 },
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
  };
}