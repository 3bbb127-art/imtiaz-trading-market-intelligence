import { createClient } from '@supabase/supabase-js';

const configuredUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const url = configuredUrl?.trim();
const key = (publishableKey ?? anonKey)?.trim();

const isValidHttpUrl = (value: string | undefined): value is string => {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const supabaseConfigured = isValidHttpUrl(url) && Boolean(key);

if (!supabaseConfigured) {
  console.error(
    'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) in the deployment environment.',
  );
}

// Keep the application shell bootable when deployment configuration is missing.
// The placeholder is never used for a real request; provider calls simply fail
// with a normal network error instead of crashing the entire React application.
const clientUrl = supabaseConfigured ? url : 'https://supabase.invalid';
const clientKey = supabaseConfigured ? key! : 'missing-supabase-key';

export const supabase = createClient(clientUrl, clientKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const EDGE_FUNCTION_BASE = supabaseConfigured
  ? `${url}/functions/v1/market-intel`
  : '';

export const isSupabaseConfigured = supabaseConfigured;
