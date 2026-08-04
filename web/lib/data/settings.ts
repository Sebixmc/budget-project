import "server-only";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PAGE_FALLBACK, isValidDefaultPage } from "@/lib/settings";

export type UserSettings = {
  default_page: string;
};

/** The user's settings row, or sensible defaults if they have none yet. */
export async function getUserSettings(): Promise<UserSettings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_settings")
    .select("default_page")
    .maybeSingle();
  const page = (data as { default_page?: string } | null)?.default_page ?? DEFAULT_PAGE_FALLBACK;
  return { default_page: isValidDefaultPage(page) ? page : DEFAULT_PAGE_FALLBACK };
}
