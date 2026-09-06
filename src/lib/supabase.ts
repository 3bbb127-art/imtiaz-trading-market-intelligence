import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // Keep the message user-facing friendly but developer-clear.
  console.error('Supabase environment variables are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const EDGE_FUNCTION_BASE = `${url ?? ''}/functions/v1/market-intel`;
