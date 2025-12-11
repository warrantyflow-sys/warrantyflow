import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';

export type RepairType = Database['public']['Tables']['repair_types']['Row'];

export async function fetchAllRepairTypes(): Promise<RepairType[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('repair_types')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching repair types:', error);
    throw new Error('Failed to fetch repair types');
  }
  return data;
}
