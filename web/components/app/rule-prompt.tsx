"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, Wand2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { countRuleMatches, createRuleAndApply } from "@/app/(app)/rules/actions";

/**
 * Dismissible "save as rule?" prompt shown after an inline category edit on
 * the Transactions page. Pre-filled with the cleaned merchant pattern
 * (editable) and a live count of the other auto-categorized rows the rule
 * would fix. Saving upserts the rule and recategorizes matching auto rows
 * only; any dismissal makes no changes beyond the already-saved edit
 * (specs/rule-triage-flows.md). Rendered as a floating panel pinned to the
 * viewport by the transactions table, so list refreshes can't dislodge it.
 */
export function RulePrompt({
  initialPattern,
  category,
  onDismiss,
  onSaved,
}: {
  initialPattern: string;
  category: string;
  onDismiss: () => void;
  onSaved?: () => void;
}) {
  const [pattern, setPattern] = useState(initialPattern);
  const [count, setCount] = useState<number | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const requestSeq = useRef(0);

  // Live match count — immediate on open, debounced while the pattern is edited.
  useEffect(() => {
    const trimmed = pattern.trim();
    const seq = ++requestSeq.current;
    if (!trimmed) {
      setCount(0);
      return;
    }
    setCount(null);
    const timer = setTimeout(
      () => {
        countRuleMatches(trimmed).then((n) => {
          if (requestSeq.current === seq) setCount(n);
        });
      },
      seq === 1 ? 0 : 300,
    );
    return () => clearTimeout(timer);
  }, [pattern]);

  function save() {
    if (!pattern.trim() || pending || saved !== null) return;
    setError(null);
    startTransition(async () => {
      const res = await createRuleAndApply(pattern, category);
      if (!res.ok) {
        setError(res.error || "Could not save the rule.");
        return;
      }
      setSaved(res.updated);
      onSaved?.();
      setTimeout(onDismiss, 1800);
    });
  }

  if (saved !== null) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-positive shadow-lg">
        <CheckCircle2 className="size-4" />
        Rule saved — {saved} transaction{saved === 1 ? "" : "s"} recategorized as {category}.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-lg">
      <Wand2 className="size-4 shrink-0 text-muted-foreground" />
      <span className="whitespace-nowrap">Always file</span>
      <Input
        value={pattern}
        onChange={(e) => setPattern(e.target.value)}
        aria-label="Rule pattern"
        className="h-8 w-44 text-sm"
      />
      <span className="whitespace-nowrap">as</span>
      <Badge variant="outline">{category}</Badge>
      <span className="whitespace-nowrap">?</span>
      <div className="ml-auto flex items-center gap-2">
        <Button type="button" size="sm" onClick={save} disabled={!pattern.trim() || pending}>
          {pending
            ? "Saving…"
            : count && count > 0
              ? `Save rule · fixes ${count} more`
              : "Save rule"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
          <X /> Just this once
        </Button>
      </div>
      {error && <p className="w-full text-xs text-negative">{error}</p>}
    </div>
  );
}
