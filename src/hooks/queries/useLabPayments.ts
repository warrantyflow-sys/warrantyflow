'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface LabRepair {
  id: string;
  cost: number;
  completed_at: string;
  created_at?: string;
  device?: {
    imei: string;
    device_models?: {
      model_name: string;
    } | null;
  } | null;
  repair_type?: {
    name: string;
  } | null;
  lab_id?: string;
}

export interface LabPayment {
  id: string;
  lab_id: string;
  amount: number;
  payment_date: string;
  reference: string | null;
  notes: string | null;
}

export interface LabBalance {
  lab_id: string;
  lab_name: string;
  lab_email: string;
  total_earned: number;
  total_paid: number;
  balance: number;
  repairs_count: number;
  payments_count: number;
}

// --- Fetcher Functions ---

async function fetchLabCompletedRepairs(labId: string): Promise<LabRepair[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('repairs')
    .select(`
      id,
      cost,
      completed_at,
      device:devices(imei, device_models(model_name)),
      repair_type:repair_types(name)
    `)
    .eq('lab_id', labId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch completed repairs: ${error.message}`);
  return (data || []) as any as LabRepair[];
}

async function fetchLabPayments(labId: string): Promise<LabPayment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('lab_id', labId)
    .order('payment_date', { ascending: false });

  if (error) throw new Error(`Failed to fetch payments: ${error.message}`);
  return (data || []) as LabPayment[];
}

// 🔧 FIX: Use the view_lab_balances VIEW instead of manual calculations
async function fetchAllLabsBalances(): Promise<LabBalance[]> {
  const supabase = createClient();

  const { data, error } = await (supabase as any)
    .from('view_lab_balances')
    .select('*')
    .order('balance', { ascending: false });

  if (error) throw new Error(`Failed to fetch lab balances: ${error.message}`);
  
  return (data || []) as LabBalance[];
}

// --- Hooks ---

export function useLabCompletedRepairs(labId: string | null) {
  const queryClient = useQueryClient();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const query = useQuery({
    queryKey: ['lab', 'completed-repairs', labId],
    queryFn: () => {
      if (!labId) throw new Error('Lab ID is required');
      return fetchLabCompletedRepairs(labId);
    },
    enabled: !!labId,
  });

  useEffect(() => {
    if (!labId) return;
    const supabase = createClient();

    const triggerRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['lab', 'completed-repairs', labId] });
      }, 1000);
    };

    const channel = supabase
      .channel(`lab-completed-repairs-${labId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'repairs', filter: `lab_id=eq.${labId}` }, triggerRefresh)
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

export function useLabPayments(labId: string | null) {
  const queryClient = useQueryClient();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const query = useQuery({
    queryKey: ['lab', 'payments', labId],
    queryFn: () => {
      if (!labId) throw new Error('Lab ID is required');
      return fetchLabPayments(labId);
    },
    enabled: !!labId,
  });

  useEffect(() => {
    if (!labId) return;
    const supabase = createClient();

    const triggerRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['lab', 'payments', labId] });
      }, 1000);
    };

    const channel = supabase
      .channel(`lab-payments-${labId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `lab_id=eq.${labId}` }, triggerRefresh)
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [labId, queryClient]);

  return {
    payments: query.data || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useAllLabsBalances() {
  const queryClient = useQueryClient();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const query = useQuery({
    queryKey: ['labs', 'balances', 'all'],
    queryFn: fetchAllLabsBalances,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true, // 🔧 Refetch when window regains focus
  });

  useEffect(() => {
    const supabase = createClient();

    const triggerRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['labs', 'balances', 'all'] });
      }, 1000); // Debounce for 1 second
    };

    // 🔧 Listen to both repairs and payments tables
    const channel = supabase
      .channel('labs-balances-all')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'repairs',
        filter: 'status=eq.completed' // Only listen to completed repairs
      }, (payload) => {
        console.log('Repair change detected:', payload);
        triggerRefresh();
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'payments' 
      }, (payload) => {
        console.log('Payment change detected:', payload);
        triggerRefresh();
      })
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    labBalances: query.data || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}