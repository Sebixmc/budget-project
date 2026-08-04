import "server-only";
import { createClient } from "@/lib/supabase/server";

export type CategoryUsage = {
  category: string;
  txCount: number;
  hasBudget: boolean;
};

/**
 * Every category the user actually has — the union of categories appearing on
 * their transactions and their budget targets — with a per-category transaction
 * count and whether a budget target exists. Drives the Settings category
 * manager. RLS scopes every read to auth.uid().
 */
export async function getCategoryUsage(): Promise<CategoryUsage[]> {
  const supabase = await createClient();

  const [{ data: txRows }, { data: budgetRows }] = await Promise.all([
    supabase.from("transactions").select("category"),
    supabase.from("budget_categories").select("category"),
  ]);

  const counts = new Map<string, number>();
  for (const r of txRows ?? []) {
    const c = (r as { category: string }).category;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }

  const budgeted = new Set<string>();
  for (const r of budgetRows ?? []) budgeted.add((r as { category: string }).category);

  const all = new Set<string>([...counts.keys(), ...budgeted]);
  return Array.from(all)
    .map((category) => ({
      category,
      txCount: counts.get(category) ?? 0,
      hasBudget: budgeted.has(category),
    }))
    .sort((a, b) => a.category.localeCompare(b.category));
}
