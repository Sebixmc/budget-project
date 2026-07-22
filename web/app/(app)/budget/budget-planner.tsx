"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import { ALL_CATEGORIES } from "@/lib/categorizer";
import type { BudgetData } from "@/lib/data/budget";
import { removeBudgetCategory, setIncome, upsertBudgetCategory } from "./actions";

export function BudgetPlanner({ data }: { data: BudgetData }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [newCat, setNewCat] = useState("");
  const [newFlow, setNewFlow] = useState<"expense" | "income">("expense");

  const added = new Set(data.categories.map((c) => c.category));
  const available = ALL_CATEGORIES.filter((c) => !added.has(c) && c !== "Transfer");

  const incomeValue = data.income > 0 ? data.income : data.avgIncome;
  const allocated = useMemo(
    () =>
      data.categories
        .filter((c) => c.flow_type === "expense")
        .reduce((s, c) => s + c.monthly_limit, 0),
    [data.categories],
  );
  const remaining = incomeValue - allocated;

  function refresh(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Monthly income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="number"
              step="0.01"
              min="0"
              defaultValue={data.income || ""}
              placeholder={data.avgIncome ? `avg ${formatCurrency(data.avgIncome)}` : "0.00"}
              onBlur={(e) => {
                const v = Number(e.target.value || 0);
                if (v !== data.income) refresh(() => setIncome(v));
              }}
              className="tabular"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {data.income > 0 ? "Your estimate" : "Using historical average"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Allocated</CardTitle>
          </CardHeader>
          <CardContent className="tabular text-2xl font-semibold">
            {formatCurrency(allocated)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {remaining >= 0 ? "Unallocated" : "Over budget"}
            </CardTitle>
          </CardHeader>
          <CardContent
            className={cn(
              "tabular text-2xl font-semibold",
              remaining >= 0 ? "text-positive" : "text-negative",
            )}
          >
            {formatCurrency(Math.abs(remaining))}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Budget by category</CardTitle>
        </CardHeader>
        <CardContent>
          {data.categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add a category below to start planning. Nothing here yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 font-medium">Category</th>
                  <th className="py-2 pr-4 text-right font-medium">Avg / month</th>
                  <th className="py-2 pr-4 text-right font-medium">Your budget</th>
                  <th className="w-8 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {data.categories.map((c) => (
                  <tr key={c.category} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-4">
                      <span className="flex items-center gap-2">
                        {c.category}
                        <Badge variant={c.flow_type === "income" ? "positive" : "secondary"}>
                          {c.flow_type}
                        </Badge>
                      </span>
                    </td>
                    <td className="tabular py-2 pr-4 text-right text-muted-foreground">
                      {formatCurrency(data.averages[c.category] ?? 0)}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={c.monthly_limit || ""}
                        placeholder="0.00"
                        onBlur={(e) => {
                          const v = Number(e.target.value || 0);
                          if (v !== c.monthly_limit)
                            refresh(() => upsertBudgetCategory(c.category, v, c.flow_type));
                        }}
                        className="tabular ml-auto h-8 w-28 text-right"
                      />
                    </td>
                    <td className="py-2 text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => refresh(() => removeBudgetCategory(c.category))}
                        aria-label={`Remove ${c.category}`}
                      >
                        <Trash2 className="text-negative" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Add category</span>
              <div className="w-52">
                <Select value={newCat} onChange={(e) => setNewCat(e.target.value)}>
                  <option value="">Choose…</option>
                  {available.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
            </label>
            <Select
              value={newFlow}
              onChange={(e) => setNewFlow(e.target.value as "expense" | "income")}
              className="w-32"
              aria-label="Type"
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </Select>
            <Button
              size="sm"
              disabled={!newCat}
              onClick={() => {
                if (!newCat) return;
                const cat = newCat;
                const flow = newFlow;
                setNewCat("");
                refresh(() => upsertBudgetCategory(cat, 0, flow));
              }}
            >
              Add
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
