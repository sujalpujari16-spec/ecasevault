import { createClient, SupabaseClient } from '@supabase/supabase-js';

const metaEnv = (import.meta as any).env || {};
const supabaseUrl = metaEnv.VITE_SUPABASE_URL || 'https://ecasevault-supabase.police.gov.in';
const supabaseAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY || 'mock_anon_key_for_ecasevault_enterprise';

/**
 * Client-side Supabase instance.
 * Uses public anonymous key and enforces Row-Level Security (RLS)
 * for direct queries while delegating sensitive encrypted uploads & downloads
 * to the authenticated Express API endpoints.
 */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
