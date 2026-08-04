import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SunburstRow } from "@/lib/charts/sunburst-data";

/**
 * All money aggregations live here, and they ALL exclude category='Transfer'
 * (hard rule #3). Amounts are positive; `flow` gives direction — debit is
 * spending, credit is income.
 */

type Row = { date: string; description: string; amount: number; flow: "debit" | "credit"; category: string };

async function fetchNonTransferRows(accountId?: string): Promise<Row[]> {
  const supabase = await createClient();
  let query = supabase
    .from("transactions")
    .select("date, description, amount, flow, category")
    .neq("category", "Transfer"); // hard rule #3
  if (accountId) query = query.eq("account_id", accountId);
  const { data } = await query.limit(20000);
  return (data ?? []).map((r) => {
    const row = r as unknown as Omit<Row, "amount"> & { amount: string | number };
    return { ...row, amount: Number(row.amount) };
  });
}

function monthOf(date: string): string {
  return date.slice(0, 7); // YYYY-MM
}

export type Insights = {
  totalSpent: number;
  totalIncome: number;
  net: number;
  txCount: number;
  byCategory: { category: string; amount: number; pct: number }[];
  topMerchants: { description: string; amount: number }[];
  monthlyTotals: { month: string; spent: number }[];
};

export async function getInsights(filters: { month?: string; accountId?: string }): Promise<Insights> {
  const rows = await fetchNonTransferRows(filters.accountId);

  // Monthly spend across ALL months (last 13), independent of the month filter.
  const spendByMonth = new Map<string, number>();
  for (const r of rows) {
    if (r.flow !== "debit") continue;
    spendByMonth.set(monthOf(r.date), (spendByMonth.get(monthOf(r.date)) ?? 0) + r.amount);
  }
  const monthlyTotals = [...spendByMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-13)
    .map(([month, spent]) => ({ month, spent: round2(spent) }));

  // Scope the rest to the selected month (or all time).
  const scoped = filters.month ? rows.filter((r) => monthOf(r.date) === filters.month) : rows;

  let totalSpent = 0;
  let totalIncome = 0;
  const catMap = new Map<string, number>();
  const merchantMap = new Map<string, number>();
  for (const r of scoped) {
    if (r.flow === "debit") {
      totalSpent += r.amount;
      catMap.set(r.category, (catMap.get(r.category) ?? 0) + r.amount);
      merchantMap.set(r.description, (merchantMap.get(r.description) ?? 0) + r.amount);
    } else {
      totalIncome += r.amount;
    }
  }

  const byCategory = [...catMap.entries()]
    .map(([category, amount]) => ({
      category,
      amount: round2(amount),
      pct: totalSpent ? Math.round((amount / totalSpent) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const topMerchants = [...merchantMap.entries()]
    .map(([description, amount]) => ({ description, amount: round2(amount) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 15);

  return {
    totalSpent: round2(totalSpent),
    totalIncome: round2(totalIncome),
    net: round2(totalIncome - totalSpent),
    txCount: scoped.length,
    byCategory,
    topMerchants,
    monthlyTotals,
  };
}

/** Rows for the Dashboard sunburst, in the same scope as getInsights and
 *  Transfer-free (hard rule #3). The client chart builds the tree. */
export async function getSunburstRows(filters: {
  month?: string;
  accountId?: string;
}): Promise<SunburstRow[]> {
  const rows = await fetchNonTransferRows(filters.accountId);
  const scoped = filters.month ? rows.filter((r) => monthOf(r.date) === filters.month) : rows;
  return scoped.map(({ description, amount, flow, category }) => ({
    description,
    amount,
    flow,
    category,
  }));
}

export type MonthlyReport = {
  month: string;
  spent: number;
  income: number;
  net: number;
  avgSpent: number;
  avgIncome: number;
  trend: { month: string; spent: number; income: number }[];
  categories: { category: string; amount: number; avg: number; delta: number }[];
};

export async function getMonthlyReport(month: string, accountId?: string): Promise<MonthlyReport> {
  const rows = await fetchNonTransferRows(accountId);

  const byMonth = new Map<string, { spent: number; income: number }>();
  const catByMonth = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const m = monthOf(r.date);
    const bucket = byMonth.get(m) ?? { spent: 0, income: 0 };
    if (r.flow === "debit") {
      bucket.spent += r.amount;
      const cm = catByMonth.get(m) ?? new Map<string, number>();
      cm.set(r.category, (cm.get(r.category) ?? 0) + r.amount);
      catByMonth.set(m, cm);
    } else {
      bucket.income += r.amount;
    }
    byMonth.set(m, bucket);
  }

  const months = [...byMonth.keys()].sort();
  const trend = months.map((m) => ({
    month: m,
    spent: round2(byMonth.get(m)!.spent),
    income: round2(byMonth.get(m)!.income),
  }));

  const monthCount = months.length || 1;
  const avgSpent = round2(trend.reduce((s, t) => s + t.spent, 0) / monthCount);
  const avgIncome = round2(trend.reduce((s, t) => s + t.income, 0) / monthCount);

  const current = byMonth.get(month) ?? { spent: 0, income: 0 };

  // Per-category: this month vs the all-month average for that category.
  const catAvg = new Map<string, number>();
  for (const cm of catByMonth.values()) {
    for (const [cat, amt] of cm) catAvg.set(cat, (catAvg.get(cat) ?? 0) + amt);
  }
  const thisMonthCats = catByMonth.get(month) ?? new Map<string, number>();
  const categories = [...new Set([...thisMonthCats.keys(), ...catAvg.keys()])]
    .map((category) => {
      const amount = round2(thisMonthCats.get(category) ?? 0);
      const avg = round2((catAvg.get(category) ?? 0) / monthCount);
      return { category, amount, avg, delta: round2(amount - avg) };
    })
    .filter((c) => c.amount > 0 || c.avg > 0)
    .sort((a, b) => b.amount - a.amount);

  return {
    month,
    spent: round2(current.spent),
    income: round2(current.income),
    net: round2(current.income - current.spent),
    avgSpent,
    avgIncome,
    trend,
    categories,
  };
}

/** All-time monthly averages per spending category + monthly income average.
 *  Used by the Budget planner as the historical reference. Excludes transfers. */
export async function getCategoryAverages(
  accountId?: string,
): Promise<{ byCategory: Record<string, number>; income: number }> {
  const rows = await fetchNonTransferRows(accountId);
  const months = new Set(rows.map((r) => monthOf(r.date)));
  const n = months.size || 1;
  const cat = new Map<string, number>();
  let income = 0;
  for (const r of rows) {
    if (r.flow === "debit") cat.set(r.category, (cat.get(r.category) ?? 0) + r.amount);
    else income += r.amount;
  }
  const byCategory: Record<string, number> = {};
  for (const [c, amt] of cat) byCategory[c] = round2(amt / n);
  return { byCategory, income: round2(income / n) };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
