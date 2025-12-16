import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';
import { sanitizePostgrestFilter } from '@/lib/utils';

type RepairStatus = Database["public"]["Enums"]["repair_status"];

export interface RepairType {
  id: string;
  name: string;
  description: string | null;
  price: number;
  customOnly?: boolean;
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
    // תאימות לאחור
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

export interface RepairFilters {
  status?: string;
  labId?: string;
  search?: string;
  repairTypeId?: string;
  modelId?: string;
}

export interface PaginatedRepairsResponse {
  data: Repair[];
  count: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}

export async function fetchRepairsWithPagination(
  page: number = 1,
  pageSize: number = 50,
  filters: RepairFilters = {}
): Promise<PaginatedRepairsResponse> {
  const supabase = createClient();
  
  const searchTerm = filters.search?.trim() || '';
  
  if (/^\d{15}$/.test(searchTerm)) {
    const { data, error } = await supabase.rpc('search_repairs_by_imei', {
      p_imei: searchTerm,
      p_page: page,
      p_page_size: pageSize,
    });

    if (error) {
      throw new Error(`Failed to search repairs: ${error.message}`);
    }

    return normalizeRpcResponse(data);
  }

  const { data, error } = await supabase.rpc('get_repairs_paginated', {
    p_page: page,
    p_page_size: pageSize,
    p_status: filters.status && filters.status !== 'all' ? filters.status : undefined,
    p_lab_id: filters.labId && filters.labId !== 'all' ? filters.labId : undefined,
    p_search: searchTerm || undefined,
    p_repair_type_id: filters.repairTypeId && filters.repairTypeId !== 'all' && filters.repairTypeId !== 'custom' ? filters.repairTypeId : null,
    p_model_id: filters.modelId && filters.modelId !== 'all' ? filters.modelId : null,
    p_custom_only: filters.repairTypeId === 'custom',
  });

  if (error) {

    const errorMessage = error.message || '';
    const errorCode = error.code || '';


    if (errorMessage.includes('function') || errorCode === '42883' || errorCode === 'PGRST202') {
      return fetchRepairsWithPaginationLegacy(page, pageSize, filters);
    }
    
    throw new Error(`Failed to fetch repairs: ${errorMessage}`);
  }

  return normalizeRpcResponse(data);
}


export async function fetchLabRepairsWithPagination(
  labId: string,
  page: number = 1,
  pageSize: number = 50
): Promise<PaginatedRepairsResponse> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('get_lab_repairs_paginated', {
    p_lab_id: labId,
    p_page: page,
    p_page_size: pageSize,
  });

  if (error) {
    
    if (error.message.includes('function') || error.code === '42883') {
      return fetchLabRepairsWithPaginationLegacy(labId, page, pageSize);
    }
    
    throw new Error(`Failed to fetch repairs: ${error.message}`);
  }

  return normalizeRpcResponse(data);
}

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

