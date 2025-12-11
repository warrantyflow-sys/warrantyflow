import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';

export type DeviceModel = Database['public']['Tables']['device_models']['Row'];

export async function fetchAllDeviceModels(): Promise<DeviceModel[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('device_models')
    .select('*')
    .eq('is_active', true)
    .order('model_name', { ascending: true });

  if (error) {
    console.error('Error fetching device models:', error);
    throw new Error('Failed to fetch device models');
  }
  return data;
}
