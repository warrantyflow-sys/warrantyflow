import { createClient } from '@/lib/supabase/client';
import type { WarrantyWithRelations } from '@/types';

export type Warranty = WarrantyWithRelations;

export interface WarrantiesResponse {
  warranties: Warranty[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface WarrantyFilters {
  status?: string; // 'active' | 'expired' | 'all'
  search?: string;
}

/**
 * שליפת אחריות למנהל (Server-Side Pagination & Filtering)
 */
export async function fetchWarrantiesWithPagination(
  page: number = 1,
  pageSize: number = 50,
  filters: WarrantyFilters = {}
) {
  const supabase = createClient();
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize - 1;

  let query = supabase
    .from('warranties')
    .select(`
      *,
      device:devices!inner(
        id, imei, imei2,
        device_model:device_models!devices_model_id_fkey(model_name)
      ),
      store:users!warranties_store_id_fkey(full_name, email)
    `, { count: 'exact' });

  // פילטור לפי סטטוס
  if (filters.status === 'active') {
    query = query.eq('is_active', true).gt('expiry_date', new Date().toISOString());
  } else if (filters.status === 'expired') {
    query = query.or(`is_active.eq.false,expiry_date.lte.${new Date().toISOString()}`);
  }

  if (filters.search) {
    const s = filters.search.trim();
    // Escape underscore for PostgREST ilike pattern (underscore is a wildcard in SQL LIKE)
    const escapedSearch = s.replace(/_/g, '\\_');
    const searchPattern = `%${escapedSearch}%`;
    
    // PostgREST doesn't support nested fields (device.imei) in or() filter
    // So we search devices separately and filter by device_id
    const { data: matchingDevices } = await supabase
      .from('devices')
      .select('id')
      .ilike('imei', searchPattern);
    
    const deviceIds = matchingDevices?.map(d => d.id) || [];
    
    // Build or() condition: customer fields OR device_id in matching devices
    if (deviceIds.length > 0) {
      // Combine customer fields search with device_id filter
      // Note: PostgREST or() syntax: field1.op.val1,field2.op.val2,field3.in.(val1,val2,val3)
      query = query.or(`customer_name.ilike.${searchPattern},customer_phone.ilike.${searchPattern},device_id.in.(${deviceIds.join(',')})`);
    } else {
      // Only search in customer fields if no devices match
      query = query.or(`customer_name.ilike.${searchPattern},customer_phone.ilike.${searchPattern}`);
    }
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(startIndex, endIndex);

  if (error) throw new Error(`Failed to fetch warranties: ${error.message}`);

  return {
    data: (data || []) as any as Warranty[],
    count: count || 0
  };
}

/**
 * שליפת אחריות של חנות (נשאר ללא שינוי לשימוש בפורטל החנות)
 */
export async function fetchStoreWarranties(
  storeId: string,
  page: number = 1,
  pageSize: number = 50
): Promise<WarrantiesResponse> {
  const supabase = createClient();
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize - 1;

  const { count } = await supabase
    .from('warranties')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', storeId);

  const { data, error } = await supabase
    .from('warranties')
    .select(`
      *,
      device:devices!inner(id, imei, imei2, device_models(model_name)),
      repairs(id, status, fault_type, lab_id, created_at, completed_at)
    `)
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .range(startIndex, endIndex);

  if (error) throw new Error(`Failed to fetch warranties: ${error.message}`);

  return {
    warranties: (data || []) as any as Warranty[],
    total: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  };
}