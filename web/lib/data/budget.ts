import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCategoryAverages } from "@/lib/data/insights";

export type BudgetCategory = {
  category: string;
  monthly_limit: number;
  flow_type: "expense" | "income";
};

export type BudgetData = {
  categories: BudgetCategory[];
  income: number; // user's estimate (0 if unset)
  averages: Record<string, number>; // historical monthly avg per category
  avgIncome: number; // historical monthly income avg
};

export async function getBudget(): Promise<BudgetData> {
  const supabase = await createClient();

  const [{ data: cats }, { data: incomeRow }, avgs] = await Promise.all([
    supabase.from("budget_categories").select("category, monthly_limit, flow_type").order("category"),
    supabase.from("budget_income").select("monthly_estimate").maybeSingle(),
    getCategoryAverages(),
  ]);

  const categories = (cats ?? []).map((c) => {
    const row = c as unknown as { category: string; monthly_limit: string | number; flow_type: "expense" | "income" };
    return { category: row.category, monthly_limit: Number(row.monthly_limit), flow_type: row.flow_type };
  });

  const income = incomeRow ? Number((incomeRow as { monthly_estimate: string | number }).monthly_estimate) : 0;

  return { categories, income, averages: avgs.byCategory, avgIncome: avgs.income };
}
