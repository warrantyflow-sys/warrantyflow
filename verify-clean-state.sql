-- Verify current state after deletion
SELECT 
  (SELECT COUNT(*) FROM auth.users) as auth_users_count,
  (SELECT COUNT(*) FROM public.users) as public_users_count;

-- Show all users in both tables
SELECT 'AUTH.USERS' as source, id, email, created_at 
FROM auth.users
UNION ALL
SELECT 'PUBLIC.USERS' as source, id, email, created_at 
FROM public.users
ORDER BY created_at DESC;
