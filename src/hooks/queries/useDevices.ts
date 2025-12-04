'use client';

import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface DevicesFilter {
  page: number;
  pageSize: number;
  search?: string;
  model?: string;
  warrantyStatus?: string;
}

interface DevicesResponse {
  data: any[];
  count: number;
}

async function fetchDevices(filters: DevicesFilter): Promise<DevicesResponse> {
  const supabase = createClient();
  const { page, pageSize, search, model, warrantyStatus } = filters;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // שימוש ב-View החדש והיעיל
  let query = (supabase as any)
    .from('devices_rich_view')
    .select('*', { count: 'exact' });

  // 1. סינון לפי סטטוס (עכשיו זה עובד כי העמודה קיימת ב-View)
  if (warrantyStatus && warrantyStatus !== 'all') {
    query = query.eq('warranty_status', warrantyStatus);
  }

  // 2. סינון לפי דגם
  if (model && model !== 'all') {
    // ה-View מכיל את שם הדגם, אז אפשר לסנן לפיו ישירות
    query = query.eq('model_name', model);
  }

  // 3. חיפוש חכם (כולל שם לקוח!)
  if (search) {
    query = query.or(`imei.ilike.%${search}%,imei2.ilike.%${search}%,customer_name.ilike.%${search}%`);
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(`Failed to fetch devices: ${error.message}`);
  }

  // המרת המידע השטוח למבנה המקונן שה-UI מצפה לו
  const mappedData = (data || []).map((row: any) => ({
    ...row,
    // שחזור מבנה device_models
    device_models: {
      id: row.model_id,
      model_name: row.model_name,
      manufacturer: row.manufacturer
    },
    // שחזור מבנה warranties (מערך עם איבר אחד)
    warranties: row.warranty_id ? [{
      id: row.warranty_id,
      customer_name: row.customer_name,
      customer_phone: row.customer_phone,
      activation_date: row.activation_date,
      expiry_date: row.expiry_date,
      is_active: row.warranty_is_active,
      store: row.store_id ? {
        id: row.store_id,
        full_name: row.store_name,
        email: row.store_email
      } : null
    }] : []
  }));

  return { data: mappedData, count: count || 0 };
}

export function useDevices(filters: DevicesFilter) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['devices', filters.page, filters.pageSize, filters.search, filters.model, filters.warrantyStatus],
    queryFn: () => fetchDevices(filters),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60,
  });

  useEffect(() => {
    const supabase = createClient();
    // האזנה לשינויים בכל הטבלאות הרלוונטיות
    const channel = supabase.channel('devices-list-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, () => queryClient.invalidateQueries({ queryKey: ['devices'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warranties' }, () => queryClient.invalidateQueries({ queryKey: ['devices'] }))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}