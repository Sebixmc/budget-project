/**
 * Budget Sankey graph builder — pure. Turns the budget inputs into the
 * ECharts sankey {nodes, links} plus the meta totals for the line above the
 * chart. All rounding to cents happens here. No Supabase/Next imports.
 */

export type ExpenseLimit = { category: string; limit: number };

export type SankeyNode = {
  name: string;
  kind: "income" | "category" | "unallocated";
};

export type SankeyLink = { source: string; target: string; value: number };

export type BudgetSankeyGraph = {
  nodes: SankeyNode[];
  links: SankeyLink[];
  meta: {
    income: number;
    budgeted: number;
    /** > 0 only when income exceeds the budgeted total. */
    unallocated: number;
    /** > 0 only when the budgeted total exceeds income. */
    overAllocated: number;
  };
};

export const UNALLOCATED = "Unallocated";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** The income figure the Sankey uses: the user's estimate when set, else the
 *  historical average (credits, Transfer excluded — computed upstream). */
export function selectIncome(
  estimate: number,
  avgIncome: number,
): { income: number; label: string } {
  return estimate > 0
    ? { income: round2(estimate), label: "Monthly income" }
    : { income: round2(avgIncome), label: "Avg income" };
}

/**
 * Build the income → budgeted-categories graph. Returns null when no expense
 * category has a positive limit (the page then renders exactly as today).
 * Links carry each category's limit verbatim — never scaled or clipped; when
 * income can't cover them the imbalance is reported via meta.overAllocated
 * instead of an Unallocated node.
 */
export function buildBudgetSankey(input: {
  income: number;
  incomeLabel: string;
  expenseLimits: ExpenseLimit[];
}): BudgetSankeyGraph | null {
  const budgetedCats = input.expenseLimits
    .filter((c) => c.limit > 0)
    .map((c) => ({ category: c.category, limit: round2(c.limit) }))
    .sort((a, b) => b.limit - a.limit);
  if (budgetedCats.length === 0) return null;

  const income = round2(input.income);
  const budgeted = round2(budgetedCats.reduce((s, c) => s + c.limit, 0));
  const diff = round2(income - budgeted);
  const unallocated = diff > 0 ? diff : 0;
  const overAllocated = diff < 0 ? round2(-diff) : 0;

  const nodes: SankeyNode[] = [
    { name: input.incomeLabel, kind: "income" },
    ...budgetedCats.map((c): SankeyNode => ({ name: c.category, kind: "category" })),
  ];
  const links: SankeyLink[] = budgetedCats.map((c) => ({
    source: input.incomeLabel,
    target: c.category,
    value: c.limit,
  }));

  if (unallocated > 0) {
    nodes.push({ name: UNALLOCATED, kind: "unallocated" });
    links.push({ source: input.incomeLabel, target: UNALLOCATED, value: unallocated });
  }

  return { nodes, links, meta: { income, budgeted, unallocated, overAllocated } };
}
