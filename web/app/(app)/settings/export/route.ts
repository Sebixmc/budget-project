import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /settings/export — download every row the signed-in user owns as a JSON
 * file. Runs with the user's session so RLS scopes each query to their rows;
 * no other user's data can appear here.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const [accounts, transactions, merchant_rules, budget_categories, budget_income, goals] =
    await Promise.all([
      supabase.from("accounts").select("*"),
      supabase.from("transactions").select("*"),
      supabase.from("merchant_rules").select("*"),
      supabase.from("budget_categories").select("*"),
      supabase.from("budget_income").select("*"),
      supabase.from("goals").select("*"),
    ]);

  const payload = {
    exported_for: user.email,
    accounts: accounts.data ?? [],
    transactions: transactions.data ?? [],
    merchant_rules: merchant_rules.data ?? [],
    budget_categories: budget_categories.data ?? [],
    budget_income: budget_income.data ?? [],
    goals: goals.data ?? [],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="ledger-export.json"',
      "Cache-Control": "no-store",
    },
  });
}
