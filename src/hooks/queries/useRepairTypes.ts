'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchLabRepairTypes, fetchLabPricingData } from '@/lib/api/repairs';
import type { RepairType } from '@/types';
export interface Lab {
  id: string;
  full_name: string | null;
  email: string;
}

export interface LabRepairPrice {
  id: string;
  lab_id: string;
  repair_type_id: string;
  price: number;
  is_active: boolean;
  lab: Lab;
}

// --- Fetcher Functions ---

async function fetchAllRepairTypes(): Promise<RepairType[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('repair_types')
    .select('*')
    .order('name');

  if (error) {
    throw new Error(`Failed to fetch repair types: ${error.message}`);
  }
  return data || [];
}

async function fetchActiveLabs(): Promise<Lab[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email')
    .eq('role', 'lab')
    .eq('is_active', true)
    .order('full_name');

  if (error) {
    throw new Error(`Failed to fetch labs: ${error.message}`);
  }
  return data || [];
}

async function fetchLabRepairPrices(repairTypeId: string): Promise<LabRepairPrice[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('lab_repair_prices')
    .select(`
      *,
      lab:users!lab_repair_prices_lab_id_fkey(id, full_name, email)
    `)
    .eq('repair_type_id', repairTypeId);

  if (error) {
    throw new Error(`Failed to fetch lab prices: ${error.message}`);
  }
  return (data || []) as any as LabRepairPrice[];
}

// --- Hooks ---

/**
 * Hook לשליפת סוגי תיקונים זמינים למעבדה (עם מחירים)
 */
export function useLabRepairTypes(labId: string | null) {
  const queryClient = useQueryClient();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const query = useQuery({
    queryKey: ['repair-types', 'lab', labId],
    queryFn: () => {
      if (!labId) throw new Error('Lab ID is required');
      return fetchLabRepairTypes(labId);
    },
    enabled: !!labId,
  });

  // Realtime
  useEffect(() => {
    if (!labId) return;
    const supabase = createClient();

    const triggerRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['repair-types', 'lab', labId] });
      }, 1000);
    };

    const channel = supabase
      .channel(`repair-types-lab-all-${labId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'repair_types' },
        triggerRefresh
      )
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'lab_repair_prices',
          filter: `lab_id=eq.${labId}`, 
        },
        triggerRefresh
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [labId, queryClient]);

  return {
    repairTypes: query.data || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook לכל סוגי התיקונים (עבור המנהל)
 */
export function useAllRepairTypes() {
  const queryClient = useQueryClient();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const query = useQuery({
    queryKey: ['repair-types', 'all'],
    queryFn: fetchAllRepairTypes,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const supabase = createClient();

    const triggerRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['repair-types', 'all'] });
      }, 1000);
    };

    const channel = supabase
      .channel('repair-types-all')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'repair_types' },
        triggerRefresh
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    repairTypes: query.data || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook למעבדות פעילות (עבור המנהל - מסך ניהול סוגי תיקונים)
 */
export function useActiveLabs() {
  const queryClient = useQueryClient();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const query = useQuery({
    queryKey: ['labs', 'active'],
    queryFn: fetchActiveLabs,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const supabase = createClient();

    const triggerRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['labs', 'active'] });
      }, 1000);
    };

    const channel = supabase
      .channel('labs-active')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
          filter: 'role=eq.lab',
        },
        triggerRefresh
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    labs: query.data || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook למחירי מעבדות לסוג תיקון מסוים (עבור דיאלוג מחירים של המנהל)
 */
export function useLabRepairPrices(repairTypeId: string | null) {
  const queryClient = useQueryClient();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const query = useQuery({
    queryKey: ['lab-repair-prices', repairTypeId],
    queryFn: () => {
      if (!repairTypeId) throw new Error('Repair type ID is required');
      return fetchLabRepairPrices(repairTypeId);
    },
    enabled: !!repairTypeId,
  });

  useEffect(() => {
    if (!repairTypeId) return;
    const supabase = createClient();

    const triggerRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['lab-repair-prices', repairTypeId] });
      }, 1000);
    };

    const channel = supabase
      .channel(`lab-repair-prices-${repairTypeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lab_repair_prices',
          filter: `repair_type_id=eq.${repairTypeId}`,
        },
        triggerRefresh
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [repairTypeId, queryClient]);

  return {
    labPrices: query.data || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// 1. הוסף לייבואים למעלה:
 // הוספנו את fetchLabPricingData

/**
 * Hook לניהול מחירון מעבדה (Active & Inactive)
 */
export function useLabPricingData(labId: string | null) {
  const queryClient = useQueryClient();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const query = useQuery({
    queryKey: ['lab-pricing-management', labId],
    queryFn: () => {
      if (!labId) throw new Error('Lab ID is required');
      return fetchLabPricingData(labId);
    },
    enabled: !!labId,
  });

  // Realtime Subscription
  useEffect(() => {
    if (!labId) return;
    const supabase = createClient();

    const triggerRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['lab-pricing-management', labId] });
      }, 1000);
    };

    const channel = supabase
      .channel(`lab-pricing-management-${labId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lab_repair_prices', filter: `lab_id=eq.${labId}` },
        triggerRefresh
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [labId, queryClient]);

  return {
    pricingData: query.data || [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}