"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMerchantRules } from "@/lib/data/accounts";
import { detectAndParse } from "@/lib/parser";
import { cleanMerchantPattern } from "@/lib/merchant";

/** One merchant's worth of still-uncategorized transactions (triage panel). */
export type TriageGroup = {
  pattern: string;
  count: number;
  total: number;
  sampleDescription: string;
  ids: string[];
};

export type UploadResult = {
  ok: boolean;
  imported?: number;
  skipped?: number;
  error?: string;
  /** Identifies this import so the triage panel resets per upload. */
  batch?: string;
  /** Uncategorized-by-merchant groups to triage; empty → no panel. */
  triage?: TriageGroup[];
};

/**
 * The user's still-uncategorized transactions (category='Other', auto),
 * grouped by cleaned merchant pattern — across ALL accounts, not just the
 * latest upload, so the whole pile can be cleared in one sitting
 * (specs/rule-triage-flows.md). RLS scopes the query to the signed-in user.
 */
export async function getUncategorizedGroups(): Promise<TriageGroup[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("transactions")
    .select("id, description, amount")
    .eq("category", "Other")
    .eq("category_source", "auto");

  const groups = new Map<string, TriageGroup>();
  for (const row of data ?? []) {
    const description = String(row.description ?? "");
    // An all-noise description cleans to "" — group it under its raw text.
    const pattern = cleanMerchantPattern(description) || description.trim().toLowerCase();
    if (!pattern) continue;
    let group = groups.get(pattern);
    if (!group) {
      group = { pattern, count: 0, total: 0, sampleDescription: description, ids: [] };
      groups.set(pattern, group);
    }
    group.count += 1;
    group.total += Number(row.amount);
    group.ids.push(String(row.id));
  }
  return [...groups.values()]
    .map((g) => ({ ...g, total: Math.round(g.total * 100) / 100 }))
    .sort((a, b) => b.count - a.count || b.total - a.total);
}

/**
 * Parse an uploaded bank CSV and store its rows for the signed-in user.
 * Idempotent: duplicates (same user/account/date/description/amount/flow) are
 * skipped by the unique constraint, not doubled (hard rule #6).
 */
export async function uploadCsv(
  _prev: UploadResult | null,
  formData: FormData,
): Promise<UploadResult> {
  const accountId = String(formData.get("accountId") || "");
  const file = formData.get("file");

  if (!accountId || !(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Pick an account and a CSV file." };
  }

  const supabase = await createClient();

  // RLS guarantees this only resolves if the account belongs to the user.
  const { data: account } = await supabase
    .from("accounts")
    .select("id, bank_format")
    .eq("id", accountId)
    .single();
  if (!account) return { ok: false, error: "Account not found." };

  let rows;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const rules = await getMerchantRules();
    rows = detectAndParse(bytes, account.bank_format as string, rules);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not parse that CSV." };
  }
  if (rows.length === 0) {
    return { ok: false, error: "No transactions found in that file." };
  }

  const batch = crypto.randomUUID().slice(0, 8);
  const payload = rows.map((r) => ({
    account_id: accountId,
    date: r.date,
    description: r.description,
    amount: r.amount,
    flow: r.flow,
    category: r.category,
    category_source: "auto",
    notes: r.notes,
    raw_category: r.raw_category,
    upload_batch: batch,
  }));

  const { data: inserted, error } = await supabase
    .from("transactions")
    .upsert(payload, {
      onConflict: "user_id,account_id,date,description,amount,flow",
      ignoreDuplicates: true,
    })
    .select("id");
  if (error) return { ok: false, error: error.message };

  const imported = inserted?.length ?? 0;
  const skipped = rows.length - imported;

  await supabase.from("uploads").insert({
    account_id: accountId,
    filename: file.name,
    rows_imported: imported,
    rows_skipped: skipped,
  });

  revalidatePath("/upload");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { ok: true, imported, skipped, batch, triage: await getUncategorizedGroups() };
}
