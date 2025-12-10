'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

// --- Interfaces ---

export interface LabDashboardStats {
  pendingRepairs: number;
  inProgressRepairs: number;
  completedToday: number;
  monthlyCompleted: number;
  monthlyRevenue: number;
  averageRepairTime: number;
  topFaultType: string;
  completionRate: number;
}

export interface LabRepairItem {
  id: string;
  status: string;
  fault_type?: string;
  created_at?: string;
  device?: {
    imei: string;
    device_models?: {
      model_name: string;
    } | null;
  } | null;
  warranty?: {
    customer_name: string;
    customer_phone: string;
  } | null;
}

export interface LabFinancialSummary {
  lab_id: string;
  lab_name: string;
  lab_email: string;
  total_earned: number;
  total_paid: number;
  current_balance: number; // SQL column alias is current_balance
  repairs_count: number;
  payments_count: number;
}

// --- Fetcher Functions ---

async function fetchLabDashboardStats(): Promise<LabDashboardStats> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_lab_dashboard_stats');

  if (error) {
    throw new Error(`Failed to fetch lab stats: ${error.message}`);
  }

  return (data as unknown as LabDashboardStats) || {
    pendingRepairs: 0,
    inProgressRepairs: 0,
    completedToday: 0,
    monthlyCompleted: 0,
    monthlyRevenue: 0,
    averageRepairTime: 0,
    topFaultType: '',
    completionRate: 0,
  };
}

async function fetchLabRecentRepairs(labId: string): Promise<LabRepairItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('repairs')
    .select(`
      *,
      device:devices(imei, device_models(model_name)),
      warranty:warranties(customer_name, customer_phone)
    `)
    .eq('lab_id', labId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) throw new Error(`Failed to fetch recent repairs: ${error.message}`);
  return (data || []) as any as LabRepairItem[];
}

async function fetchLabUrgentRepairs(labId: string): Promise<LabRepairItem[]> {
  const supabase = createClient();
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const { data, error } = await supabase
    .from('repairs')
    .select(`
      *,
      device:devices(imei, device_models(model_name)),
      warranty:warranties(customer_name, customer_phone)
    `)
    .eq('lab_id', labId)
    .in('status', ['received', 'in_progress'])
    .lt('created_at', twoDaysAgo.toISOString())
    .order('created_at', { ascending: true })
    .limit(5);

  if (error) throw new Error(`Failed to fetch urgent repairs: ${error.message}`);
  return (data || []) as any as LabRepairItem[];
}

async function fetchLabFinancialSummary(): Promise<LabFinancialSummary[]> {
  const supabase = createClient();
  // Calls the new RPC function replacing the view
  const { data, error } = await supabase.rpc('get_lab_financial_summary');

  if (error) {
    throw new Error(`Failed to fetch financial summary: ${error.message}`);
  }

  return (data as unknown as LabFinancialSummary[]) || [];
}

// --- Hooks ---

export function useLabDashboardStats(labId: string | null) {
  const queryClient = useQueryClient();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const query = useQuery({
    queryKey: ['lab', 'dashboard', 'stats', labId],
    queryFn: fetchLabDashboardStats,
    enabled: !!labId,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (!labId) return;
    const supabase = createClient();

    const triggerRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['lab', 'dashboard', 'stats', labId] });
      }, 1000);
    };

    const channel = supabase
      .channel(`lab-stats-${labId}`)
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
  }, [queryClient, labId]);

  return {
    stats: query.data || {
      pendingRepairs: 0,
      inProgressRepairs: 0,
      completedToday: 0,
      monthlyCompleted: 0,
      monthlyRevenue: 0,
      averageRepairTime: 0,
      topFaultType: '',
      completionRate: 0,
    },
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useLabRecentRepairs(labId: string | null) {
  const queryClient = useQueryClient();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const query = useQuery({
    queryKey: ['lab', 'recent-repairs', labId],
    queryFn: () => {
      if (!labId) throw new Error('Lab ID is required');
      return fetchLabRecentRepairs(labId);
    },
    enabled: !!labId,
  });

  useEffect(() => {
    if (!labId) return;
    const supabase = createClient();

    const triggerRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['lab', 'recent-repairs', labId] });
      }, 1000);
    };

    const channel = supabase
      .channel(`lab-recent-repairs-${labId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'repairs', filter: `lab_id=eq.${labId}` },
        triggerRefresh
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [labId, queryClient]);

  return {
    repairs: query.data || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useLabUrgentRepairs(labId: string | null) {
  const queryClient = useQueryClient();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const query = useQuery({
    queryKey: ['lab', 'urgent-repairs', labId],
    queryFn: () => {
      if (!labId) throw new Error('Lab ID is required');
      return fetchLabUrgentRepairs(labId);
    },
    enabled: !!labId,
  });

  useEffect(() => {
    if (!labId) return;
    const supabase = createClient();

    const triggerRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['lab', 'urgent-repairs', labId] });
      }, 1000);
    };

    const channel = supabase
      .channel(`lab-urgent-repairs-${labId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'repairs', filter: `lab_id=eq.${labId}` },
        triggerRefresh
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [labId, queryClient]);

  return {
    repairs: query.data || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// --- New Hook for Financial Summary ---

export function useLabFinancialSummary() {
  const queryClient = useQueryClient();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const query = useQuery({
    queryKey: ['lab', 'financial-summary'],
    queryFn: fetchLabFinancialSummary,
  });

  useEffect(() => {
    const supabase = createClient();

    const triggerRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['lab', 'financial-summary'] });
      }, 1000);
    };

    // Listen to changes in both 'repairs' (earnings) and 'payments' (deductions)
    const repairsChannel = supabase
      .channel('lab-finance-repairs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'repairs' }, 
        triggerRefresh
      )
      .subscribe();

    const paymentsChannel = supabase
      .channel('lab-finance-payments')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments' },
        triggerRefresh
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(repairsChannel);
      supabase.removeChannel(paymentsChannel);
    };
  }, [queryClient]);

  return {
    data: query.data || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}