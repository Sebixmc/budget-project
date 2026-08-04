"use client";

import * as React from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn, formatMonthLabel, MONTH_NAMES } from "@/lib/utils";

/**
 * Parse a `YYYY-MM` value without going through `new Date()`, which would
 * interpret the string as UTC midnight and shift the month for anyone west of
 * Greenwich.
 */
function parseMonth(value: string): { year: number; month: number } {
  const [y, m] = value.split("-").map(Number);
  return { year: y, month: m }; // month is 1-12
}

function toValue(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function shift(value: string, delta: number): string {
  const { year, month } = parseMonth(value);
  const zeroBased = year * 12 + (month - 1) + delta;
  return toValue(Math.floor(zeroBased / 12), (zeroBased % 12) + 1);
}

export interface MonthPickerProps {
  /** Form field name; the picker writes `YYYY-MM` into a hidden input. */
  name?: string;
  /** Current `YYYY-MM` value. */
  value: string;
  /** Submit the enclosing form as soon as a month is chosen. */
  autoSubmit?: boolean;
  className?: string;
  "aria-label"?: string;
}

/**
 * Month selector: a stepper (‹ August 2026 ›) that opens a year + month grid.
 *
 * Replaces `<input type="month">`, whose native picker only opens from the
 * browser's own calendar glyph and renders unstyled (and near-invisible in
 * dark mode).
 */
export function MonthPicker({
  name = "month",
  value,
  autoSubmit = true,
  className,
  "aria-label": ariaLabel = "Month",
}: MonthPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [current, setCurrent] = React.useState(value);
  const [viewYear, setViewYear] = React.useState(() => parseMonth(value).year);

  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Re-sync when the server re-renders this page with a different month.
  React.useEffect(() => {
    setCurrent(value);
    setViewYear(parseMonth(value).year);
    if (inputRef.current) inputRef.current.value = value;
  }, [value]);

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  /**
   * The hidden input is written imperatively rather than through state so its
   * DOM value is already updated when we ask the form to submit.
   */
  function commit(next: string) {
    setCurrent(next);
    setViewYear(parseMonth(next).year);
    const input = inputRef.current;
    if (!input) return;
    input.value = next;
    if (autoSubmit) input.form?.requestSubmit();
  }

  const label = formatMonthLabel(current);

  const stepClasses =
    "flex w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:relative focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none";

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <input ref={inputRef} type="hidden" name={name} defaultValue={value} />

      <div
        role="group"
        aria-label={ariaLabel}
        className="inline-flex h-9 items-stretch overflow-hidden rounded-md border border-input bg-background"
      >
        <button
          type="button"
          onClick={() => commit(shift(current, -1))}
          aria-label="Previous month"
          className={stepClasses}
        >
          <ChevronLeft className="size-4" />
        </button>

        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="flex min-w-[8.75rem] items-center justify-center gap-1.5 border-x border-input px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:relative focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none"
        >
          {label}
          <ChevronDown
            className={cn(
              "size-3.5 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </button>

        <button
          type="button"
          onClick={() => commit(shift(current, 1))}
          aria-label="Next month"
          className={stepClasses}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {open && (
        <MonthGrid
          selected={current}
          viewYear={viewYear}
          onViewYearChange={setViewYear}
          onSelect={(next) => {
            setOpen(false);
            triggerRef.current?.focus();
            commit(next);
          }}
        />
      )}
    </div>
  );
}

function MonthGrid({
  selected,
  viewYear,
  onViewYearChange,
  onSelect,
}: {
  selected: string;
  viewYear: number;
  onViewYearChange: (year: number) => void;
  onSelect: (value: string) => void;
}) {
  // Safe to read the clock here: the grid only ever renders after a click, so
  // it never takes part in server rendering and can't cause a hydration diff.
  const now = new Date();
  const thisMonth = toValue(now.getFullYear(), now.getMonth() + 1);

  return (
    <div
      role="dialog"
      aria-label="Choose month"
      className="absolute left-0 top-[calc(100%+0.375rem)] z-50 w-64 rounded-lg border border-border bg-card p-3 shadow-lg"
    >
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onViewYearChange(viewYear - 1)}
          aria-label={`Go to ${viewYear - 1}`}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="tabular text-sm font-semibold">{viewYear}</span>
        <button
          type="button"
          onClick={() => onViewYearChange(viewYear + 1)}
          aria-label={`Go to ${viewYear + 1}`}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1">
        {MONTH_NAMES.map((label, index) => {
          const value = toValue(viewYear, index + 1);
          const isSelected = value === selected;
          const isCurrent = value === thisMonth;
          return (
            <button
              key={label}
              type="button"
              onClick={() => onSelect(value)}
              aria-current={isSelected ? "true" : undefined}
              className={cn(
                "rounded-md py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                isSelected
                  ? "bg-primary font-medium text-primary-foreground"
                  : "hover:bg-muted",
                !isSelected && isCurrent && "font-medium text-primary",
              )}
            >
              {label.slice(0, 3)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
