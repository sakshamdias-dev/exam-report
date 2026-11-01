import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Permanent Institutional Supabase Configuration
// Primary Database: Supabase PostgreSQL (oyyqmitapsapvfszdeey.supabase.co)
// File Storage: Institutional Google Drive Only
// Target Domain: https://examreport.examfriendly.in
export const PERMANENT_SUPABASE_URL = 'https://oyyqmitapsapvfszdeey.supabase.co';
export const PERMANENT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95eXFtaXRhcHNhcHZmc3pkZWV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzNjcxMjIsImV4cCI6MjEwNDk0MzEyMn0.xYRbdwAnG47lrFRHNP2tT7LMUmeVMv0xBj87LrIkInI';

const STORAGE_KEY = 'examfriendly_supabase_config';

export interface SupabaseConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  isConfigured: boolean;
}

/**
 * Normalizes Supabase Project URL by stripping trailing slashes or /rest/v1 suffixes
 */
export function cleanSupabaseUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let cleaned = rawUrl.trim().replace(/^["']|["']$/g, '');
  // Auto-clean if user or env provided the /rest/v1 endpoint instead of the project root
  cleaned = cleaned.replace(/\/rest\/v1\/?$/, '');
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned;
}

/**
 * Returns the active Supabase configuration.
 * Automatically defaults to the permanent institutional credentials,
 * ensuring zero manual configuration is required from the candidate or faculty.
 */
export function getSupabaseConfig(): SupabaseConfig {
  let url = cleanSupabaseUrl(
    import.meta.env.VITE_SUPABASE_URL || PERMANENT_SUPABASE_URL
  );
  let key = (
    import.meta.env.VITE_SUPABASE_ANON_KEY || PERMANENT_SUPABASE_ANON_KEY
  ).trim();

  // If localStorage has an override, honor it; otherwise use the permanent credentials
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.supabaseUrl) url = cleanSupabaseUrl(parsed.supabaseUrl);
        if (parsed.supabaseAnonKey) key = parsed.supabaseAnonKey.trim();
      }
    } catch (e) {
      console.warn('Failed to parse stored Supabase config', e);
    }
  }

  // Fallback to permanent credentials if empty
  if (!url) url = PERMANENT_SUPABASE_URL;
  if (!key) key = PERMANENT_SUPABASE_ANON_KEY;

  return {
    supabaseUrl: url,
    supabaseAnonKey: key,
    isConfigured: Boolean(url && key && url.startsWith('http')),
  };
}

export function saveSupabaseConfig(url: string, key: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        supabaseUrl: cleanSupabaseUrl(url),
        supabaseAnonKey: key.trim(),
      })
    );
    cachedClient = null;
    window.dispatchEvent(new CustomEvent('supabase-config-updated'));
  }
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;

  const config = getSupabaseConfig();
  if (!config.isConfigured) return null;

  try {
    cachedClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      db: {
        schema: 'public',
      },
    });
    return cachedClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

export async function testSupabaseConnection(
  testUrl?: string,
  testKey?: string
): Promise<{ success: boolean; message: string; latencyMs?: number }> {
  const url = testUrl ? cleanSupabaseUrl(testUrl) : getSupabaseConfig().supabaseUrl;
  const key = testKey ? testKey.trim() : getSupabaseConfig().supabaseAnonKey;

  if (!url || !key) {
    return {
      success: false,
      message: 'Supabase URL and Anon Key are required.',
    };
  }

  const start = performance.now();
  try {
    const client = createClient(url, key, {
      auth: { persistSession: false },
    });

    const { error } = await client.from('users').select('user_id').limit(1);
    const latencyMs = Math.round(performance.now() - start);

    if (error) {
      if (error.code === '42P01' || error.message?.includes('relation "public.users" does not exist')) {
        return {
          success: false,
          message: `Connected to Supabase (${latencyMs}ms), but database tables are not yet created!`,
          latencyMs,
        };
      }
      return {
        success: false,
        message: `Supabase Error (${error.code || 'ERR'}): ${error.message}`,
        latencyMs,
      };
    }

    return {
      success: true,
      message: `Successfully connected to Supabase in ${latencyMs}ms! Database tables verified.`,
      latencyMs,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Network error connecting to Supabase instance.',
    };
  }
}
