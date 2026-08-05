import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ALL_CATEGORIES } from "@/lib/categorizer";

export type CategoryUsage = {
  category: string;
  txCount: number;
  hasBudget: boolean;
};

/**
 * Every category the user actually has — the union of categories appearing on
 * their transactions, their budget targets, and their user-created categories —
 * with a per-category transaction count and whether a budget target exists.
 * Drives the Settings category manager. RLS scopes every read to auth.uid().
 */
export async function getCategoryUsage(): Promise<CategoryUsage[]> {
  const supabase = await createClient();

  const [{ data: txRows }, { data: budgetRows }, { data: customRows }] = await Promise.all([
    supabase.from("transactions").select("category"),
    supabase.from("budget_categories").select("category"),
    supabase.from("user_categories").select("name"),
  ]);

  const counts = new Map<string, number>();
  for (const r of txRows ?? []) {
    const c = (r as { category: string }).category;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }

  const budgeted = new Set<string>();
  for (const r of budgetRows ?? []) budgeted.add((r as { category: string }).category);

  const custom = (customRows ?? []).map((r) => (r as { name: string }).name);

  const all = new Set<string>([...counts.keys(), ...budgeted, ...custom]);
  return Array.from(all)
    .map((category) => ({
      category,
      txCount: counts.get(category) ?? 0,
      hasBudget: budgeted.has(category),
    }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

/**
 * The sorted, de-duplicated list of categories to offer in every category
 * dropdown (Transactions, Rules, Budget): the built-in keyword categories plus
 * the user's custom categories plus anything already in use (e.g. a category a
 * rename produced). RLS scopes the per-user reads to auth.uid().
 */
export async function getSelectableCategories(): Promise<string[]> {
  const supabase = await createClient();

  const [{ data: customRows }, { data: txRows }, { data: budgetRows }] = await Promise.all([
    supabase.from("user_categories").select("name"),
    supabase.from("transactions").select("category"),
    supabase.from("budget_categories").select("category"),
  ]);

  const all = new Set<string>(ALL_CATEGORIES);
  for (const r of customRows ?? []) all.add((r as { name: string }).name);
  for (const r of txRows ?? []) all.add((r as { category: string }).category);
  for (const r of budgetRows ?? []) all.add((r as { category: string }).category);

  return Array.from(all).sort((a, b) => a.localeCompare(b));
}
