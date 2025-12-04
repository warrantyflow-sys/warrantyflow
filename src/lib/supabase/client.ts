import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';
import { validateSupabaseEnv } from '@/lib/env-validation';

let clientInstance: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  const { url, anonKey } = validateSupabaseEnv();

  if (typeof window !== 'undefined') {
    if (!clientInstance) {
      clientInstance = createBrowserClient<Database>(url, anonKey);
    }
    return clientInstance;
  }

  return createBrowserClient<Database>(url, anonKey);
}