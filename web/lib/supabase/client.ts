import { createBrowserClient } from "@supabase/ssr";
import { assertPublicEnv } from "@/lib/env";

/** Supabase client for browser/client components. Uses the public anon key,
 *  which is inert without a valid session because RLS gates every row. */
export function createClient() {
  const { supabaseUrl, supabaseAnonKey } = assertPublicEnv();
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
