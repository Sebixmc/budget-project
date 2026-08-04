"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteAllTransactions } from "./actions";

export function DataCard({ txCount }: { txCount: number }) {
  const [confirmText, setConfirmText] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function wipe() {
    setNote("");
    startTransition(async () => {
      const res = await deleteAllTransactions();
      setNote(res.ok ? "All transactions deleted." : (res.error ?? "Couldn't delete."));
      setConfirmText("");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          Download everything Ledger has for you — accounts, transactions, rules, budgets, and
          goals — as a single JSON file.
        </p>
        <div>
          <Button asChild variant="outline" size="sm">
            {/* A plain link so the browser handles the file download. */}
            <a href="/settings/export" download>
              <Download /> Export all my data
            </a>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-negative/30 bg-negative/5 p-4">
        <div className="flex items-center gap-2 text-negative">
          <AlertTriangle className="size-4" />
          <span className="text-sm font-semibold">Danger zone</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Delete all {txCount} of your transactions. Accounts, rules, and budget targets are kept —
          but the transactions themselves can only be recovered by re-uploading your CSVs. Type{" "}
          <span className="font-mono font-medium text-foreground">DELETE</span> to confirm.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            className="h-8 max-w-[10rem]"
            aria-label="Type DELETE to confirm"
          />
          <Button
            variant="destructive"
            size="sm"
            disabled={confirmText !== "DELETE" || pending || txCount === 0}
            onClick={wipe}
          >
            {pending ? "Deleting…" : "Delete all transactions"}
          </Button>
        </div>
        {note && <p className="mt-2 text-sm text-foreground">{note}</p>}
      </div>
    </div>
  );
}
