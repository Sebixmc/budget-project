import { describe, expect, it } from "vitest";
import { buildBudgetSankey, selectIncome, UNALLOCATED } from "./sankey-data";

const LIMITS = [
  { category: "Rent & Housing", limit: 1200 },
  { category: "Groceries", limit: 400 },
];

describe("selectIncome", () => {
  it("prefers the budget builder's after-tax monthly income above all", () => {
    expect(selectIncome(3000, 2500, 5369.166)).toEqual({
      income: 5369.17,
      label: "After-tax income",
    });
  });

  it("uses the user's estimate when set and no profile income exists", () => {
    expect(selectIncome(3000, 2500)).toEqual({ income: 3000, label: "Monthly income" });
    expect(selectIncome(3000, 2500, null)).toEqual({ income: 3000, label: "Monthly income" });
    expect(selectIncome(3000, 2500, 0)).toEqual({ income: 3000, label: "Monthly income" });
  });

  it("falls back to the historical average when the estimate is 0 or unset", () => {
    expect(selectIncome(0, 2500.456)).toEqual({ income: 2500.46, label: "Avg income" });
  });
});

describe("buildBudgetSankey", () => {
  it("returns null when nothing flows (no positive limit, no positive goal)", () => {
    expect(buildBudgetSankey({ income: 3000, incomeLabel: "Monthly income", expenseLimits: [] })).toBeNull();
    expect(
      buildBudgetSankey({
        income: 3000,
        incomeLabel: "Monthly income",
        expenseLimits: [{ category: "Eating Out", limit: 0 }],
        savingsGoals: [{ name: "Roth IRA", monthly: 0 }],
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
    expect(g.meta).toEqual({ income: 2000, savings: 0, budgeted: 1600, unallocated: 400, overAllocated: 0 });
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
    expect(g.meta).toEqual({ income: 1600, savings: 0, budgeted: 1600, unallocated: 0, overAllocated: 0 });
  });

  it("drops zero/negative limits but keeps the rest", () => {
    const g = buildBudgetSankey({
      income: 3000,
      incomeLabel: "Monthly income",
      expenseLimits: [...LIMITS, { category: "Eating Out", limit: 0 }],
    })!;
    expect(g.links.some((l) => l.target === "Eating Out")).toBe(false);
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

  it("renders savings goals as branches before categories, largest first", () => {
    const g = buildBudgetSankey({
      income: 5000,
      incomeLabel: "After-tax income",
      expenseLimits: LIMITS,
      savingsGoals: [
        { name: "Emergency fund", monthly: 200 },
        { name: "Roth IRA", monthly: 500 },
      ],
    })!;
    expect(g.nodes.slice(0, 3)).toEqual([
      { name: "After-tax income", kind: "income" },
      { name: "Roth IRA", kind: "goal" },
      { name: "Emergency fund", kind: "goal" },
    ]);
    expect(g.links.slice(0, 2)).toEqual([
      { source: "After-tax income", target: "Roth IRA", value: 500 },
      { source: "After-tax income", target: "Emergency fund", value: 200 },
    ]);
    // Unallocated: 5000 − 700 savings − 1600 budgeted = 2700
    expect(g.meta).toEqual({ income: 5000, savings: 700, budgeted: 1600, unallocated: 2700, overAllocated: 0 });
  });

  it("goals alone (no envelopes) still render a graph", () => {
    const g = buildBudgetSankey({
      income: 1000,
      incomeLabel: "After-tax income",
      expenseLimits: [],
      savingsGoals: [{ name: "Roth IRA", monthly: 400 }],
    })!;
    expect(g.links).toEqual([
      { source: "After-tax income", target: "Roth IRA", value: 400 },
      { source: "After-tax income", target: UNALLOCATED, value: 600 },
    ]);
  });

  it("counts goals toward over-allocation", () => {
    const g = buildBudgetSankey({
      income: 1500,
      incomeLabel: "After-tax income",
      expenseLimits: LIMITS, // 1600
      savingsGoals: [{ name: "Roth IRA", monthly: 300 }],
    })!;
    expect(g.nodes.some((n) => n.name === UNALLOCATED)).toBe(false);
    expect(g.meta.overAllocated).toBe(400); // 1900 committed vs 1500 income
  });

  it("renames a goal that collides with a category so nodes stay unique", () => {
    const g = buildBudgetSankey({
      income: 3000,
      incomeLabel: "After-tax income",
      expenseLimits: LIMITS,
      savingsGoals: [{ name: "Groceries", monthly: 100 }],
    })!;
    expect(g.nodes.filter((n) => n.name.startsWith("Groceries"))).toHaveLength(2);
    expect(g.links.some((l) => l.target === "Groceries (savings)" && l.value === 100)).toBe(true);
  });
});
