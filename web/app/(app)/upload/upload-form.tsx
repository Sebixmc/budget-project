"use client";

import { useActionState } from "react";
import { CheckCircle2, AlertCircle, Upload } from "lucide-react";
import { uploadCsv, type UploadResult } from "./actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { TriagePanel } from "@/components/app/triage-panel";
import { BANK_FORMATS, type BankFormat } from "@/lib/parser";
import type { Account } from "@/lib/data/accounts";

export function UploadForm({ accounts }: { accounts: Account[] }) {
  const [result, action, pending] = useActionState<UploadResult | null, FormData>(
    uploadCsv,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Account</span>
        <Select name="accountId" required defaultValue="">
          <option value="" disabled>
            Select an account…
          </option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} — {BANK_FORMATS[a.bank_format as BankFormat] ?? a.bank_format}
            </option>
          ))}
        </Select>
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">CSV file</span>
        <input
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-accent"
        />
      </label>

      <Button type="submit" disabled={pending} className="self-start">
        <Upload /> {pending ? "Importing…" : "Import"}
      </Button>

      {result?.ok && (
        <p className="flex items-center gap-2 text-sm text-positive">
          <CheckCircle2 className="size-4" />
          Imported {result.imported} transaction{result.imported === 1 ? "" : "s"}
          {result.skipped ? ` · skipped ${result.skipped} duplicate${result.skipped === 1 ? "" : "s"}` : ""}.
        </p>
      )}
      {result && !result.ok && (
        <p className="flex items-center gap-2 text-sm text-negative">
          <AlertCircle className="size-4" />
          {result.error}
        </p>
      )}

      {result?.ok && result.triage && result.triage.length > 0 && (
        // Keyed by batch so a new import starts the triage fresh.
        <TriagePanel key={result.batch} groups={result.triage} />
      )}
    </form>
  );
}
