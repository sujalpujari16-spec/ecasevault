import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://ecasevault-supabase.police.gov.in';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock_service_role_key_for_ecasevault_enterprise';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'mock_anon_key';

export const SUPABASE_BUCKET_DOCUMENTS = process.env.SUPABASE_STORAGE_BUCKET_DOCUMENTS || 'case-documents';
export const SUPABASE_BUCKET_EVIDENCE = process.env.SUPABASE_STORAGE_BUCKET_EVIDENCE || 'case-evidence';

/**
 * Server-side Supabase client with administrative service role credentials.
 * Used for RLS-bypassing backend operations.
 */
export const supabaseAdmin: SupabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

/**
 * Creates a JWT-scoped Supabase client.
 * This bridges our custom JWT Authentication with Supabase's Row Level Security (RLS).
 * When this client executes queries, Postgres will enforce RLS policies based on the user's token!
 */
export function getScopedSupabaseClient(jwtToken: string): SupabaseClient {
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${jwtToken}`,
      },
    },
  });
  return client;
}

/**
 * Initializes private Supabase storage buckets if they do not exist.
 */
export async function initializeSupabaseStorage(): Promise<void> {
  try {
    const { data: buckets, error } = await supabaseAdmin.storage.listBuckets();
    if (error) {
      console.warn('[SUPABASE STORAGE] Could not list buckets (offline or mock mode):', error.message);
      return;
    }

    const existingNames = (buckets || []).map((b) => b.name);

    if (!existingNames.includes(SUPABASE_BUCKET_DOCUMENTS)) {
      await supabaseAdmin.storage.createBucket(SUPABASE_BUCKET_DOCUMENTS, { public: false, fileSizeLimit: 52428800 });
      console.log(`[SUPABASE STORAGE] Created private bucket: ${SUPABASE_BUCKET_DOCUMENTS}`);
    }

    if (!existingNames.includes(SUPABASE_BUCKET_EVIDENCE)) {
      await supabaseAdmin.storage.createBucket(SUPABASE_BUCKET_EVIDENCE, { public: false, fileSizeLimit: 104857600 });
      console.log(`[SUPABASE STORAGE] Created private bucket: ${SUPABASE_BUCKET_EVIDENCE}`);
    }
  } catch (err: any) {
    console.warn('[SUPABASE STORAGE] Bucket initialization error:', err.message);
  }
}
