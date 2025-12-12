/**
 * JWT Authentication Helper
 * ========================
 * עוזר לקריאת role ו-is_active מתוך JWT token במקום קריאות למסד נתונים
 * חוסך 1-2 קריאות בכל API request!
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export interface JWTUserData {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
}

/**
 * קריאת נתוני משתמש מה-JWT token
 * אם אין custom claims עדיין - fallback לקריאה מהמסד נתונים
 */
export async function getUserFromJWT(): Promise<JWTUserData | null> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  // נסה לקרוא מה-JWT claims (מוגדר דרך Auth Hook)
  let userRole: string | undefined;
  let userActive: boolean | undefined;

  try {
    // Get session to access JWT token
    if (user.app_metadata?.user_role && user.app_metadata?.user_active !== undefined) {
      return {
        id: user.id,
        email: user.email || '',
        role: user.app_metadata?.user_role,
        isActive: user.app_metadata?.user_active
      };
    }
  } catch (error) {
    console.error('Error decoding JWT');
  }

  if (userRole !== undefined && userActive !== undefined) {
    return null;
  }

  const { data: userData, error: dbError } = await supabase
    .from('users')
    .select('role, is_active')
    .eq('id', user.id)
    .single();

  if (dbError || !userData) {
    return null;
  }

  return {
    id: user.id,
    email: user.email || '',
    role: userData.role,
    isActive: userData.is_active
  };
}

/**
 * אימות והרשאות ב-API route
 * מחזיר את נתוני המשתמש או שגיאה
 */
export async function authenticateAPI(
  allowedRoles?: string[]
): Promise<{ success: true; user: JWTUserData } | { success: false; response: NextResponse }> {

  const userData = await getUserFromJWT();

  // בדיקת אימות
  if (!userData) {
    return {
      success: false,
      response: NextResponse.json({ error: 'לא מורשה' }, { status: 401 })
    };
  }

  // בדיקת פעילות
  if (!userData.isActive) {
    return {
      success: false,
      response: NextResponse.json({ error: 'החשבון לא פעיל' }, { status: 403 })
    };
  }

  // בדיקת הרשאות לפי role
  if (allowedRoles && !allowedRoles.includes(userData.role)) {
    return {
      success: false,
      response: NextResponse.json({
        error: 'אין הרשאה לפעולה זו',
        required: allowedRoles,
        current: userData.role
      }, { status: 403 })
    };
  }

  return {
    success: true,
    user: userData
  };
}

/**
 * דרישת הרשאות Admin בלבד
 */
export async function requireAdmin() {
  return authenticateAPI(['admin']);
}

/**
 * דרישת הרשאות Store בלבד
 */
export async function requireStore() {
  return authenticateAPI(['store']);
}

/**
 * דרישת הרשאות Lab בלבד
 */
export async function requireLab() {
  return authenticateAPI(['lab']);
}

/**
 * דרישת משתמש מחובר (כל role)
 */
export async function requireAuth() {
  return authenticateAPI();
}

/**
 * בדיקה מהירה אם המשתמש הוא admin
 */
export async function isAdmin(): Promise<boolean> {
  const userData = await getUserFromJWT();
  return userData?.role === 'admin';
}
