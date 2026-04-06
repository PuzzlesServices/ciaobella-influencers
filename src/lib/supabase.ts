import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
if (!supabaseAnonKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');

/**
 * Public client — use in Client Components.
 * Respects RLS, uses the anon key.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Admin client — use in Server Components, API routes, and server actions ONLY.
 * Uses the service role key → bypasses RLS.
 * Never expose this to the browser.
 */
export function getAdminClient() {
  if (!supabaseServiceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}
