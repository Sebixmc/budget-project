"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { BANK_FORMATS } from "@/lib/parser";
import { validateCreate, validateDelete, validateRename } from "@/lib/categories";
import { getSelectableCategories } from "@/lib/data/categories";
import { isValidDefaultPage } from "@/lib/settings";

function validBankFormat(v: string): boolean {
  return v in BANK_FORMATS;
}

/** Revalidate every page that reads categorized transactions. */
function revalidateMoneyViews() {
  revalidatePath("/settings");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/monthly");
  revalidatePath("/budget");
}

export async function createAccount(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const owner = String(formData.get("owner") || "").trim();
  const type = String(formData.get("type") || "checking").trim();
  const bank_format = String(formData.get("bank_format") || "capital_one_bank");
  if (!name || !validBankFormat(bank_format)) return;

  const supabase = await createClient();
  await supabase.from("accounts").insert({ name, owner, type, bank_format });
  revalidatePath("/settings");
}

export async function updateAccount(formData: FormData) {
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const owner = String(formData.get("owner") || "").trim();
  const bank_format = String(formData.get("bank_format") || "");
  if (!id || !name || !validBankFormat(bank_format)) return;

  const supabase = await createClient();
  await supabase.from("accounts").update({ name, owner, bank_format }).eq("id", id);
  revalidatePath("/settings");
}

/** Delete an account; its transactions and uploads cascade (FK on delete cascade). */
export async function deleteAccount(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("accounts").delete().eq("id", id);
  revalidatePath("/settings");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export type ActionResult = { ok: boolean; error?: string };

/**
 * Create a user-defined category. Validated against every existing category
 * (built-in, custom, or in-use) so names can't collide or shadow a reserved
 * one. Persisted in `user_categories` so it survives with zero transactions;
 * RLS scopes the write to the user. Auto-categorization is untouched — a custom
 * category has no keywords, so imports never auto-assign to it.
 */
export async function createCategory(name: string): Promise<ActionResult> {
  const n = name.trim();
  const existing = await getSelectableCategories();
  const invalid = validateCreate(n, existing);
  if (invalid) {
    const msg =
      invalid === "reserved"
        ? "That name is reserved."
        : invalid === "duplicate"
          ? "That category already exists."
          : "Enter a category name.";
    return { ok: false, error: msg };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("user_categories").insert({ name: n });
  if (error) return { ok: false, error: error.message };

  revalidateMoneyViews();
  return { ok: true };
}

/**
 * Rename category `oldName` → `newName` across all of the user's data. If
 * `newName` already exists this is a MERGE: transactions/rules move over and the
 * existing budget target for `newName` is kept. Never touches `Transfer`
 * (hard rule #3). RLS scopes every write to the user.
 */
export async function renameCategory(oldName: string, newName: string): Promise<ActionResult> {
  const from = oldName.trim();
  const to = newName.trim();
  const invalid = validateRename(from, to);
  if (invalid) {
    const msg =
      invalid === "reserved-source" || invalid === "reserved-target"
        ? "Transfer can't be renamed — it's excluded from all spending totals."
        : invalid === "same"
          ? "That's already the category name."
          : "Enter a category name.";
    return { ok: false, error: msg };
  }

  const supabase = await createClient();

  const { error: txErr } = await supabase
    .from("transactions")
    .update({ category: to })
    .eq("category", from);
  if (txErr) return { ok: false, error: txErr.message };

  await supabase.from("merchant_rules").update({ category: to }).eq("category", from);

  // budget_categories PK is (user_id, category): a plain rename collides if a
  // `to` row already exists, so merge by dropping the old row in that case.
  const { data: existingTarget } = await supabase
    .from("budget_categories")
    .select("category")
    .eq("category", to)
    .maybeSingle();
  if (existingTarget) {
    await supabase.from("budget_categories").delete().eq("category", from);
  } else {
    await supabase.from("budget_categories").update({ category: to }).eq("category", from);
  }

  // Carry the rename into user_categories too: a custom category can have zero
  // transactions/rules/budget, so its only trace is this row — without this the
  // rename hits nothing and the old name lingers in every dropdown. There's no
  // UPDATE policy on the table (owner-only select/insert/delete), and its PK is
  // (user_id, name), so re-home it as delete-then-insert, skipping the insert
  // when `to` already exists (the merge case).
  const { data: fromCustom } = await supabase
    .from("user_categories")
    .select("name")
    .eq("name", from)
    .maybeSingle();
  if (fromCustom) {
    const { data: toCustom } = await supabase
      .from("user_categories")
      .select("name")
      .eq("name", to)
      .maybeSingle();
    await supabase.from("user_categories").delete().eq("name", from);
    if (!toCustom) await supabase.from("user_categories").insert({ name: to });
  }

  revalidateMoneyViews();
  return { ok: true };
}

/**
 * Delete a category: its transactions and rules are moved to `Other` and its
 * budget target is removed. `Other` and `Transfer` can't be deleted.
 */
export async function deleteCategory(name: string): Promise<ActionResult> {
  const n = name.trim();
  const invalid = validateDelete(n);
  if (invalid) {
    return {
      ok: false,
      error: invalid === "reserved" ? "That category can't be deleted." : "Enter a category name.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .update({ category: "Other" })
    .eq("category", n);
  if (error) return { ok: false, error: error.message };
  await supabase.from("merchant_rules").update({ category: "Other" }).eq("category", n);
  await supabase.from("budget_categories").delete().eq("category", n);
  // Also drop it from the custom-category store, if it was one, so it stops
  // appearing in dropdowns.
  await supabase.from("user_categories").delete().eq("name", n);

  revalidateMoneyViews();
  return { ok: true };
}

/** Set the user's estimated monthly income (single row, keyed by user). */
export async function setMonthlyIncome(estimate: number): Promise<ActionResult> {
  if (!Number.isFinite(estimate) || estimate < 0) return { ok: false, error: "Enter a valid amount." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("budget_income")
    .upsert({ monthly_estimate: estimate }, { onConflict: "user_id" });
  revalidatePath("/settings");
  revalidatePath("/budget");
  return { ok: !error, error: error?.message };
}

/** Persist the user's default landing page (allowlisted). */
export async function updateDefaultPage(page: string): Promise<ActionResult> {
  if (!isValidDefaultPage(page)) return { ok: false, error: "Unknown page." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("user_settings")
    .upsert({ default_page: page }, { onConflict: "user_id" });
  revalidatePath("/settings");
  return { ok: !error, error: error?.message };
}

/**
 * Danger zone: delete ALL of the user's transactions. Accounts, rules, and
 * budgets are left intact. RLS scopes the delete to the user; the id filter is
 * required by supabase-js to permit the delete.
 */
export async function deleteAllTransactions(): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .delete()
    .not("id", "is", null);
  if (error) return { ok: false, error: error.message };
  revalidateMoneyViews();
  return { ok: true };
}
