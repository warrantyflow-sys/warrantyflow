import { createServiceClient } from '@/lib/supabase/server';
import type { TablesInsert } from '@/lib/supabase/database.types';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/jwt-helper';

export async function POST(request: Request) {
  try {
    // אופטימיזציה: שימוש ב-JWT claims - אפס קריאות נוספות!
    const auth = await requireAdmin();
    if (!auth.success) return auth.response;

    const data = await request.json();

    // השתמש ב-service client ליצירת המשתמש
    const supabaseService = await createServiceClient();

    // צור משתמש ב-Supabase Auth
    const { data: authData, error: authError2 } = await supabaseService.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true, // אישור אוטומטי של האימייל
      user_metadata: {
        full_name: data.full_name,
      }
    });

    if (authError2) throw authError2;

    // צור רשומת משתמש בטבלה שלנו
    const payload: TablesInsert<'users'> = {
      id: authData.user!.id,
      email: data.email,
      full_name: data.full_name,
      phone: data.phone,
      role: data.role,
      is_active: true,
    };

    const { error: profileError } = await (supabaseService.from('users') as any)
      .insert([payload]);

    if (profileError) {
      // אם נכשל, מחק את המשתמש מ-Auth
      await supabaseService.auth.admin.deleteUser(authData.user!.id);
      throw profileError;
    }

    return NextResponse.json({
      success: true,
      userId: authData.user!.id
    });

  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: error.message || 'שגיאה ביצירת משתמש' },
      { status: 400 }
    );
  }
}