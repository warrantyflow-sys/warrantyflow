import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';

type RepairStatus = Database["public"]["Enums"]["repair_status"];
/**
 * API Functions for Repairs
 *
 * שכבת API לניהול תיקונים - שליפה, יצירה ועדכון
 */

// Types
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
    device_model?: {
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

// Interface לפילטרים
export interface RepairFilters {
  status?: string;
  labId?: string;
  search?: string;
}

export async function fetchRepairsWithPagination(
  page: number = 1,
  pageSize: number = 50,
  filters: RepairFilters = {}
) {
  const supabase = createClient();
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize - 1;

  // בניית השאילתה
  let query = supabase
    .from('repairs')
    .select(`
      *,
      device:devices(
        id, imei, imei2,
        device_models(model_name),
        device_model:device_models(model_name)
      ),
      lab:users!repairs_lab_id_fkey(id, full_name, email),
      warranty:warranties!repairs_warranty_id_fkey(
        customer_name,
        customer_phone,
        activation_date,
        expiry_date,
        store:users!warranties_store_id_fkey(full_name, email)
      ),
      repair_type:repair_types(id, name)
    `, { count: 'exact' });

  // החלת פילטרים בצד השרת
  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status as RepairStatus);
  }

  if (filters.labId && filters.labId !== 'all') {
    query = query.eq('lab_id', filters.labId);
  }

  // חיפוש (Search)
  if (filters.search) {
    query = query.or(`fault_description.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`);
  }

  // מיון ודיפדוף
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(startIndex, endIndex);

  if (error) {
    throw new Error(`Failed to fetch repairs: ${error.message}`);
  }

  return { 
    data: (data || []) as any as Repair[], 
    count: count || 0 
  };
}

/**
 * שליפת כל התיקונים של מעבדה
 */
export async function fetchLabRepairs(labId: string): Promise<Repair[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('repairs')
    .select(`
      *,
      device:devices(
        id,
        imei,
        imei2,
        device_models(model_name)
      ),
      warranty:warranties!repairs_warranty_id_fkey(
        customer_name,
        customer_phone,
        activation_date,
        expiry_date,
        store:users!warranties_store_id_fkey(full_name, email)
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
    `)
    .eq('lab_id', labId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch repairs: ${error.message}`);
  }

  return (data || []) as any as Repair[];
}

/**
 * שליפת סוגי תיקונים זמינים למעבדה
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