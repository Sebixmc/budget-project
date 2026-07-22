"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Add or update a budgeted category (planning target only, no actuals). */
export async function upsertBudgetCategory(
  category: string,
  monthlyLimit: number,
  flowType: "expense" | "income",
) {
  if (!category) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase
    .from("budget_categories")
    .upsert(
      { category, monthly_limit: monthlyLimit, flow_type: flowType },
      { onConflict: "user_id,category" },
    );
  revalidatePath("/budget");
  return { ok: !error };
}

export async function removeBudgetCategory(category: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("budget_categories").delete().eq("category", category);
  revalidatePath("/budget");
  return { ok: !error };
}

/** Set the user's estimated monthly income (single row, keyed by user). */
export async function setIncome(estimate: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("budget_income")
    .upsert({ monthly_estimate: estimate }, { onConflict: "user_id" });
  revalidatePath("/budget");
  return { ok: !error };
}
