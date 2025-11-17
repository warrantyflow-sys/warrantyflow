import { createClient } from '@/lib/supabase/client';

/**
 * API Functions for Warranties
 *
 * שכבת API לניהול אחריות - שליפה עם pagination
 */

export interface Warranty {
  id: string;
  customer_name: string;
  customer_phone: string;
  activation_date: string;
  expiry_date: string;
  is_active: boolean;
  created_at?: string;
  store_id?: string;
  device_id?: string;
  device?: {
    id: string;
    imei: string;
    imei2?: string | null;
    device_models?: {
      model_name: string;
    } | null;
  } | null;
  repairs?: Array<{
    id: string;
    status: string;
    fault_type?: string;
    lab_id?: string | null;
    created_at?: string;
    completed_at?: string | null;
  }>;
}

export interface WarrantiesResponse {
  warranties: Warranty[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * שליפת כל האחריות (admin)
 */
export async function fetchAllWarranties(): Promise<Warranty[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('warranties')
    .select(`
      *,
      device:devices(
        imei,
        device_model:device_models!devices_model_id_fkey(model_name)
      ),
      store:users!warranties_store_id_fkey(full_name, email)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch warranties: ${error.message}`);
  }

  return (data || []) as any as Warranty[];
}

/**
 * שליפת אחריות של חנות עם server-side pagination
 */
export async function fetchStoreWarranties(
  storeId: string,
  page: number = 1,
  pageSize: number = 50
): Promise<WarrantiesResponse> {
  const supabase = createClient();

  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize - 1;

  // Get total count
  const { count } = await supabase
    .from('warranties')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', storeId);

  // Get paginated data
  const { data, error } = await supabase
    .from('warranties')
    .select(`
      *,
      device:devices!inner(
        id,
        imei,
        imei2,
        device_models(model_name)
      ),
      repairs(
        id,
        status,
        fault_type,
        lab_id,
        created_at,
        completed_at
      )
    `)
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .range(startIndex, endIndex);

  if (error) {
    throw new Error(`Failed to fetch warranties: ${error.message}`);
  }

  const totalPages = Math.ceil((count || 0) / pageSize);

  return {
    warranties: (data || []) as any as Warranty[],
    total: count || 0,
    page,
    pageSize,
    totalPages,
  };
}
