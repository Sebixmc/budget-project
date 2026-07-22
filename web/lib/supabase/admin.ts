import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

/**
 * Privileged Supabase client using the SERVICE ROLE key — bypasses RLS.
 *
 * SECURITY (CLAUDE.md hard rule #2): the service-role key must never reach the
 * browser. The `server-only` import above makes bundling this into a client
 * component a build-time error. Use this ONLY for trusted server tasks that
 * legitimately need to act across a single user's rows during setup (e.g.
 * seeding default accounts on first sign-in) — always scoping writes by the
 * authenticated user's id yourself, since RLS is off here.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set (server-only secret).");
  }
  return createSupabaseClient(publicEnv.supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
