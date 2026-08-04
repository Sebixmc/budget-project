"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sumIncomeSources, type IncomeSource, type TaxLine } from "@/lib/budget-math";

type ActionResult = { ok: boolean; error?: string };

/** A sane upper bound for money inputs — rejects fat-fingered garbage. */
const MAX_AMOUNT = 100_000_000;

function validAmount(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= MAX_AMOUNT;
}

/** Strictly validate the tax_lines payload; returns null when malformed
 *  (wrong shape, negative values, percent outside 0–100). */
function validateTaxLines(input: unknown): TaxLine[] | null {
  if (!Array.isArray(input) || input.length > 20) return null;
  const lines: TaxLine[] = [];
  for (const raw of input) {
    if (typeof raw !== "object" || raw === null) return null;
    const { name, kind, value } = raw as Record<string, unknown>;
    if (typeof name !== "string" || name.trim().length === 0 || name.length > 80) return null;
    if (kind !== "percent" && kind !== "amount") return null;
    if (!validAmount(value)) return null;
    if (kind === "percent" && value > 100) return null;
    lines.push({ name: name.trim(), kind, value });
  }
  return lines;
}

/** Strictly validate income sources; null when malformed. */
function validateIncomeSources(input: unknown): IncomeSource[] | null {
  if (!Array.isArray(input) || input.length > 20) return null;
  const sources: IncomeSource[] = [];
  for (const raw of input) {
    if (typeof raw !== "object" || raw === null) return null;
    const { name, amount } = raw as Record<string, unknown>;
    if (typeof name !== "string" || name.trim().length === 0 || name.length > 80) return null;
    if (!validAmount(amount)) return null;
    sources.push({ name: name.trim(), amount });
  }
  return sources;
}

/** Save the cascade profile: itemized yearly income sources + tax estimate.
 *  gross_annual is stored as the sources' sum so existing readers (cascade,
 *  Sankey) keep working. Rejects invalid input without persisting. */
export async function saveProfile(
  incomeSources: IncomeSource[],
  taxLines: TaxLine[],
): Promise<ActionResult> {
  const sources = validateIncomeSources(incomeSources);
  if (!sources) return { ok: false, error: "Income sources are malformed." };
  const lines = validateTaxLines(taxLines);
  if (!lines) return { ok: false, error: "Tax lines are malformed." };
  const gross = sumIncomeSources(sources);
  if (!validAmount(gross)) return { ok: false, error: "Combined gross income is out of range." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("budget_profile")
    .upsert(
      { gross_annual: gross, tax_lines: lines, income_sources: sources },
      { onConflict: "user_id" },
    );
  revalidatePath("/budget");
  return { ok: !error, error: error?.message };
}

/** Add (id=null) or update a savings goal (a simple monthly commitment). */
export async function upsertGoal(
  id: string | null,
  name: string,
  monthlyAmount: number,
): Promise<ActionResult> {
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed || trimmed.length > 80) return { ok: false, error: "Goal needs a name (max 80 chars)." };
  if (!validAmount(monthlyAmount)) return { ok: false, error: "Monthly amount must be non-negative." };

  const supabase = await createClient();
  const amount = Math.round(monthlyAmount * 100) / 100;
  const { error } = id
    ? await supabase.from("savings_goals").update({ name: trimmed, monthly_amount: amount }).eq("id", id)
    : await supabase.from("savings_goals").insert({ name: trimmed, monthly_amount: amount });
  revalidatePath("/budget");
  return { ok: !error, error: error?.message };
}

export async function deleteGoal(id: string): Promise<ActionResult> {
  if (typeof id !== "string" || !id) return { ok: false, error: "Missing goal id." };
  const supabase = await createClient();
  const { error } = await supabase.from("savings_goals").delete().eq("id", id);
  revalidatePath("/budget");
  return { ok: !error, error: error?.message };
}

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
