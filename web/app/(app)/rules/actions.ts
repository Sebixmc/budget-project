"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createRule(formData: FormData) {
  const pattern = String(formData.get("pattern") || "").trim().toLowerCase();
  const category = String(formData.get("category") || "").trim();
  if (!pattern || !category) return;

  const supabase = await createClient();
  // Upsert so re-adding an existing pattern just updates its category.
  await supabase
    .from("merchant_rules")
    .upsert({ pattern, category }, { onConflict: "user_id,pattern" });
  revalidatePath("/rules");
}

export async function deleteRule(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("merchant_rules").delete().eq("id", id);
  revalidatePath("/rules");
}

/** Escape LIKE wildcards so a pattern matches as a literal substring, the same
 *  way the categorizer's `includes()` does at import time. */
function escapeLike(pattern: string): string {
  return pattern.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export type RuleApplyResult = { ok: boolean; updated: number; error?: string };

/**
 * Upsert a merchant rule and immediately apply it to the user's existing
 * AUTO-categorized transactions, returning how many rows were updated.
 * Manual categorizations are never touched (hard rule #7). Used by the
 * post-upload triage panel and the save-as-rule prompt
 * (specs/rule-triage-flows.md).
 */
export async function createRuleAndApply(
  rawPattern: string,
  rawCategory: string,
): Promise<RuleApplyResult> {
  const pattern = rawPattern.trim().toLowerCase();
  const category = rawCategory.trim();
  if (!pattern || !category) return { ok: false, updated: 0, error: "Pattern and category required." };

  const supabase = await createClient();
  const { error: ruleError } = await supabase
    .from("merchant_rules")
    .upsert({ pattern, category }, { onConflict: "user_id,pattern" });
  if (ruleError) return { ok: false, updated: 0, error: ruleError.message };

  const { data, error } = await supabase
    .from("transactions")
    .update({ category })
    .eq("category_source", "auto")
    .ilike("description", `%${escapeLike(pattern)}%`)
    .select("id");
  if (error) return { ok: false, updated: 0, error: error.message };

  revalidatePath("/rules");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { ok: true, updated: data?.length ?? 0 };
}

/** How many of the user's auto-categorized transactions a rule pattern would
 *  recategorize — the "fixes N more" preview in the save-as-rule prompt. */
export async function countRuleMatches(rawPattern: string): Promise<number> {
  const pattern = rawPattern.trim().toLowerCase();
  if (!pattern) return 0;
  const supabase = await createClient();
  const { count } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("category_source", "auto")
    .ilike("description", `%${escapeLike(pattern)}%`);
  return count ?? 0;
}

/**
 * Re-apply every rule to existing AUTO-categorized transactions. Manual
 * categorizations (category_source='manual') are left untouched (hard rule #7).
 */
export async function reapplyRules() {
  const supabase = await createClient();
  const { data: rules } = await supabase.from("merchant_rules").select("pattern, category");
  for (const rule of rules ?? []) {
    await supabase
      .from("transactions")
      .update({ category: rule.category })
      .eq("category_source", "auto")
      .ilike("description", `%${rule.pattern}%`);
  }
  revalidatePath("/rules");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}
