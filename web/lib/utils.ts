import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names, de-duplicating conflicting Tailwind utilities. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Render a `YYYY-MM` month key as "August 2026".
 *
 *  Parsed by hand rather than with `new Date()`, which reads the string as UTC
 *  midnight and lands on the previous month for anyone west of Greenwich. */
export function formatMonthLabel(month: string) {
  const [year, index] = month.split("-").map(Number);
  const name = MONTH_NAMES[index - 1];
  return name ? `${name} ${year}` : month;
}

/** Format a positive amount as USD. Amounts are always stored positive; `flow`
 *  carries direction, so callers decide sign/label — see CLAUDE.md hard rule #4. */
export function formatCurrency(amount: number, opts: { cents?: boolean } = {}) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: opts.cents === false ? 0 : 2,
    maximumFractionDigits: opts.cents === false ? 0 : 2,
  }).format(amount);
}
