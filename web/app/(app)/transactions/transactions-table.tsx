"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import { ALL_CATEGORIES } from "@/lib/categorizer";
import { cleanMerchantPattern } from "@/lib/merchant";
import type { Transaction } from "@/lib/data/transactions";
import { RulePrompt } from "@/components/app/rule-prompt";
import { bulkCategory, updateCategory, updateNotes } from "./actions";

/** The active save-as-rule prompt, shown in a floating panel pinned to the
 *  bottom of the viewport — filters and refreshes can't dislodge it. `key`
 *  remounts the prompt so each edit starts fresh. */
type PromptState = {
  key: number;
  pattern: string;
  category: string;
};

export function TransactionsTable({ transactions }: { transactions: Transaction[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCat, setBulkCat] = useState("");
  const [prompt, setPrompt] = useState<PromptState | null>(null);

  const allChecked = transactions.length > 0 && selected.size === transactions.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(transactions.map((t) => t.id)));
  }

  function onCategory(t: Transaction, category: string) {
    startTransition(async () => {
      await updateCategory(t.id, category);
      router.refresh();
      // The edit is saved either way; offer to make it a rule. The prompt
      // floats above the viewport, so the row filtering itself out of the
      // list on refresh doesn't disturb it. A new edit replaces any prompt
      // already open (only one at a time).
      const pattern = cleanMerchantPattern(t.description);
      setPrompt(pattern ? { key: Date.now(), pattern, category } : null);
    });
  }

  function onNotes(id: string, notes: string, original: string) {
    if (notes === original) return;
    startTransition(async () => {
      await updateNotes(id, notes);
      router.refresh();
    });
  }

  function applyBulk() {
    if (!bulkCat || selected.size === 0) return;
    const ids = [...selected];
    const category = bulkCat;
    // Offer a rule only when every selected row shares one cleaned pattern.
    const patterns = new Set(
      transactions.filter((t) => selected.has(t.id)).map((t) => cleanMerchantPattern(t.description)),
    );
    const shared = patterns.size === 1 ? [...patterns][0] : "";
    startTransition(async () => {
      await bulkCategory(ids, category);
      setSelected(new Set());
      setBulkCat("");
      router.refresh();
      setPrompt(shared ? { key: Date.now(), pattern: shared, category } : null);
    });
  }

  /** Dismiss the prompt identified by `key` — a stale confirmation timer from
   *  a replaced prompt must not close the one currently open. */
  function dismissPrompt(key: number) {
    setPrompt((p) => (p?.key === key ? null : p));
  }

  // Floating, non-blocking panel pinned to the bottom of the viewport: it
  // stays put while the list scrolls or re-filters (the edit that opened it
  // often removes its own row from the filtered results).
  const promptOverlay = prompt && (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-2xl" role="dialog" aria-label="Save as rule">
        <RulePrompt
          key={prompt.key}
          initialPattern={prompt.pattern}
          category={prompt.category}
          onDismiss={() => dismissPrompt(prompt.key)}
          onSaved={() => router.refresh()}
        />
      </div>
    </div>
  );

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {promptOverlay}
        <p className="py-10 text-center text-sm text-muted-foreground">No transactions match these filters.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {promptOverlay}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/50 p-3">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="w-52">
            <Select value={bulkCat} onChange={(e) => setBulkCat(e.target.value)}>
              <option value="">Set category…</option>
              {ALL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <Button size="sm" onClick={applyBulk} disabled={!bulkCat || pending}>
            Apply
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b border-border">
              <th className="w-8 py-2">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Select all" />
              </th>
              <th className="py-2 pr-3 font-medium">Date</th>
              <th className="py-2 pr-3 font-medium">Description</th>
              <th className="py-2 pr-3 font-medium">Account</th>
              <th className="py-2 pr-3 font-medium">Category</th>
              <th className="py-2 pr-3 font-medium">Notes</th>
              <th className="py-2 pl-3 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className="border-b border-border/60 last:border-0">
                <td className="py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(t.id)}
                    onChange={() => toggle(t.id)}
                    aria-label={`Select ${t.description}`}
                  />
                </td>
                <td className="tabular whitespace-nowrap py-2 pr-3 text-muted-foreground">{t.date}</td>
                <td className="py-2 pr-3">
                  <span className="flex items-center gap-1.5">
                    {t.description}
                    {t.category_source === "manual" && (
                      <Pencil className="size-3 text-muted-foreground" aria-label="Manually categorized" />
                    )}
                  </span>
                </td>
                <td className="whitespace-nowrap py-2 pr-3 text-muted-foreground">{t.account_name}</td>
                <td className="py-2 pr-3">
                  <div className="w-40">
                    <Select
                      value={t.category}
                      onChange={(e) => onCategory(t, e.target.value)}
                      disabled={pending}
                    >
                      {ALL_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </div>
                </td>
                <td className="py-2 pr-3">
                  <input
                    defaultValue={t.notes}
                    placeholder="—"
                    onBlur={(e) => onNotes(t.id, e.target.value, t.notes)}
                    className="h-8 w-36 rounded-md border border-transparent bg-transparent px-2 text-sm outline-none hover:border-input focus:border-input focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </td>
                <td
                  className={cn(
                    "tabular whitespace-nowrap py-2 pl-3 text-right font-medium",
                    t.flow === "credit" ? "text-positive" : "text-foreground",
                  )}
                >
                  {t.flow === "credit" ? "+" : "−"}
                  {formatCurrency(t.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
