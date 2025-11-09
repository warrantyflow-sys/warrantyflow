import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './database.types';
import { validateSupabaseEnv } from '@/lib/env-validation';

export async function createClient() {
  // Validate environment variables on first use (fail-fast)
  const { url, anonKey } = validateSupabaseEnv();

  const cookieStore = await cookies();

  return createServerClient<Database>(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

export async function createServiceClient() {
  // Validate environment variables including service role key (fail-fast)
  // validateSupabaseEnv(true) throws if serviceRoleKey is missing or invalid
  const { url, serviceRoleKey } = validateSupabaseEnv(true);

  return createServerClient<Database>(
    url,
    serviceRoleKey!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
    }
  );
}