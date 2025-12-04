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

/**
 * שליפת מכשירים עם סינון ודיפדוף (Server-Side Pagination)
 */
async function fetchDevices(filters: DevicesFilter): Promise<DevicesResponse> {
  const supabase = createClient();
  const { page, pageSize, search, model, warrantyStatus } = filters;

  // חישוב הטווח לשליפה (0-49, 50-99 וכו')
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('devices')
    .select(`
      *,
      device_model:device_models(id, model_name),
      warranty:warranties(
        id, 
        warranty_status, 
        start_date, 
        end_date,
        store:users!warranties_store_id_fkey(full_name)
      )
    `, { count: 'exact' }); // בקשת ספירה כוללת לצורך ה-Pagination

  // סינונים
  if (search) {
    // חיפוש לפי IMEI או IMEI2
    query = query.or(`imei.ilike.%${search}%,imei2.ilike.%${search}%`);
  }

  if (model && model !== 'all') {
    query = query.eq('model_id', model);
  }

  // סינון לפי סטטוס אחריות דורש לוגיקה מורכבת יותר, 
  // לרוב עושים זאת בצד לקוח או באמצעות View ב-DB. 
  // כאן נתמקד בסינון בסיסי יעיל.

  // מיון ודיפדוף
  query = query
    .order('created_at', { ascending: false })
    .range(from, to);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch devices: ${error.message}`);
  }

  return { data: data || [], count: count || 0 };
}

/**
 * Hook ראשי לניהול מכשירים
 */
export function useDevices(filters: DevicesFilter) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['devices', filters], // המפתח כולל את הפילטרים כדי לרענן בשינוי
    queryFn: () => fetchDevices(filters),
    placeholderData: keepPreviousData, // מונע הבהוב בזמן מעבר עמוד
    staleTime: 1000 * 60, // דקה אחת של Cache
  });

  // Realtime Subscription
  // מאזין לשינויים כדי לרענן את הטבלה אוטומטית
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel('devices-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, () => {
        queryClient.invalidateQueries({ queryKey: ['devices'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

// --- הקוד הישן שלך נשאר כאן למטה ללא שינוי ---

async function fetchDevicesWithoutWarranty() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('devices_with_status')
    .select('*')
    .eq('warranty_status', 'new');

  if (error) throw new Error(error.message);
  return data || [];
}

export function useDevicesWithoutWarranty() {
  const queryClient = useQueryClient();
  // ... (הקוד המקורי שלך)
  return useQuery({
    queryKey: ['devices', 'without-warranty'],
    queryFn: fetchDevicesWithoutWarranty,
  });
}