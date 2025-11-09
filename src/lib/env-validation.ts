/**
 * Centralized environment variable validation
 * Implements fail-fast principle for configuration errors
 */

const INVALID_PLACEHOLDER_VALUES = [
  'your_supabase_url',
  'https://your-project.supabase.co',
  'your_anon_key',
  'your_service_role_key',
];

export interface SupabaseEnvVars {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

// Cache for validated environment variables to avoid repeated validations
let cachedEnvVars: SupabaseEnvVars | null = null;
let cachedWithServiceRole = false;

/**
 * Validates Supabase environment variables
 * @throws Error if environment variables are not configured properly
 */
export function validateSupabaseEnv(requireServiceRole = false): SupabaseEnvVars {
  // Return cached result if available and meets requirements
  if (cachedEnvVars && (!requireServiceRole || cachedWithServiceRole)) {
    return cachedEnvVars;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Check if variables are defined
  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase environment variables. ' +
      'Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local'
    );
  }

  // Check for placeholder values
  if (INVALID_PLACEHOLDER_VALUES.includes(url)) {
    throw new Error(
      `Invalid Supabase URL: "${url}". ` +
      'Please update NEXT_PUBLIC_SUPABASE_URL in .env.local with your actual Supabase project URL'
    );
  }

  if (INVALID_PLACEHOLDER_VALUES.includes(anonKey)) {
    throw new Error(
      'Invalid Supabase anon key: placeholder value detected. ' +
      'Please update NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local with your actual anon key'
    );
  }

  // Validate URL format
  try {
    const urlObj = new URL(url);
    if (!urlObj.hostname.includes('supabase')) {
      console.warn(
        `⚠️ Supabase URL doesn't contain "supabase": ${url}. ` +
        'This might be intentional (e.g., custom domain) but please verify.'
      );
    }
  } catch {
    throw new Error(
      `Invalid Supabase URL format: "${url}". ` +
      'Please provide a valid URL in NEXT_PUBLIC_SUPABASE_URL'
    );
  }

  // Check service role key if required
  if (requireServiceRole) {
    if (!serviceRoleKey) {
      throw new Error(
        'Missing SUPABASE_SERVICE_ROLE_KEY. ' +
        'This key is required for admin operations. Please set it in .env.local'
      );
    }

    if (INVALID_PLACEHOLDER_VALUES.includes(serviceRoleKey)) {
      throw new Error(
        'Invalid Supabase service role key: placeholder value detected. ' +
        'Please update SUPABASE_SERVICE_ROLE_KEY in .env.local with your actual service role key'
      );
    }

    // Basic validation: service role key should be different from anon key
    if (serviceRoleKey === anonKey) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY cannot be the same as NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
        'Please use the service_role key from your Supabase project settings.'
      );
    }
  }

  // Cache the validated result
  const result = { url, anonKey, serviceRoleKey };
  cachedEnvVars = result;
  if (requireServiceRole) {
    cachedWithServiceRole = true;
  }

  return result;
}

/**
 * Checks if Supabase environment variables are configured
 * Returns true if configured, false otherwise (does not throw)
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return false;
  }

  if (INVALID_PLACEHOLDER_VALUES.includes(url) || INVALID_PLACEHOLDER_VALUES.includes(anonKey)) {
    return false;
  }

  return true;
}
