"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DEFAULT_PAGE_OPTIONS } from "@/lib/settings";
import { setMonthlyIncome, updateDefaultPage } from "./actions";

export function PreferencesCard({
  income,
  defaultPage,
}: {
  income: number;
  defaultPage: string;
}) {
  const [incomeValue, setIncomeValue] = useState(income ? String(income) : "");
  const [page, setPage] = useState(defaultPage);
  const [savedNote, setSavedNote] = useState("");
  const [pending, startTransition] = useTransition();

  function saveIncome(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number(incomeValue);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    startTransition(async () => {
      const res = await setMonthlyIncome(parsed);
      setSavedNote(res.ok ? "Income saved." : (res.error ?? "Couldn't save."));
    });
  }

  function changePage(next: string) {
    setPage(next);
    startTransition(async () => {
      const res = await updateDefaultPage(next);
      setSavedNote(res.ok ? "Default page saved." : (res.error ?? "Couldn't save."));
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={saveIncome} className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Monthly income estimate</span>
        <span className="text-xs text-muted-foreground">
          Used on the Budget page to compare against your targets.
        </span>
        <div className="mt-1 flex items-center gap-2">
          <div className="relative max-w-[12rem]">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={incomeValue}
              onChange={(e) => setIncomeValue(e.target.value)}
              placeholder="0.00"
              className="pl-6"
            />
          </div>
          <Button type="submit" size="sm" variant="secondary" disabled={pending}>
            Save
          </Button>
        </div>
      </form>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Default page after sign-in</span>
        <span className="text-xs text-muted-foreground">
          Where you land right after logging in.
        </span>
        <Select
          value={page}
          onChange={(e) => changePage(e.target.value)}
          disabled={pending}
          className="mt-1 max-w-[12rem]"
        >
          {DEFAULT_PAGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </label>

      {savedNote && <p className="text-sm text-positive">{savedNote}</p>}
    </div>
  );
}
