"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Wand2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { ALL_CATEGORIES } from "@/lib/categorizer";
import type { TriageGroup } from "@/app/(app)/upload/actions";
import { createRuleAndApply } from "@/app/(app)/rules/actions";
import { bulkCategory } from "@/app/(app)/transactions/actions";

type Resolved = { category: string; fixed: number; ruled: boolean };

/**
 * Post-upload triage: the user's still-uncategorized transactions grouped by
 * merchant. One category pick per group saves a rule and fixes every matching
 * transaction; "categorize without saving a rule" handles genuine one-offs;
 * Skip hides a group for this visit (specs/rule-triage-flows.md).
 */
export function TriagePanel({ groups }: { groups: TriageGroup[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [resolved, setResolved] = useState<Record<string, Resolved>>({});
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [noRule, setNoRule] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = groups.filter((g) => !resolved[g.pattern] && !skipped.has(g.pattern));
  const done = groups.filter((g) => resolved[g.pattern]);
  const uncategorized = groups.reduce((n, g) => n + g.count, 0);

  function toggleNoRule(pattern: string) {
    setNoRule((prev) => {
      const next = new Set(prev);
      if (next.has(pattern)) next.delete(pattern);
      else next.add(pattern);
      return next;
    });
  }

  function pick(group: TriageGroup, category: string) {
    if (!category || busy) return;
    setBusy(group.pattern);
    setError(null);
    startTransition(async () => {
      try {
        if (noRule.has(group.pattern)) {
          // Genuine one-off: categorize just these rows (marked manual), no rule.
          const res = await bulkCategory(group.ids, category);
          if (!res.ok) throw new Error(res.error || "Could not categorize.");
          setResolved((prev) => ({
            ...prev,
            [group.pattern]: { category, fixed: group.ids.length, ruled: false },
          }));
        } else {
          const res = await createRuleAndApply(group.pattern, category);
          if (!res.ok) throw new Error(res.error || "Could not save the rule.");
          setResolved((prev) => ({
            ...prev,
            [group.pattern]: { category, fixed: res.updated, ruled: true },
          }));
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setBusy(null);
      }
    });
  }

  if (groups.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="mb-1 flex items-center gap-2 text-sm font-medium">
        <Wand2 className="size-4 text-muted-foreground" />
        {uncategorized} uncategorized across {groups.length} merchant
        {groups.length === 1 ? "" : "s"}
      </div>
      <p className="text-xs text-muted-foreground">
        Pick a category once per merchant — it saves a rule and fixes every matching transaction.
      </p>

      <ul className="mt-2 divide-y divide-border/60">
        {done.map((g) => {
          const r = resolved[g.pattern];
          return (
            <li key={g.pattern} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
              <CheckCircle2 className="size-4 text-positive" />
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{g.pattern}</code>
              <Badge variant="outline">{r.category}</Badge>
              <span className="text-muted-foreground">
                · {r.fixed} fixed{r.ruled ? "" : " (no rule saved)"}
              </span>
            </li>
          );
        })}

        {open.map((g) => (
          <li key={g.pattern} className="flex flex-wrap items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{g.pattern}</code>
                <span className="text-xs text-muted-foreground">
                  {g.count} transaction{g.count === 1 ? "" : "s"} · {formatCurrency(g.total)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => toggleNoRule(g.pattern)}
                aria-pressed={noRule.has(g.pattern)}
                className="mt-0.5 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                {noRule.has(g.pattern)
                  ? "won't save a rule — categorize these rows only (undo)"
                  : "categorize without saving a rule"}
              </button>
            </div>
            <div className="w-44">
              <Select
                value=""
                aria-label={`Category for ${g.pattern}`}
                onChange={(e) => pick(g, e.target.value)}
                disabled={busy !== null}
              >
                <option value="" disabled>
                  {busy === g.pattern ? "Saving…" : "Pick a category…"}
                </option>
                {ALL_CATEGORIES.filter((c) => c !== "Other").map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setSkipped((prev) => new Set(prev).add(g.pattern))}
              disabled={busy !== null}
            >
              Skip
            </Button>
          </li>
        ))}
      </ul>

      {open.length === 0 && (
        <p className="mt-2 flex items-center gap-2 text-sm text-positive">
          <CheckCircle2 className="size-4" />
          All caught up — every merchant handled.
        </p>
      )}
      {error && <p className="mt-2 text-sm text-negative">{error}</p>}
    </div>
  );
}
