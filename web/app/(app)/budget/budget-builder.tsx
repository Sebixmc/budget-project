"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import {
  computeCascade,
  sumIncomeSources,
  taxLineYearly,
  DEFAULT_TAX_LINES,
  type IncomeSource,
  type TaxLine,
} from "@/lib/budget-math";
import type { BudgetData } from "@/lib/data/budget";
import {
  deleteGoal,
  saveProfile,
  upsertBudgetCategory,
  upsertGoal,
} from "./actions";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

type GoalUnit = "mo" | "yr";

/** What the user typed → the stored monthly commitment. */
const toMonthly = (value: number, unit: GoalUnit) =>
  unit === "yr" ? round2(value / 12) : round2(value);

/**
 * The paycheck cascade (specs/budget-builder.md): yearly facts (gross salary,
 * itemized tax estimate) → a prominent ÷12 pivot → monthly choices (savings
 * goals first, then category envelopes), with a sticky left-to-allocate bar.
 * Saved stages collapse to a one-line result; clicking expands them.
 */
export function BudgetBuilder({ data, categories }: { data: BudgetData; categories: string[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const hasProfile = data.profile !== null;

  // ---- local, live-editable copies (persisted via server actions) ----------
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>(() =>
    data.profile && data.profile.income_sources.length > 0
      ? data.profile.income_sources
      : [{ name: "Salary", amount: 0 }],
  );
  const [taxLines, setTaxLines] = useState<TaxLine[]>(() =>
    data.profile && data.profile.tax_lines.length > 0 ? data.profile.tax_lines : DEFAULT_TAX_LINES,
  );
  // The yearly-facts cards persist automatically on blur (no lost edits if
  // the user never clicks Save); this tracks whether anything changed.
  const profileDirty = useRef(false);
  const [goalEdits, setGoalEdits] = useState<Record<string, { name?: string; amount?: number }>>({});
  // Per-goal input unit: type a yearly target and it's ÷12 into the stored
  // monthly commitment. `raw` preserves the typed yearly figure so it doesn't
  // jitter to monthly×12 (e.g. 1000 → 83.33/mo → 999.96) after rounding.
  const [goalUnits, setGoalUnits] = useState<Record<string, GoalUnit>>({});
  const [goalRaw, setGoalRaw] = useState<Record<string, string>>({});
  const [limitEdits, setLimitEdits] = useState<Record<string, string>>({});
  const [newGoal, setNewGoal] = useState({ name: "", amount: "", unit: "mo" as GoalUnit });
  const [saveError, setSaveError] = useState<string | null>(null);

  const anySavedLimit = data.categories.some((c) => c.flow_type === "expense" && c.monthly_limit > 0);
  const [expanded, setExpanded] = useState(() => ({
    gross: !hasProfile,
    taxes: !hasProfile,
    goals: data.goals.length === 0,
    envelopes: !anySavedLimit,
  }));
  const toggle = (stage: keyof typeof expanded) =>
    setExpanded((e) => ({ ...e, [stage]: !e[stage] }));

  function persist(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  // ---- merged values + live math -------------------------------------------
  const gross = sumIncomeSources(incomeSources);
  const goals = data.goals.map((g) => ({
    ...g,
    name: goalEdits[g.id]?.name ?? g.name,
    monthly_amount: goalEdits[g.id]?.amount ?? g.monthly_amount,
  }));

  const incomeFlow = new Set(
    data.categories.filter((c) => c.flow_type === "income").map((c) => c.category),
  );
  const savedLimits = new Map(
    data.categories.filter((c) => c.flow_type === "expense").map((c) => [c.category, c.monthly_limit]),
  );
  // Every expense category is an envelope (income comes from the profile now;
  // income-flow budget rows are ignored, not deleted — spec §9). Sorted by
  // historical average desc; no-history categories last.
  const envelopeCats = [
    ...new Set([
      ...categories.filter((c) => c !== "Transfer" && c !== "Income"),
      ...savedLimits.keys(),
    ]),
  ]
    .filter((c) => !incomeFlow.has(c))
    .sort((a, b) => (data.averages[b] ?? 0) - (data.averages[a] ?? 0) || a.localeCompare(b));

  const limitStr = (cat: string) =>
    limitEdits[cat] ?? (savedLimits.get(cat) ? String(savedLimits.get(cat)) : "");
  const limitOf = (cat: string) => Number(limitStr(cat) || 0);

  const cascade = computeCascade({
    grossAnnual: gross,
    taxLines,
    goals: goals.map((g) => ({ monthlyAmount: g.monthly_amount })),
    expenseLimits: envelopeCats.map(limitOf),
  });
  // Before a profile exists (nothing typed yet), the allocation target falls
  // back to the pre-cascade behavior: estimate, else historical average.
  const monthlyBase =
    gross > 0 ? cascade.monthlyAfterTax : data.income > 0 ? data.income : data.avgIncome;
  const leftToSpend = round2(monthlyBase - cascade.savingsMonthly);
  const leftToAllocate = round2(leftToSpend - cascade.allocated);
  const budgetedCount = envelopeCats.filter((c) => limitOf(c) > 0).length;

  /** Persist the profile. Rows without a name are dropped; explicit values
   *  may be passed so add/remove clicks can save without waiting for state. */
  function commitProfile(opts: {
    collapse?: boolean;
    sources?: IncomeSource[];
    lines?: TaxLine[];
  } = {}) {
    setSaveError(null);
    profileDirty.current = false;
    const sources = (opts.sources ?? incomeSources).filter((s) => s.name.trim() !== "");
    const lines = (opts.lines ?? taxLines).filter((l) => l.name.trim() !== "");
    persist(async () => {
      const res = await saveProfile(sources, lines);
      if (!res.ok) {
        setSaveError(res.error ?? "Could not save.");
        return;
      }
      if (opts.collapse) setExpanded((e) => ({ ...e, gross: false, taxes: false }));
    });
  }

  /** Blur handler for the yearly-facts inputs — auto-saves pending edits. */
  function autoSaveProfile() {
    if (profileDirty.current) commitProfile();
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <SectionLabel>Yearly — the facts</SectionLabel>

      {/* ---- 1 · Gross income (itemized sources, auto-saved on blur) ---- */}
      <StageCard
        title="Gross income"
        expanded={expanded.gross}
        onToggle={() => toggle("gross")}
        summary={
          gross > 0
            ? incomeSources.length > 1
              ? `${incomeSources.length} sources · ${formatCurrency(gross, { cents: false })} / yr`
              : `${formatCurrency(gross, { cents: false })} / yr`
            : "not set"
        }
      >
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            Yearly amounts, before taxes. Saved automatically as you edit.
          </p>
          {incomeSources.map((source, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Input
                value={source.name}
                aria-label="Income source name"
                placeholder="e.g. Salary"
                onChange={(e) => {
                  profileDirty.current = true;
                  setIncomeSources((ss) => patchSource(ss, i, { name: e.target.value }));
                }}
                onBlur={autoSaveProfile}
                className="h-8 w-40 text-sm"
              />
              <Input
                type="number"
                step="0.01"
                min="0"
                value={source.amount || ""}
                placeholder="85000"
                aria-label={`${source.name || "income source"} yearly amount`}
                onChange={(e) => {
                  profileDirty.current = true;
                  setIncomeSources((ss) =>
                    patchSource(ss, i, { amount: Number(e.target.value || 0) }),
                  );
                }}
                onBlur={autoSaveProfile}
                className="tabular h-8 w-32 text-sm"
              />
              <span className="text-xs text-muted-foreground">/ yr</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Remove ${source.name || "income source"}`}
                className="ml-auto"
                disabled={incomeSources.length === 1}
                onClick={() => {
                  const next = incomeSources.filter((_, j) => j !== i);
                  setIncomeSources(next);
                  commitProfile({ sources: next });
                }}
              >
                <X />
              </Button>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-border pt-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setIncomeSources((ss) => [...ss, { name: "", amount: 0 }])}
            >
              <Plus /> Add income
            </Button>
            {incomeSources.length > 1 && (
              <p className="text-sm">
                Total gross <span className="tabular font-semibold">{formatCurrency(gross)}</span>
              </p>
            )}
          </div>
          {saveError && <p className="text-xs text-negative">{saveError}</p>}
        </div>
      </StageCard>

      {/* ---- 2 · Taxes ---- */}
      <StageCard
        title="Taxes"
        expanded={expanded.taxes}
        onToggle={() => toggle("taxes")}
        summary={`${taxLines.map(taxLineShort).join(" · ")} — −${formatCurrency(cascade.taxTotal, { cents: false })} / yr`}
      >
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            Estimates for budgeting — not tax software. Percent lines apply to gross; amounts are
            per year.
          </p>
          {taxLines.map((line, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Input
                value={line.name}
                aria-label="Tax line name"
                placeholder="Name"
                onChange={(e) => {
                  profileDirty.current = true;
                  setTaxLines((ls) => patch(ls, i, { name: e.target.value }));
                }}
                onBlur={autoSaveProfile}
                className="h-8 w-36 text-sm"
              />
              <Input
                type="number"
                step="0.01"
                min="0"
                value={line.value || ""}
                aria-label="Tax line value"
                placeholder="0"
                onChange={(e) => {
                  profileDirty.current = true;
                  setTaxLines((ls) => patch(ls, i, { value: Number(e.target.value || 0) }));
                }}
                onBlur={autoSaveProfile}
                className="tabular h-8 w-24 text-sm"
              />
              <Select
                value={line.kind}
                aria-label="Tax line kind"
                onChange={(e) => {
                  const next = patch(taxLines, i, { kind: e.target.value as TaxLine["kind"] });
                  setTaxLines(next);
                  commitProfile({ lines: next });
                }}
                className="h-8 w-24 text-sm"
              >
                <option value="percent">%</option>
                <option value="amount">$ / yr</option>
              </Select>
              <span className="tabular ml-auto text-sm text-muted-foreground">
                −{formatCurrency(taxLineYearly(line, gross))}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Remove ${line.name || "tax line"}`}
                onClick={() => {
                  const next = taxLines.filter((_, j) => j !== i);
                  setTaxLines(next);
                  commitProfile({ lines: next });
                }}
              >
                <X />
              </Button>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-border pt-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setTaxLines((ls) => [...ls, { name: "", kind: "percent", value: 0 }])}
            >
              <Plus /> Add line
            </Button>
            <p className="text-sm">
              After taxes{" "}
              <span className="tabular font-semibold">{formatCurrency(cascade.afterTaxAnnual)}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={() => commitProfile({ collapse: true })}>
              Done
            </Button>
            <p className="text-xs text-muted-foreground">Changes save automatically.</p>
            {saveError && <p className="text-xs text-negative">{saveError}</p>}
          </div>
        </div>
      </StageCard>

      {/* ---- 3 · The pivot ---- */}
      <div className="flex flex-col items-center gap-1 py-4 text-center">
        <p className="text-xs text-muted-foreground">
          {formatCurrency(cascade.afterTaxAnnual)} after taxes · ÷ 12
        </p>
        <p className="tabular text-5xl font-semibold tracking-tight">
          {formatCurrency(gross > 0 ? cascade.monthlyAfterTax : monthlyBase)}
          <span className="text-lg font-normal text-muted-foreground"> / month</span>
        </p>
        {gross === 0 && (
          <p className="text-xs text-muted-foreground">
            {monthlyBase > 0
              ? data.income > 0
                ? "your monthly estimate — enter a gross salary above to build from facts"
                : "your historical monthly income — enter a gross salary above to build from facts"
              : "enter your gross salary above to begin"}
          </p>
        )}
      </div>

      <SectionLabel>Monthly — your choices</SectionLabel>

      {/* ---- 4 · Pay yourself first ---- */}
      <StageCard
        title="Pay yourself first"
        expanded={expanded.goals}
        onToggle={() => toggle("goals")}
        summary={
          goals.length > 0
            ? `${goals.length} goal${goals.length === 1 ? "" : "s"} · ${formatCurrency(cascade.savingsMonthly)} / mo`
            : "no goals yet"
        }
      >
        <div className="flex flex-col gap-2">
          {goals.map((g) => {
            const unit = goalUnits[g.id] ?? "mo";
            const shown =
              goalRaw[g.id] ??
              (g.monthly_amount
                ? String(unit === "yr" ? round2(g.monthly_amount * 12) : g.monthly_amount)
                : "");
            return (
            <div key={g.id} className="flex flex-wrap items-center gap-2">
              <Input
                value={g.name}
                aria-label="Goal name"
                onChange={(e) =>
                  setGoalEdits((m) => ({ ...m, [g.id]: { ...m[g.id], name: e.target.value } }))
                }
                onBlur={() => persist(() => upsertGoal(g.id, g.name, g.monthly_amount))}
                className="h-8 w-44 text-sm"
              />
              <Input
                type="number"
                step="0.01"
                min="0"
                value={shown}
                placeholder="0.00"
                aria-label={`${g.name} ${unit === "yr" ? "yearly" : "monthly"} amount`}
                onChange={(e) => {
                  const raw = e.target.value;
                  setGoalRaw((m) => ({ ...m, [g.id]: raw }));
                  setGoalEdits((m) => ({
                    ...m,
                    [g.id]: { ...m[g.id], amount: toMonthly(Number(raw || 0), unit) },
                  }));
                }}
                onBlur={() => persist(() => upsertGoal(g.id, g.name, g.monthly_amount))}
                className="tabular h-8 w-28 text-sm"
              />
              <Select
                value={unit}
                aria-label={`${g.name} amount unit`}
                onChange={(e) => {
                  const next = e.target.value as GoalUnit;
                  setGoalUnits((m) => ({ ...m, [g.id]: next }));
                  // Re-derive the shown figure from the stored monthly amount.
                  setGoalRaw((m) => {
                    const rest = { ...m };
                    delete rest[g.id];
                    return rest;
                  });
                }}
                className="h-8 w-20 text-sm"
              >
                <option value="mo">/ mo</option>
                <option value="yr">/ yr</option>
              </Select>
              <span className="text-xs text-muted-foreground">
                {unit === "yr"
                  ? `= ${formatCurrency(g.monthly_amount)} / mo`
                  : `≈ ${formatCurrency(round2(g.monthly_amount * 12), { cents: false })} / yr`}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Delete ${g.name}`}
                className="ml-auto"
                onClick={() => persist(() => deleteGoal(g.id))}
              >
                <X className="text-negative" />
              </Button>
            </div>
            );
          })}

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <Input
              value={newGoal.name}
              placeholder="New goal — e.g. Roth IRA"
              aria-label="New goal name"
              onChange={(e) => setNewGoal((s) => ({ ...s, name: e.target.value }))}
              className="h-8 w-44 text-sm"
            />
            <Input
              type="number"
              step="0.01"
              min="0"
              value={newGoal.amount}
              placeholder={newGoal.unit === "yr" ? "$ / yr" : "$ / mo"}
              aria-label={`New goal ${newGoal.unit === "yr" ? "yearly" : "monthly"} amount`}
              onChange={(e) => setNewGoal((s) => ({ ...s, amount: e.target.value }))}
              className="tabular h-8 w-28 text-sm"
            />
            <Select
              value={newGoal.unit}
              aria-label="New goal amount unit"
              onChange={(e) => setNewGoal((s) => ({ ...s, unit: e.target.value as GoalUnit }))}
              className="h-8 w-20 text-sm"
            >
              <option value="mo">/ mo</option>
              <option value="yr">/ yr</option>
            </Select>
            {newGoal.unit === "yr" && Number(newGoal.amount) > 0 && (
              <span className="text-xs text-muted-foreground">
                = {formatCurrency(toMonthly(Number(newGoal.amount), "yr"))} / mo
              </span>
            )}
            <Button
              type="button"
              size="sm"
              disabled={!newGoal.name.trim()}
              onClick={() => {
                const { name, amount, unit } = newGoal;
                setNewGoal({ name: "", amount: "", unit });
                persist(() => upsertGoal(null, name, toMonthly(Number(amount || 0), unit)));
              }}
            >
              <Plus /> Add goal
            </Button>
          </div>

          <p className="border-t border-border pt-3 text-sm">
            Left to spend{" "}
            <span className={cn("tabular font-semibold", leftToSpend < 0 && "text-negative")}>
              {formatCurrency(leftToSpend)}
            </span>{" "}
            / mo
          </p>
        </div>
      </StageCard>

      {/* ---- 5 · Monthly envelopes + sticky remainder bar ---- */}
      <div className="flex flex-col gap-4">
        <StageCard
          title="Monthly envelopes"
          expanded={expanded.envelopes}
          onToggle={() => toggle("envelopes")}
          summary={
            budgetedCount > 0
              ? `${budgetedCount} budgeted · ${formatCurrency(cascade.allocated)} / mo`
              : "nothing budgeted yet"
          }
        >
          <div className="flex flex-col">
            {envelopeCats.map((cat) => {
              const avg = data.averages[cat] ?? 0;
              const limit = limitOf(cat);
              const aboveBudget = limit > 0 && avg > limit;
              return (
                <div
                  key={cat}
                  className="flex flex-wrap items-center gap-2 border-b border-border/60 py-2 last:border-0"
                >
                  <span className="w-36 text-sm">{cat}</span>
                  {avg > 0 ? (
                    <span
                      className={cn(
                        "flex items-center gap-1.5 text-xs",
                        aboveBudget ? "font-medium text-warning" : "text-muted-foreground",
                      )}
                    >
                      avg {formatCurrency(avg)}
                      {aboveBudget && " — above budget"}
                      <button
                        type="button"
                        onClick={() => {
                          setLimitEdits((m) => ({ ...m, [cat]: String(avg) }));
                          persist(() => upsertBudgetCategory(cat, avg, "expense"));
                        }}
                        className="rounded border border-input px-1.5 py-0.5 text-xs text-foreground hover:bg-muted"
                      >
                        use
                      </button>
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">no history yet</span>
                  )}
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={limitStr(cat)}
                    placeholder="0.00"
                    aria-label={`${cat} monthly budget`}
                    onChange={(e) => setLimitEdits((m) => ({ ...m, [cat]: e.target.value }))}
                    onBlur={() => {
                      const v = limitOf(cat);
                      if (v !== (savedLimits.get(cat) ?? 0))
                        persist(() => upsertBudgetCategory(cat, v, "expense"));
                    }}
                    className="tabular ml-auto h-8 w-28 text-right text-sm"
                  />
                </div>
              );
            })}
          </div>
        </StageCard>

        {/* Sticky while the envelopes section spans the viewport bottom. */}
        <div
          className={cn(
            "sticky bottom-4 z-10 flex items-baseline justify-between gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg",
            leftToAllocate < 0
              ? "border-negative bg-negative text-negative-foreground"
              : "border-positive/50 bg-card text-positive",
          )}
        >
          <span className="font-semibold">
            {leftToAllocate < 0
              ? `Over by ${formatCurrency(-leftToAllocate)}`
              : leftToAllocate === 0
                ? "Fully allocated"
                : `Left to allocate ${formatCurrency(leftToAllocate)}`}
          </span>
          <span className={cn("tabular text-xs", leftToAllocate < 0 ? "opacity-80" : "text-muted-foreground")}>
            of {formatCurrency(leftToSpend)} after savings
          </span>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{children}</p>
  );
}

/** Collapsible cascade stage: header always visible (with the one-line result
 *  while collapsed); body only when expanded. */
function StageCard({
  title,
  summary,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  summary: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="py-4">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <CardTitle className="text-base">{title}</CardTitle>
          <span className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            {!expanded && <span className="tabular truncate">{summary}</span>}
            <ChevronDown className={cn("size-4 shrink-0 transition-transform", expanded && "rotate-180")} />
          </span>
        </button>
      </CardHeader>
      {expanded && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}

function taxLineShort(l: TaxLine): string {
  const rate = l.kind === "percent" ? `${l.value}%` : formatCurrency(l.value, { cents: false });
  return `${l.name || "—"} ${rate}`;
}

function patch(lines: TaxLine[], i: number, change: Partial<TaxLine>): TaxLine[] {
  return lines.map((l, j) => (j === i ? { ...l, ...change } : l));
}

function patchSource(
  sources: IncomeSource[],
  i: number,
  change: Partial<IncomeSource>,
): IncomeSource[] {
  return sources.map((s, j) => (j === i ? { ...s, ...change } : s));
}
