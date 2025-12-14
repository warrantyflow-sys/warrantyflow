import { createClient } from '@/lib/supabase/client';
import { User } from '@/types';
import { sanitizePostgrestFilter } from '@/lib/utils';

export interface UsersResponse {
  users: User[];
  total: number;
}

export interface UserFilters {
  role?: 'admin' | 'store' | 'lab' | 'all';
  status?: 'active' | 'inactive' | 'all';
  search?: string;
}

/**
 * שליפת משתמשים עם פילטור ודיפדוף (Server-Side)
 */
export async function fetchUsersWithPagination(
  page: number = 1,
  pageSize: number = 50,
  filters: UserFilters = {}
): Promise<UsersResponse> {
  const supabase = createClient();
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize - 1;

  let query = supabase
    .from('users')
    .select('*', { count: 'exact' });

  // פילטור לפי תפקיד
  if (filters.role && filters.role !== 'all') {
    query = query.eq('role', filters.role);
  }

  // פילטור לפי סטטוס
  if (filters.status && filters.status !== 'all') {
    const isActive = filters.status === 'active';
    query = query.eq('is_active', isActive);
  }

  // חיפוש (שם, אימייל, טלפון)
  if (filters.search) {
    const s = sanitizePostgrestFilter(filters.search);
    query = query.or(`full_name.ilike.${s},email.ilike.${s},phone.ilike.${s}`);
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(startIndex, endIndex);

  if (error) {
    throw new Error(`Failed to fetch users: ${error.message}`);
  }

  return {
    users: (data || []) as User[],
    total: count || 0
  };
}