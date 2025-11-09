export const runtime = 'nodejs';

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isSupabaseConfigured, validateSupabaseEnv } from '@/lib/env-validation';

export async function middleware(request: NextRequest) {
  // Check if environment variables are set using centralized validation
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase environment variables not configured properly');
    console.warn('Please update .env.local with your Supabase credentials');

    // Redirect to login when Supabase is not configured
    if (request.nextUrl.pathname === '/' ||
        request.nextUrl.pathname.startsWith('/admin') ||
        request.nextUrl.pathname.startsWith('/store') ||
        request.nextUrl.pathname.startsWith('/lab') ||
        request.nextUrl.pathname.startsWith('/register')) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  // Get validated environment variables (uses cache after first validation)
  const { url: supabaseUrl, anonKey: supabaseAnonKey } = validateSupabaseEnv();

  // Initialize response
  let supabaseResponse = NextResponse.next({
    request,
  });

  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    // אופטימיזציה: נסה לקרוא role ו-is_active מה-JWT claims תחילה
    // זה חוסך קריאת DB בכל request! (80-90% הפחתה בעומס)
    let userData = null;
    if (user) {
      // ניסיון לקרוא מ-JWT custom claims (מוגדר דרך auth hook)
      const userRole = (user as any).user_metadata?.user_role ||
                       (user as any).app_metadata?.user_role;
      const userActive = (user as any).user_metadata?.user_active ||
                         (user as any).app_metadata?.user_active;

      // אם יש claims - השתמש בהם (אפס קריאות נוספות למסד נתונים!)
      if (userRole !== undefined && userActive !== undefined) {
        userData = {
          role: userRole,
          is_active: userActive
        };
      } else {
        // Fallback: אם אין claims עדיין (משתמש שהתחבר לפני הגדרת ה-JWT hook)
        // המשתמש צריך לעשות logout/login כדי לקבל claims
        console.warn('⚠️ JWT claims not found for user, falling back to database query. User should re-login.');
        const { data: dbData } = await supabase
          .from('users')
          .select('role, is_active')
          .eq('id', user.id)
          .single();
        userData = dbData;
      }
    }

    const isAuthPage = request.nextUrl.pathname.startsWith('/login');
    const isRegisterPage = request.nextUrl.pathname.startsWith('/register');
    const isProtectedRoute = request.nextUrl.pathname.startsWith('/admin') ||
                             request.nextUrl.pathname.startsWith('/store') ||
                             request.nextUrl.pathname.startsWith('/lab');

    // 1. Handle root path ('/') redirection
    if (request.nextUrl.pathname === '/') {
      if (user && userData?.is_active) {
        const url = request.nextUrl.clone();
        switch (userData.role) {
          case 'admin': url.pathname = '/admin/dashboard'; break;
          case 'store': url.pathname = '/store/dashboard'; break;
          case 'lab': url.pathname = '/lab/dashboard'; break;
          default: url.pathname = '/login';
        }
        return NextResponse.redirect(url);
      }
      // If no user or not active, redirect to login
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    // 2. Block public registration
    if (isRegisterPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    // 3. Redirect unauthenticated users from protected routes
    if (!user && isProtectedRoute && !request.nextUrl.pathname.startsWith('/api')) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    // 4. Handle authenticated users trying to access auth pages
    if (user && isAuthPage) {
      if (userData?.is_active) {
        const url = request.nextUrl.clone();
        switch (userData.role) {
          case 'admin': url.pathname = '/admin/dashboard'; break;
          case 'store': url.pathname = '/store/dashboard'; break;
          case 'lab': url.pathname = '/lab/dashboard'; break;
          default: url.pathname = '/';
        }
        return NextResponse.redirect(url);
      } else {
        // If user is not active, log them out
        await supabase.auth.signOut();
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        url.searchParams.set('error', 'inactive');
        return NextResponse.redirect(url);
      }
    }

    // 5. Role-based access control for protected routes
    if (user && isProtectedRoute && !request.nextUrl.pathname.startsWith('/api')) {
      if (!userData || !userData.is_active) {
        await supabase.auth.signOut();
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        url.searchParams.set('error', 'unauthorized');
        return NextResponse.redirect(url);
      }

      const pathname = request.nextUrl.pathname;
      const userRole = userData.role;

      const isAdminOnlyRoute = [
        '/admin/users',
        '/admin/payments',
        '/admin/settings',
      ].some(route => pathname.startsWith(route));

      if (isAdminOnlyRoute && userRole !== 'admin') {
        const url = request.nextUrl.clone();
        url.pathname = `/${userRole}/dashboard`;
        return NextResponse.redirect(url);
      }

      if (
        (pathname.startsWith('/admin') && userRole !== 'admin') ||
        (pathname.startsWith('/store') && userRole !== 'store') ||
        (pathname.startsWith('/lab') && userRole !== 'lab')
      ) {
        const url = request.nextUrl.clone();
        url.pathname = `/${userRole}/dashboard`;
        return NextResponse.redirect(url);
      }
    }

  } catch (error) {
    console.error('Middleware error:', error);
    return supabaseResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - .well-known (for various services)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|.well-known).*)',
  ],
};