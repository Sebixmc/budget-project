import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Flow = "debit" | "credit";

export type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  flow: Flow;
  category: string;
  category_source: "auto" | "manual";
  notes: string;
  account_id: string;
  account_name: string;
};

export type TransactionFilters = {
  month?: string; // YYYY-MM
  accountId?: string;
  category?: string;
  flow?: Flow;
  search?: string;
  hideTransfers?: boolean;
};

/** First day of the month after `month` (YYYY-MM) — used for a half-open date range. */
function nextMonthStart(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-01`;
}

/**
 * The user's transactions, filtered. The raw list may include transfers (there
 * is a hide-transfers toggle); it's the money AGGREGATIONS elsewhere that must
 * always exclude category='Transfer' (hard rule #3).
 */
export async function getTransactions(filters: TransactionFilters): Promise<Transaction[]> {
  const supabase = await createClient();
  let query = supabase
    .from("transactions")
    .select("id, date, description, amount, flow, category, category_source, notes, account_id, accounts(name)")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1000);

  if (filters.month) {
    query = query.gte("date", `${filters.month}-01`).lt("date", nextMonthStart(filters.month));
  }
  if (filters.accountId) query = query.eq("account_id", filters.accountId);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.flow) query = query.eq("flow", filters.flow);
  if (filters.hideTransfers) query = query.neq("category", "Transfer");
  if (filters.search) query = query.ilike("description", `%${filters.search}%`);

  const { data } = await query;
  return (data ?? []).map((r) => {
    const row = r as unknown as {
      id: string;
      date: string;
      description: string;
      amount: string | number;
      flow: Flow;
      category: string;
      category_source: "auto" | "manual";
      notes: string;
      account_id: string;
      accounts: { name: string } | null;
    };
    return {
      id: row.id,
      date: row.date,
      description: row.description,
      amount: Number(row.amount),
      flow: row.flow,
      category: row.category,
      category_source: row.category_source,
      notes: row.notes ?? "",
      account_id: row.account_id,
      account_name: row.accounts?.name ?? "—",
    };
  });
}
