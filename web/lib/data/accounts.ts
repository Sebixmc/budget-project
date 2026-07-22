import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MerchantRule } from "@/lib/categorizer";

export type Account = {
  id: string;
  name: string;
  type: string;
  owner: string;
  bank_format: string;
};

/** All of the signed-in user's accounts (RLS scopes to auth.uid()). */
export async function getAccounts(): Promise<Account[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("accounts")
    .select("id, name, type, owner, bank_format")
    .order("created_at", { ascending: true });
  return (data ?? []) as Account[];
}

/** The user's saved merchant rules, shaped for the categorizer. */
export async function getMerchantRules(): Promise<MerchantRule[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("merchant_rules")
    .select("pattern, category")
    .order("created_at", { ascending: true });
  return (data ?? []) as MerchantRule[];
}
