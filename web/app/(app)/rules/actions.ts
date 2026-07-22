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
