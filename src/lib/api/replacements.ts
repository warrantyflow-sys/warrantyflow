import { createClient } from '@/lib/supabase/client';
import type { ReplacementRequestWithRelations } from '@/types';
import type { Database } from '@/lib/supabase/database.types';

export type ReplacementRequest = ReplacementRequestWithRelations;

type RequestStatus = Database["public"]["Enums"]["request_status"];

export interface ReplacementFilters {
  status?: RequestStatus | 'all';
  storeId?: string;
  search?: string;
}

/**
 * שליפת בקשות החלפה עם פילטור ודיפדוף (Server-Side)
 */
export async function fetchReplacementsWithPagination(
  page: number = 1,
  pageSize: number = 50,
  filters: ReplacementFilters = {}
) {
  const supabase = createClient();
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize - 1;

  // בדיקה האם יש חיפוש פעיל
  const hasSearch = filters.search && filters.search.trim().length > 0;

  const deviceJoinType = hasSearch ? '!inner' : '';

  let query = supabase
    .from('replacement_requests')
    .select(`
      *,
      device:devices${deviceJoinType}(
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
    `, { count: 'exact' });

  // פילטור לפי סטטוס
  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status as RequestStatus);
  }

  // פילטור לפי חנות (אם המבקש הוא חנות ספציפית)
  if (filters.storeId) {
    query = query.eq('requester_id', filters.storeId);
  }

  // חיפוש (IMEI או שם לקוח)
  if (hasSearch) {
    const s = filters.search;
    query = query.or(`customer_name.ilike.%${s}%,device.imei.ilike.%${s}%`);
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(startIndex, endIndex);

  if (error) {
    console.error('Fetch Error:', error);
    throw new Error(`Failed to fetch replacement requests: ${error.message}`);
  }

  return {
    data: (data || []) as any as ReplacementRequest[],
    count: count || 0
  };
}