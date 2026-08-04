/**
 * Budget cascade math — pure. Gross yearly salary → itemized tax estimate →
 * ÷12 monthly pivot → savings goals → category envelopes, with the running
 * remainders at every step (specs/budget-builder.md).
 *
 * All arithmetic runs in integer cents internally so cent totals are exact;
 * outputs are rounded to cents. Negative intermediates are allowed and
 * returned as-is — the UI renders over-states, nothing clamps silently.
 * No Supabase/Next imports — unit-tested directly.
 */

export type TaxLine = {
  name: string;
  /** 'percent' of gross, or a fixed 'amount' per YEAR. */
  kind: "percent" | "amount";
  value: number;
};

export type CascadeInput = {
  grossAnnual: number;
  taxLines: TaxLine[];
  /** Monthly savings commitments. */
  goals: { monthlyAmount: number }[];
  /** Monthly category envelope limits. */
  expenseLimits: number[];
};

export type Cascade = {
  /** Yearly total of all tax lines. */
  taxTotal: number;
  afterTaxAnnual: number;
  /** The pivot: after-tax ÷ 12, rounded to cents. */
  monthlyAfterTax: number;
  savingsMonthly: number;
  /** monthlyAfterTax − savings ("left to spend"). */
  leftToSpendMonthly: number;
  /** Sum of envelope limits. */
  allocated: number;
  /** leftToSpendMonthly − allocated; negative when over-allocated. */
  leftToAllocate: number;
};

const toCents = (n: number): number => Math.round(n * 100);
const fromCents = (c: number): number => c / 100;

/** One tax line's YEARLY deduction, rounded to cents (also used per-row in the UI). */
export function taxLineYearly(line: TaxLine, grossAnnual: number): number {
  const grossCents = toCents(grossAnnual);
  const cents =
    line.kind === "percent" ? Math.round((grossCents * line.value) / 100) : toCents(line.value);
  return fromCents(cents);
}

export function computeCascade(input: CascadeInput): Cascade {
  const grossCents = toCents(input.grossAnnual);

  const taxCents = input.taxLines.reduce(
    (sum, line) => sum + toCents(taxLineYearly(line, input.grossAnnual)),
    0,
  );
  const afterTaxCents = grossCents - taxCents;
  const monthlyCents = Math.round(afterTaxCents / 12);

  const savingsCents = input.goals.reduce((sum, g) => sum + toCents(g.monthlyAmount), 0);
  const leftToSpendCents = monthlyCents - savingsCents;

  const allocatedCents = input.expenseLimits.reduce((sum, l) => sum + toCents(l), 0);
  const leftToAllocateCents = leftToSpendCents - allocatedCents;

  return {
    taxTotal: fromCents(taxCents),
    afterTaxAnnual: fromCents(afterTaxCents),
    monthlyAfterTax: fromCents(monthlyCents),
    savingsMonthly: fromCents(savingsCents),
    leftToSpendMonthly: fromCents(leftToSpendCents),
    allocated: fromCents(allocatedCents),
    leftToAllocate: fromCents(leftToAllocateCents),
  };
}

/** First-run tax lines (spec Decision #1): user-editable estimates. */
export const DEFAULT_TAX_LINES: TaxLine[] = [
  { name: "Federal", kind: "percent", value: 12 },
  { name: "Utah state", kind: "percent", value: 4.55 },
  { name: "FICA", kind: "percent", value: 7.65 },
];
