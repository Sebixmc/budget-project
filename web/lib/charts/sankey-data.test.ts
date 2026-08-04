import { describe, expect, it } from "vitest";
import { buildBudgetSankey, selectIncome, UNALLOCATED } from "./sankey-data";

const LIMITS = [
  { category: "Rent & Housing", limit: 1200 },
  { category: "Groceries", limit: 400 },
];

describe("selectIncome", () => {
  it("uses the user's estimate when set", () => {
    expect(selectIncome(3000, 2500)).toEqual({ income: 3000, label: "Monthly income" });
  });

  it("falls back to the historical average when the estimate is 0 or unset", () => {
    expect(selectIncome(0, 2500.456)).toEqual({ income: 2500.46, label: "Avg income" });
  });
});

describe("buildBudgetSankey", () => {
  it("returns null when no expense category has a positive limit", () => {
    expect(buildBudgetSankey({ income: 3000, incomeLabel: "Monthly income", expenseLimits: [] })).toBeNull();
    expect(
      buildBudgetSankey({
        income: 3000,
        incomeLabel: "Monthly income",
        expenseLimits: [{ category: "Dining", limit: 0 }],
      }),
    ).toBeNull();
  });

  it("links income to each budgeted category with the limit as value, sorted desc", () => {
    const g = buildBudgetSankey({ income: 3000, incomeLabel: "Monthly income", expenseLimits: LIMITS })!;
    expect(g.links.slice(0, 2)).toEqual([
      { source: "Monthly income", target: "Rent & Housing", value: 1200 },
      { source: "Monthly income", target: "Groceries", value: 400 },
    ]);
  });

  it("under-allocated: adds an Unallocated node carrying the remainder", () => {
    const g = buildBudgetSankey({ income: 2000, incomeLabel: "Monthly income", expenseLimits: LIMITS })!;
    expect(g.nodes.some((n) => n.name === UNALLOCATED && n.kind === "unallocated")).toBe(true);
    expect(g.links.at(-1)).toEqual({ source: "Monthly income", target: UNALLOCATED, value: 400 });
    expect(g.meta).toEqual({ income: 2000, budgeted: 1600, unallocated: 400, overAllocated: 0 });
  });

  it("over-allocated: no Unallocated node, unclipped links, warning amount in meta", () => {
    const g = buildBudgetSankey({ income: 1000, incomeLabel: "Monthly income", expenseLimits: LIMITS })!;
    expect(g.nodes.some((n) => n.name === UNALLOCATED)).toBe(false);
    expect(g.links.map((l) => l.value)).toEqual([1200, 400]); // never scaled or clipped
    expect(g.meta.overAllocated).toBe(600);
    expect(g.meta.unallocated).toBe(0);
  });

  it("exactly allocated: no Unallocated node and no over-allocation", () => {
    const g = buildBudgetSankey({ income: 1600, incomeLabel: "Monthly income", expenseLimits: LIMITS })!;
    expect(g.nodes.some((n) => n.name === UNALLOCATED)).toBe(false);
    expect(g.meta).toEqual({ income: 1600, budgeted: 1600, unallocated: 0, overAllocated: 0 });
  });

  it("drops zero/negative limits but keeps the rest", () => {
    const g = buildBudgetSankey({
      income: 3000,
      incomeLabel: "Monthly income",
      expenseLimits: [...LIMITS, { category: "Dining", limit: 0 }],
    })!;
    expect(g.links.some((l) => l.target === "Dining")).toBe(false);
    expect(g.meta.budgeted).toBe(1600);
  });

  it("rounds everything to cents", () => {
    const g = buildBudgetSankey({
      income: 100.005,
      incomeLabel: "Monthly income",
      expenseLimits: [
        { category: "A", limit: 33.335 },
        { category: "B", limit: 33.331 },
      ],
    })!;
    expect(g.links.slice(0, 2).map((l) => l.value)).toEqual([33.34, 33.33]);
    expect(g.meta.budgeted).toBe(66.67);
    expect(g.meta.unallocated).toBe(33.34);
    expect(g.links.at(-1)).toEqual({ source: "Monthly income", target: UNALLOCATED, value: 33.34 });
  });
});
