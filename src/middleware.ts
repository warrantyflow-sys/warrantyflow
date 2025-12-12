export const runtime = 'nodejs';

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isSupabaseConfigured, validateSupabaseEnv } from '@/lib/env-validation';

// ============================================================================
// ROUTE CONFIGURATION
// ============================================================================

type UserRole = 'admin' | 'store' | 'lab';

// Role-based route prefixes (pages and API)
const ROLE_ROUTE_PREFIXES: Record<UserRole, string[]> = {
  admin: ['/admin', '/api/admin'],
  store: ['/store', '/api/store'],
  lab: ['/lab', '/api/lab'],
};

// All protected prefixes (derived from ROLE_ROUTE_PREFIXES)
const PROTECTED_PREFIXES = Object.values(ROLE_ROUTE_PREFIXES).flat();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

function isAuthPage(pathname: string): boolean {
  return pathname === '/login' || pathname === '/register';
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

function getRoleForRoute(pathname: string): UserRole | null {
  for (const [role, prefixes] of Object.entries(ROLE_ROUTE_PREFIXES)) {
    if (prefixes.some(prefix => pathname.startsWith(prefix))) {
      return role as UserRole;
    }
  }
  return null;
}

function getDashboardByRole(role: UserRole): string {
  const dashboards: Record<UserRole, string> = {
    admin: '/admin/dashboard',
    store: '/store/dashboard',
    lab: '/lab/dashboard',
  };
  return dashboards[role] || '/login';
}

function isRouteAllowedForRole(pathname: string, userRole: UserRole): boolean {
  const requiredRole = getRoleForRoute(pathname);

  // If route doesn't require a specific role, deny access (fail-closed)
  if (!requiredRole) {
    return false;
  }

  return userRole === requiredRole;
}

function createRedirectResponse(
  request: NextRequest,
  pathname: string,
  searchParams?: Record<string, string>
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  return NextResponse.redirect(url);
}

function createUnauthorizedResponse(message: string = 'Unauthorized'): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

function createForbiddenResponse(message: string = 'Forbidden'): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ------------------------------------------
  // 1. Check Supabase configuration
  // ------------------------------------------
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase environment variables not configured');

    if (pathname === '/' || isProtectedRoute(pathname)) {
      return createRedirectResponse(request, '/login');
    }
    return NextResponse.next();
  }

  // ------------------------------------------
  // 2. Initialize Supabase client
  // ------------------------------------------
  const { url: supabaseUrl, anonKey: supabaseAnonKey } = validateSupabaseEnv();

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // ------------------------------------------
  // 3. Get user and their data
  // ------------------------------------------
  let user = null;
  let userData: { role: UserRole; is_active: boolean } | null = null;

  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    user = authUser;

    if (user) {
      // Always fetch from DB to ensure we have the latest role/active status
      // This prevents security issues where JWT claims are stale after admin changes
      const { data: dbData } = await supabase
        .from('users')
        .select('role, is_active')
        .eq('id', user.id)
        .single();

      if (dbData) {
        userData = {
          role: dbData.role as UserRole,
          is_active: dbData.is_active,
        };
      }
    }
  } catch (error) {
    console.error('Middleware: Error fetching user data:', error);

    // FAIL-CLOSED: Block access on error for protected routes
    if (isProtectedRoute(pathname)) {
      if (isApiRoute(pathname)) {
        return createUnauthorizedResponse('Authentication error');
      }
      return createRedirectResponse(request, '/login', { error: 'auth_error' });
    }
    return supabaseResponse;
  }

  // ------------------------------------------
  // 4. Handle root path redirect
  // ------------------------------------------
  if (pathname === '/') {
    if (user && userData?.is_active) {
      return createRedirectResponse(request, getDashboardByRole(userData.role));
    }
    return createRedirectResponse(request, '/login');
  }

  // ------------------------------------------
  // 5. Handle unauthenticated users
  // ------------------------------------------
  if (!user) {
    if (isProtectedRoute(pathname)) {
      if (isApiRoute(pathname)) {
        return createUnauthorizedResponse();
      }
      return createRedirectResponse(request, '/login');
    }
    return supabaseResponse;
  }

  // ------------------------------------------
  // 6. Handle authenticated users on auth pages
  // ------------------------------------------
  if (isAuthPage(pathname)) {
    if (userData?.is_active) {
      return createRedirectResponse(request, getDashboardByRole(userData.role));
    }
    // Inactive user trying to access auth pages - sign them out
    await supabase.auth.signOut();
    return createRedirectResponse(request, '/login', { error: 'inactive' });
  }

  // ------------------------------------------
  // 7. Handle protected routes
  // ------------------------------------------
  if (isProtectedRoute(pathname)) {
    // Check if user is active
    if (!userData?.is_active) {
      await supabase.auth.signOut();
      if (isApiRoute(pathname)) {
        return createUnauthorizedResponse('Account inactive');
      }
      return createRedirectResponse(request, '/login', { error: 'inactive' });
    }

    // Check role-based access
    if (!isRouteAllowedForRole(pathname, userData.role)) {
      if (isApiRoute(pathname)) {
        return createForbiddenResponse('Access denied for your role');
      }
      return createRedirectResponse(request, getDashboardByRole(userData.role));
    }
  }

  return supabaseResponse;
}

// ============================================================================
// MATCHER CONFIGURATION
// ============================================================================

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static assets (svg, png, jpg, jpeg, gif, webp)
     * - .well-known (for various services)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|.well-known).*)',
  ],
};
