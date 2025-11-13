-- Check if the trigger exists and is active
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Check function owner
SELECT 
  proname as function_name,
  pg_get_userbyid(proowner) as owner,
  prosecdef as is_security_definer
FROM pg_proc
WHERE proname = 'handle_new_user';
