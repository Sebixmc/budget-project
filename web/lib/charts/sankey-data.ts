/**
 * Budget Sankey graph builder — pure. Turns the budget inputs into the
 * ECharts sankey {nodes, links} plus the meta totals for the line above the
 * chart. All rounding to cents happens here. No Supabase/Next imports.
 */

export type ExpenseLimit = { category: string; limit: number };

export type SavingsBranch = { name: string; monthly: number };

export type SankeyNode = {
  name: string;
  kind: "income" | "goal" | "category" | "unallocated";
};

export type SankeyLink = { source: string; target: string; value: number };

export type BudgetSankeyGraph = {
  nodes: SankeyNode[];
  links: SankeyLink[];
  meta: {
    income: number;
    /** Monthly savings-goal total (0 when no goals passed). */
    savings: number;
    budgeted: number;
    /** > 0 only when income exceeds savings + budgeted. */
    unallocated: number;
    /** > 0 only when savings + budgeted exceed income. */
    overAllocated: number;
  };
};

export const UNALLOCATED = "Unallocated";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** The income figure the Sankey uses, by priority: the budget builder's
 *  monthly after-tax income when a profile exists, else the user's estimate,
 *  else the historical average (credits, Transfer excluded — upstream). */
export function selectIncome(
  estimate: number,
  avgIncome: number,
  profileMonthlyAfterTax?: number | null,
): { income: number; label: string } {
  if (profileMonthlyAfterTax != null && profileMonthlyAfterTax > 0) {
    return { income: round2(profileMonthlyAfterTax), label: "After-tax income" };
  }
  return estimate > 0
    ? { income: round2(estimate), label: "Monthly income" }
    : { income: round2(avgIncome), label: "Avg income" };
}

/**
 * Build the income → savings goals + budgeted-categories graph. Returns null
 * when nothing flows (no positive expense limit and no positive goal) — the
 * page then renders exactly as today. Links carry limits/goal amounts
 * verbatim — never scaled or clipped; when income can't cover them the
 * imbalance is reported via meta.overAllocated instead of an Unallocated
 * node. Savings goals ("pay yourself first") branch before categories.
 */
export function buildBudgetSankey(input: {
  income: number;
  incomeLabel: string;
  expenseLimits: ExpenseLimit[];
  savingsGoals?: SavingsBranch[];
}): BudgetSankeyGraph | null {
  const budgetedCats = input.expenseLimits
    .filter((c) => c.limit > 0)
    .map((c) => ({ category: c.category, limit: round2(c.limit) }))
    .sort((a, b) => b.limit - a.limit);

  // Sankey node names must be unique — a goal named like a category (or the
  // income/Unallocated node) gets a suffix rather than merging the nodes.
  const taken = new Set([input.incomeLabel, UNALLOCATED, ...budgetedCats.map((c) => c.category)]);
  const goals = (input.savingsGoals ?? [])
    .filter((g) => g.monthly > 0)
    .map((g) => {
      let name = g.name;
      while (taken.has(name)) name = `${name} (savings)`;
      taken.add(name);
      return { name, monthly: round2(g.monthly) };
    })
    .sort((a, b) => b.monthly - a.monthly);

  if (budgetedCats.length === 0 && goals.length === 0) return null;

  const income = round2(input.income);
  const savings = round2(goals.reduce((s, g) => s + g.monthly, 0));
  const budgeted = round2(budgetedCats.reduce((s, c) => s + c.limit, 0));
  const diff = round2(income - savings - budgeted);
  const unallocated = diff > 0 ? diff : 0;
  const overAllocated = diff < 0 ? round2(-diff) : 0;

  const nodes: SankeyNode[] = [
    { name: input.incomeLabel, kind: "income" },
    ...goals.map((g): SankeyNode => ({ name: g.name, kind: "goal" })),
    ...budgetedCats.map((c): SankeyNode => ({ name: c.category, kind: "category" })),
  ];
  const links: SankeyLink[] = [
    ...goals.map((g) => ({ source: input.incomeLabel, target: g.name, value: g.monthly })),
    ...budgetedCats.map((c) => ({ source: input.incomeLabel, target: c.category, value: c.limit })),
  ];

  if (unallocated > 0) {
    nodes.push({ name: UNALLOCATED, kind: "unallocated" });
    links.push({ source: input.incomeLabel, target: UNALLOCATED, value: unallocated });
  }

  return { nodes, links, meta: { income, savings, budgeted, unallocated, overAllocated } };
}