async function fetchRepairsWithPaginationLegacy(
  page: number = 1,
  pageSize: number = 50,
  filters: RepairFilters = {}
): Promise<PaginatedRepairsResponse> {
  const supabase = createClient();
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize - 1;

  let countQuery = supabase
    .from('repairs')
    .select('id', { count: 'exact', head: true });

  if (filters.status && filters.status !== 'all') {
    countQuery = countQuery.eq('status', filters.status as RepairStatus);
  }
  if (filters.labId && filters.labId !== 'all') {
    countQuery = countQuery.eq('lab_id', filters.labId);
  }
  if (filters.search && filters.search.trim()) {
    const searchTerm = sanitizePostgrestFilter(filters.search.trim());
    countQuery = countQuery.or(
      `customer_name.ilike.%${searchTerm}%,customer_phone.ilike.%${searchTerm}%`
    );
  }

  const { count, error: countError } = await countQuery;

  if (countError) {
    throw new Error(`Failed to count repairs: ${countError.message}`);
  }

  let dataQuery = supabase
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
      device:devices(
        id,
        imei,
        imei2,
        device_models(model_name)
      ),
      lab:users!repairs_lab_id_fkey(
        id,
        full_name,
        email
      ),
      repair_type:repair_types(
        id,
        name
      ),
      warranty:warranties!repairs_warranty_id_fkey(
        customer_name,
        customer_phone,
        activation_date,
        expiry_date,
        store:users!warranties_store_id_fkey(full_name, email)
      )
    `);

  // החלת פילטרים
  if (filters.status && filters.status !== 'all') {
    dataQuery = dataQuery.eq('status', filters.status as RepairStatus);
  }
  if (filters.labId && filters.labId !== 'all') {
    dataQuery = dataQuery.eq('lab_id', filters.labId);
  }
  if (filters.search && filters.search.trim()) {
    const searchTerm = sanitizePostgrestFilter(filters.search.trim());
    dataQuery = dataQuery.or(
      `customer_name.ilike.%${searchTerm}%,customer_phone.ilike.%${searchTerm}%`
    );
  }

  const { data, error } = await dataQuery
    .order('created_at', { ascending: false })
    .range(startIndex, endIndex);

  if (error) {
    throw new Error(`Failed to fetch repairs: ${error.message}`);
  }

  const normalizedData = normalizeRepairsData(data || []);

  return { 
    data: normalizedData, 
    count: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  };
}

async function fetchLabRepairsWithPaginationLegacy(
  labId: string,
  page: number = 1,
  pageSize: number = 50
): Promise<PaginatedRepairsResponse> {
  const supabase = createClient();
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize - 1;

  // ספירה מהירה
  const { count } = await supabase
    .from('repairs')
    .select('id', { count: 'exact', head: true })
    .eq('lab_id', labId);

  // שליפת נתונים
  const { data, error } = await supabase
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
      device:devices(
        id,
        imei,
        imei2,
        device_models(model_name)
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
    .order('created_at', { ascending: false })
    .range(startIndex, endIndex);

  if (error) {
    throw new Error(`Failed to fetch repairs: ${error.message}`);
  }

  const normalizedData = normalizeRepairsData(data || []);

  return {
    data: normalizedData,
    count: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  };
}

function normalizeRpcResponse(data: any): PaginatedRepairsResponse {
  if (!data) {
    return { data: [], count: 0, page: 1, pageSize: 50, totalPages: 0 };
  }

  const repairs = Array.isArray(data.data) ? data.data : [];
  
  const normalizedRepairs = repairs.map((repair: any) => ({
    ...repair,
    device: repair.device ? {
      ...repair.device,
      device_model: repair.device.device_models,
    } : null,
    warranty: repair.warranty ? 
      (Array.isArray(repair.warranty) ? repair.warranty : [repair.warranty]) 
      : undefined,
  }));

  return {
    data: normalizedRepairs as Repair[],
    count: data.count || 0,
    page: data.page || 1,
    pageSize: data.pageSize || 50,
    totalPages: data.totalPages || 0,
  };
}

/**
 * נורמליזציה של נתוני תיקונים מ-Supabase
 */
function normalizeRepairsData(data: any[]): Repair[] {
  return data.map((repair: any) => ({
    ...repair,
    device: repair.device ? {
      id: repair.device.id,
      imei: repair.device.imei,
      imei2: repair.device.imei2,
      device_models: repair.device.device_models ? {
        model_name: repair.device.device_models.model_name
      } : null,
      device_model: repair.device.device_models ? {
        model_name: repair.device.device_models.model_name
      } : null
    } : null,
    warranty: repair.warranty ? 
      (Array.isArray(repair.warranty) ? repair.warranty : [repair.warranty])
      : undefined,
  }));
}


export async function fetchLabRepairs(labId: string): Promise<Repair[]> {
  
  const result = await fetchLabRepairsWithPagination(labId, 1, 100);
  return result.data;
}

export async function fetchLabPricingData(labId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('lab_repair_prices')
    .select(`
      *,
      repair_types:repair_types (
        id,
        name,
        description
      )
    `)
    .eq('lab_id', labId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch lab pricing: ${error.message}`);
  }

  return data || [];
}