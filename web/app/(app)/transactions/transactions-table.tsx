"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Pencil } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import { cleanMerchantPattern } from "@/lib/merchant";
import type { Transaction } from "@/lib/data/transactions";
import { RulePrompt } from "@/components/app/rule-prompt";
import { bulkCategory, updateCategory, updateNotes } from "./actions";

/** The active save-as-rule prompt queue, shown one item at a time in a
 *  floating panel pinned to the bottom of the viewport — filters and
 *  refreshes can't dislodge it, and each answered item is replaced in place
 *  by the next so the buttons never move. A single edit is a queue of one;
 *  a bulk apply queues one item per distinct cleaned merchant. */
type PromptItem = { pattern: string; category: string };
type PromptState = {
  key: number;
  queue: PromptItem[];
  index: number;
};

type SortKey = "date" | "description" | "account" | "category" | "amount";
type SortState = { key: SortKey; dir: "asc" | "desc" };

function sortValue(t: Transaction, key: SortKey): string | number {
  if (key === "amount") return t.amount;
  if (key === "account") return t.account_name;
  return t[key];
}

export function TransactionsTable({
  transactions,
  categories,
}: {
  transactions: Transaction[];
  categories: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCat, setBulkCat] = useState("");
  const [prompt, setPrompt] = useState<PromptState | null>(null);
  // Click a column header to sort: first click descending (largest/newest
  // first), second flips ascending. null → the server's default (date desc).
  const [sort, setSort] = useState<SortState | null>(null);

  function onSort(key: SortKey) {
    setSort((s) =>
      s?.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" },
    );
  }

  const rows = useMemo(() => {
    if (!sort) return transactions;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...transactions].sort((a, b) => {
      const va = sortValue(a, sort.key);
      const vb = sortValue(b, sort.key);
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), undefined, { sensitivity: "base" });
      // Tiebreak: newest first, matching the default order.
      return cmp * dir || b.date.localeCompare(a.date);
    });
  }, [transactions, sort]);

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
      setPrompt(pattern ? { key: Date.now(), queue: [{ pattern, category }], index: 0 } : null);
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
    // Queue one rule prompt per distinct cleaned merchant in the selection,
    // biggest group first, so every merchant in the bulk gets its own ask.
    const groups = new Map<string, number>();
    for (const t of transactions) {
      if (!selected.has(t.id)) continue;
      const pattern = cleanMerchantPattern(t.description);
      if (pattern) groups.set(pattern, (groups.get(pattern) ?? 0) + 1);
    }
    const queue = [...groups.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([pattern]): PromptItem => ({ pattern, category }));
    startTransition(async () => {
      await bulkCategory(ids, category);
      setSelected(new Set());
      setBulkCat("");
      router.refresh();
      setPrompt(queue.length > 0 ? { key: Date.now(), queue, index: 0 } : null);
    });
  }

  /** Advance past queue item `index` (answered or skipped): the next item
   *  fills the same spot, or the panel closes after the last one. The key +
   *  index guard keeps a stale confirmation timer from touching a newer
   *  prompt. */
  function advancePrompt(key: number, index: number) {
    setPrompt((p) => {
      if (p?.key !== key || p.index !== index) return p;
      return p.index + 1 < p.queue.length ? { ...p, index: p.index + 1 } : null;
    });
  }

  /** Close the whole queue ("Skip all"). */
  function dismissAll(key: number) {
    setPrompt((p) => (p?.key === key ? null : p));
  }

  // Floating, non-blocking panel pinned to the bottom of the viewport: it
  // stays put while the list scrolls or re-filters (the edit that opened it
  // often removes its own row from the filtered results).
  const current = prompt?.queue[prompt.index];
  const promptOverlay = prompt && current && (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-2xl" role="dialog" aria-label="Save as rule">
        <RulePrompt
          key={`${prompt.key}:${prompt.index}`}
          initialPattern={current.pattern}
          category={current.category}
          progress={{ current: prompt.index + 1, total: prompt.queue.length }}
          // Mid-queue, saving advances instantly so the next item lands under
          // the cursor; the brief confirmation shows only on the last item.
          confirmInline={prompt.index === prompt.queue.length - 1}
          onDismiss={() => advancePrompt(prompt.key, prompt.index)}
          onDismissAll={
            prompt.index + 1 < prompt.queue.length ? () => dismissAll(prompt.key) : undefined
          }
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
              {categories.map((c) => (
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
              <SortHeader label="Date" k="date" sort={sort} onSort={onSort} />
              <SortHeader label="Description" k="description" sort={sort} onSort={onSort} />
              <SortHeader label="Account" k="account" sort={sort} onSort={onSort} />
              <SortHeader label="Category" k="category" sort={sort} onSort={onSort} />
              <th className="py-2 pr-3 font-medium">Notes</th>
              <SortHeader label="Amount" k="amount" sort={sort} onSort={onSort} alignRight />
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
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
                      {categories.map((c) => (
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

/** Clickable column header: descending on first click, toggling after; the
 *  active column shows a direction arrow. */
function SortHeader({
  label,
  k,
  sort,
  onSort,
  alignRight = false,
}: {
  label: string;
  k: SortKey;
  sort: SortState | null;
  onSort: (key: SortKey) => void;
  alignRight?: boolean;
}) {
  const active = sort?.key === k;
  return (
    <th
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
      className={cn("py-2 font-medium", alignRight ? "pl-3 text-right" : "pr-3")}
    >
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn(
          "inline-flex items-center gap-1 font-medium transition-colors hover:text-foreground",
          active && "text-foreground",
          alignRight && "flex-row-reverse",
        )}
      >
        {label}
        {active &&
          (sort.dir === "desc" ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
      </button>
    </th>
  );
}
