import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCategoryAverages } from "@/lib/data/insights";
import type { IncomeSource, TaxLine } from "@/lib/budget-math";

export type BudgetCategory = {
  category: string;
  monthly_limit: number;
  flow_type: "expense" | "income";
};

export type BudgetProfile = {
  gross_annual: number;
  tax_lines: TaxLine[];
  income_sources: IncomeSource[];
};

export type SavingsGoal = {
  id: string;
  name: string;
  monthly_amount: number;
};

export type BudgetData = {
  categories: BudgetCategory[];
  income: number; // user's estimate (0 if unset)
  averages: Record<string, number>; // historical monthly avg per category
  avgIncome: number; // historical monthly income avg
  profile: BudgetProfile | null; // null until the cascade is first saved
  goals: SavingsGoal[];
};

/** Coerce a jsonb value into well-formed tax lines; anything malformed → []. */
function parseTaxLines(raw: unknown): TaxLine[] {
  if (!Array.isArray(raw)) return [];
  const lines: TaxLine[] = [];
  for (const l of raw) {
    const { name, kind, value } = (l ?? {}) as Record<string, unknown>;
    if (typeof name !== "string") return [];
    if (kind !== "percent" && kind !== "amount") return [];
    if (typeof value !== "number" || !Number.isFinite(value)) return [];
    lines.push({ name, kind, value });
  }
  return lines;
}

/** Coerce a jsonb value into well-formed income sources; malformed → []. */
function parseIncomeSources(raw: unknown): IncomeSource[] {
  if (!Array.isArray(raw)) return [];
  const sources: IncomeSource[] = [];
  for (const s of raw) {
    const { name, amount } = (s ?? {}) as Record<string, unknown>;
    if (typeof name !== "string") return [];
    if (typeof amount !== "number" || !Number.isFinite(amount)) return [];
    sources.push({ name, amount });
  }
  return sources;
}

export async function getBudget(): Promise<BudgetData> {
  const supabase = await createClient();

  const [{ data: cats }, { data: incomeRow }, avgs, { data: profileRow }, { data: goalRows }] =
    await Promise.all([
      supabase.from("budget_categories").select("category, monthly_limit, flow_type").order("category"),
      supabase.from("budget_income").select("monthly_estimate").maybeSingle(),
      getCategoryAverages(),
      // `*` so the row still loads when migration 0005 (income_sources) has
      // not been applied yet — the missing column just parses to [].
      supabase.from("budget_profile").select("*").maybeSingle(),
      supabase
        .from("savings_goals")
        .select("id, name, monthly_amount")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

  const categories = (cats ?? []).map((c) => {
    const row = c as unknown as { category: string; monthly_limit: string | number; flow_type: "expense" | "income" };
    return { category: row.category, monthly_limit: Number(row.monthly_limit), flow_type: row.flow_type };
  });

  const income = incomeRow ? Number((incomeRow as { monthly_estimate: string | number }).monthly_estimate) : 0;

  // Before migration 0003 is applied these selects error and return null —
  // profile stays null and the page falls back to pre-cascade behavior.
  let profile: BudgetProfile | null = null;
  if (profileRow) {
    const row = profileRow as {
      gross_annual: string | number;
      tax_lines: unknown;
      income_sources?: unknown;
    };
    const gross = Number(row.gross_annual);
    const sources = parseIncomeSources(row.income_sources);
    profile = {
      gross_annual: gross,
      tax_lines: parseTaxLines(row.tax_lines),
      // Profiles saved before itemized sources existed become one line.
      income_sources: sources.length > 0 ? sources : gross > 0 ? [{ name: "Salary", amount: gross }] : [],
    };
  }

  const goals = (goalRows ?? []).map((g) => {
    const row = g as unknown as { id: string; name: string; monthly_amount: string | number };
    return { id: row.id, name: row.name, monthly_amount: Number(row.monthly_amount) };
  });

  return { categories, income, averages: avgs.byCategory, avgIncome: avgs.income, profile, goals };
}
