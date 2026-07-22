import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { assertPublicEnv } from "@/lib/env";

/** Supabase client for Server Components, Route Handlers, and Server Actions.
 *  Reads the user's session from cookies and runs queries AS that user, so RLS
 *  scopes every row to `auth.uid()`. Uses the anon key — never the service key. */
export async function createClient() {
  const { supabaseUrl, supabaseAnonKey } = assertPublicEnv();
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // `setAll` called from a Server Component — safe to ignore when
          // middleware is refreshing the session.
        }
      },
    },
  });
}
