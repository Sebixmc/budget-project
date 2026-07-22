/**
 * Environment access. Public values are safe in the browser; the service-role
 * key is read ONLY from `serverEnv()` which must never be imported by a client
 * component. See CLAUDE.md hard rule #2.
 */

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
};

export function assertPublicEnv() {
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy web/.env.example to web/.env.local and fill it in.",
    );
  }
  return publicEnv;
}
