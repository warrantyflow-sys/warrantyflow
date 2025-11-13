-- Sync existing auth.users to public.users
-- This will fix the 4 users that were created in auth but not in public.users
-- Uses INSERT ... ON CONFLICT to safely handle existing users

INSERT INTO public.users (id, email, full_name, phone, role, is_active, created_by, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  NULLIF(TRIM(au.raw_user_meta_data->>'full_name'), ''),
  NULLIF(TRIM(au.raw_user_meta_data->>'phone'), ''),
  COALESCE((au.raw_user_meta_data->>'role')::user_role, 'store'),
  true,
  NULL,
  au.created_at,
  au.updated_at
FROM auth.users au
ON CONFLICT (id) 
DO UPDATE SET
  email = EXCLUDED.email,
  full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
  phone = COALESCE(EXCLUDED.phone, public.users.phone),
  role = EXCLUDED.role,
  updated_at = NOW();

-- Check results
SELECT 
  (SELECT COUNT(*) FROM auth.users) as auth_users_count,
  (SELECT COUNT(*) FROM public.users) as public_users_count,
  (SELECT COUNT(*) FROM public.users WHERE full_name IS NOT NULL) as users_with_name;

-- Show synced users
SELECT id, email, full_name, phone, role, created_at 
FROM public.users 
ORDER BY created_at DESC;
