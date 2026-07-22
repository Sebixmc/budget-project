"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Set a single transaction's category. A manual edit marks category_source
 *  = 'manual' so auto-categorization never overwrites it later (hard rule #7). */
export async function updateCategory(id: string, category: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .update({ category, category_source: "manual" })
    .eq("id", id);
  revalidatePath("/transactions");
  return { ok: !error, error: error?.message };
}

export async function updateNotes(id: string, notes: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").update({ notes }).eq("id", id);
  revalidatePath("/transactions");
  return { ok: !error, error: error?.message };
}

/** Apply a category to many transactions at once. */
export async function bulkCategory(ids: string[], category: string) {
  if (ids.length === 0) return { ok: true };
  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .update({ category, category_source: "manual" })
    .in("id", ids);
  revalidatePath("/transactions");
  return { ok: !error, error: error?.message };
}
