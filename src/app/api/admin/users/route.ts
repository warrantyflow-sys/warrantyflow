import { createServiceClient } from '@/lib/supabase/server';
import type { TablesInsert } from '@/lib/supabase/database.types';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/jwt-helper';

export async function POST(request: Request) {
  try {
    // אופטימיזציה: שימוש ב-JWT claims - אפס קריאות נוספות למסד נתונים!
    const auth = await requireAdmin();
    if (!auth.success) return auth.response;

    const data = await request.json();

    // השתמש ב-service client לכל הפעולות
    const supabaseService = await createServiceClient();

    // Create auth user - הטריגר יטפל ביצירת הרשומה בטבלה
    const { data: authData, error: authError2 } = await supabaseService.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name,
        phone: data.phone,
        role: data.role,
      }
    });

    if (authError2) throw authError2;

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }
}