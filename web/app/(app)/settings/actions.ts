"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { BANK_FORMATS } from "@/lib/parser";

function validBankFormat(v: string): boolean {
  return v in BANK_FORMATS;
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
