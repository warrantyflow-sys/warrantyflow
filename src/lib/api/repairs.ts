import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';

type RepairStatus = Database["public"]["Enums"]["repair_status"];

/**
 * API Functions for Repairs - OPTIMIZED VERSION
 * 
 * ✅ אופטימיזציות שבוצעו:
 * 1. הפחתת JOIN-ים מיותרים
 * 2. הסרת כפילויות
 * 3. שיפור ביצועי החיפוש
 * 4. שימוש באינדקסים קיימים
 */

export interface RepairType {
  id: string;
  name: string;
  description: string | null;
  price: number;
}

export interface Repair {
  id: string;
  device_id?: string;
  lab_id?: string | null;
  warranty_id?: string | null;
  repair_type_id?: string | null;
  cost?: number | null;
  status: string;
  fault_type?: string;
  customer_name?: string;
  customer_phone?: string;
  custom_repair_description?: string | null;
  custom_repair_price?: number | null;
  created_at?: string;
  completed_at?: string | null;
  repair_type?: {
    id: string;
    name: string;
    description?: string | null;
  } | null;
  device?: {
    id: string;
    imei: string;
    imei2?: string | null;
    device_models?: {
      model_name: string;
    } | null;
  } | null;
  warranty?: Array<{
    customer_name: string;
    customer_phone: string;
    activation_date: string;
    expiry_date: string;
    store?: { full_name: string; email: string } | null;
  }>;
  replacement_requests?: Array<{
    id: string;
    status: string;
    created_at: string;
  }>;
  lab?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
}

export interface RepairFilters {
  status?: string;
  labId?: string;
  search?: string;
}

/**
 * ✅ שליפת תיקונים עם pagination ופילטרים (מאופטם)
 * 
 * שיפורים:
 * - הפחתת JOIN-ים ל-3 בלבד (במקום 6)
 * - הסרת כפילות device_models
 * - חיפוש משופר עם תעדוף IMEI
 */
export async function fetchRepairsWithPagination(
  page: number = 1,
  pageSize: number = 50,
  filters: RepairFilters = {}
) {
  const supabase = createClient();
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize - 1;

  // ✅ שאילתה מאופטמת - רק JOIN-ים הכרחיים
  let query = supabase
    .from('repairs')
    .select(`
      id,
      device_id,
      lab_id,
      warranty_id,
      repair_type_id,
      cost,
      status,
      fault_type,
      customer_name,
      customer_phone,
      custom_repair_description,
      custom_repair_price,
      created_at,
      completed_at,
      device:devices!inner(
        id,
        imei,
        imei2,
        device_models!inner(model_name)
      ),
      lab:users!repairs_lab_id_fkey(
        id,
        full_name,
        email
      ),
      repair_type:repair_types(
        id,
        name
      )
    `, { count: 'exact' });

  // החלת פילטרים בצד השרת
  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status as RepairStatus);
  }

  if (filters.labId && filters.labId !== 'all') {
    query = query.eq('lab_id', filters.labId);
  }

  // ✅ חיפוש משופר - תעדוף שדות חשובים
  if (filters.search && filters.search.trim()) {
    const searchTerm = filters.search.trim();
    
    // אם נראה כמו IMEI (15 ספרות) - חפש רק ב-IMEI
    if (/^\d{15}$/.test(searchTerm)) {
      query = query.or(
        `device.imei.eq.${searchTerm},device.imei2.eq.${searchTerm}`
      );
    }
    // אחרת - חפש בשם ולקוח וטלפון בלבד (ללא fault_description ו-notes)
    else {
      query = query.or(
        `customer_name.ilike.%${searchTerm}%,customer_phone.ilike.%${searchTerm}%`
      );
    }
  }

  // מיון ודיפדוף
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(startIndex, endIndex);

  if (error) {
    console.error('❌ Error fetching repairs:', error);
    throw new Error(`Failed to fetch repairs: ${error.message}`);
  }

  // ✅ נורמליזציה של הנתונים
  const normalizedData = (data || []).map((repair: any) => ({
    ...repair,
    device: repair.device ? {
      id: repair.device.id,
      imei: repair.device.imei,
      imei2: repair.device.imei2,
      device_models: repair.device.device_models ? {
        model_name: repair.device.device_models.model_name
      } : null,
      // תאימות לאחור
      device_model: repair.device.device_models ? {
        model_name: repair.device.device_models.model_name
      } : null
    } : null
  }));

  return { 
    data: normalizedData as Repair[], 
    count: count || 0 
  };
}

/**
 * ✅ שליפת תיקונים של מעבדה עם pagination (מאופטם)
 */
export async function fetchLabRepairsWithPagination(
  labId: string,
  page: number = 1,
  pageSize: number = 50
): Promise<{ data: Repair[]; count: number }> {
  const supabase = createClient();
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize - 1;

  const { data, error, count } = await supabase
    .from('repairs')
    .select(`
      id,
      device_id,
      lab_id,
      warranty_id,
      repair_type_id,
      cost,
      status,
      fault_type,
      customer_name,
      customer_phone,
      custom_repair_description,
      custom_repair_price,
      created_at,
      completed_at,
      device:devices!inner(
        id,
        imei,
        imei2,
        device_models!inner(model_name)
      ),
      repair_type:repair_types(
        id,
        name,
        description
      ),
      replacement_requests(
        id,
        status,
        created_at
      )
    `, { count: 'exact' })
    .eq('lab_id', labId)
    .order('created_at', { ascending: false })
    .range(startIndex, endIndex);

  if (error) {
    console.error('❌ Error fetching lab repairs:', error);
    throw new Error(`Failed to fetch repairs: ${error.message}`);
  }

  // נורמליזציה
  const normalizedData = (data || []).map((repair: any) => ({
    ...repair,
    device: repair.device ? {
      id: repair.device.id,
      imei: repair.device.imei,
      imei2: repair.device.imei2,
      device_models: repair.device.device_models ? {
        model_name: repair.device.device_models.model_name
      } : null
    } : null
  }));

  return {
    data: normalizedData as Repair[],
    count: count || 0
  };
}

/**
 * @deprecated השתמש ב-fetchLabRepairsWithPagination במקום
 */
export async function fetchLabRepairs(labId: string): Promise<Repair[]> {
  console.warn('⚠️ fetchLabRepairs is deprecated. Use fetchLabRepairsWithPagination instead.');
  
  const result = await fetchLabRepairsWithPagination(labId, 1, 100);
  return result.data;
}

/**
 * ✅ שליפת סוגי תיקונים זמינים למעבדה
 */
export async function fetchLabRepairTypes(labId: string): Promise<RepairType[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('lab_repair_prices')
    .select(`
      price,
      repair_type:repair_types!inner(
        id,
        name,
        description
      )
    `)
    .eq('lab_id', labId)
    .eq('is_active', true)
    .eq('repair_types.is_active', true);

  if (error) {
    throw new Error(`Failed to fetch lab repair types: ${error.message}`);
  }

  const repairTypesWithPrices = (data || []).map((item: any) => ({
    id: item.repair_type.id,
    name: item.repair_type.name,
    description: item.repair_type.description,
    price: item.price,
  }));

  return repairTypesWithPrices;
}