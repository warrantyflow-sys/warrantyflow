-- Fix the handle_new_user trigger to bypass RLS

DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Insert bypassing RLS by using SECURITY DEFINER context
  -- Use INSERT directly without relying on RLS policies
  INSERT INTO public.users (id, email, full_name, phone, role, is_active, created_by)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'store'),
    true,
    NULL
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail auth creation
    RAISE WARNING 'Failed to create user in public.users: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Make the function owner postgres/superuser so it can bypass RLS
ALTER FUNCTION handle_new_user() OWNER TO postgres;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
