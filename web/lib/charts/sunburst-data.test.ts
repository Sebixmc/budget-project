import { describe, expect, it } from "vitest";
import { buildSunburstTree, type SunburstRow } from "./sunburst-data";

const row = (over: Partial<SunburstRow>): SunburstRow => ({
  description: "MAVERIK 12",
  amount: 10,
  flow: "debit",
  category: "Gas & Fuel",
  ...over,
});

describe("buildSunburstTree", () => {
  it("splits flows into Spending and Income roots", () => {
    const tree = buildSunburstTree([
      row({ flow: "debit" }),
      row({ flow: "credit", category: "Income", description: "PAYROLL" }),
    ]);
    expect(tree.map((n) => n.name)).toEqual(["Spending", "Income"]);
  });

  it("omits a flow with no rows and returns [] for empty input", () => {
    expect(buildSunburstTree([]).length).toBe(0);
    const tree = buildSunburstTree([row({ flow: "debit" })]);
    expect(tree.map((n) => n.name)).toEqual(["Spending"]);
  });

  it("groups merchants by cleaned pattern within a category", () => {
    const tree = buildSunburstTree([
      row({ description: "TRADER JOES #451", category: "Groceries", amount: 10 }),
      row({ description: "TRADER JOES #310", category: "Groceries", amount: 5 }),
      row({ description: "WINCO FOODS", category: "Groceries", amount: 7 }),
    ]);
    const groceries = tree[0].children![0];
    expect(groceries.name).toBe("Groceries");
    expect(groceries.children!.map((m) => m.name)).toEqual(["trader joes", "winco foods"]);
    expect(groceries.children![0].value).toBe(15);
  });

  it("sorts categories and merchants by total desc", () => {
    const tree = buildSunburstTree([
      row({ category: "Dining", description: "CHIPOTLE", amount: 5 }),
      row({ category: "Groceries", description: "WINCO FOODS", amount: 50 }),
      row({ category: "Groceries", description: "TRADER JOES #1", amount: 60 }),
    ]);
    const spending = tree[0];
    expect(spending.children!.map((c) => c.name)).toEqual(["Groceries", "Dining"]);
    expect(spending.children![0].children!.map((m) => m.name)).toEqual([
      "trader joes",
      "winco foods",
    ]);
  });

  it("defensively drops Transfer rows even if the query let them through", () => {
    const tree = buildSunburstTree([
      row({ category: "Transfer", description: "CAPITAL ONE MOBILE PMT", amount: 500 }),
      row({ category: "Dining", description: "CHIPOTLE", amount: 12 }),
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0].children!.map((c) => c.name)).toEqual(["Dining"]);
    expect(tree[0].value).toBe(12);
  });

  it("rounds to cents and keeps parents equal to the sum of their children", () => {
    const tree = buildSunburstTree([
      row({ description: "cafe a", category: "Dining", amount: 0.1 }),
      row({ description: "cafe a", category: "Dining", amount: 0.2 }),
      row({ description: "cafe b", category: "Dining", amount: 1.005 }),
    ]);
    const dining = tree[0].children![0];
    const leafSum = dining.children!.reduce((s, l) => s + l.value, 0);
    expect(dining.children!.find((l) => l.name === "cafe a")!.value).toBe(0.3);
    expect(dining.value).toBeCloseTo(leafSum, 10);
    expect(tree[0].value).toBeCloseTo(dining.value, 10);
  });

  it("falls back to the raw description when cleaning empties the pattern", () => {
    const tree = buildSunburstTree([row({ description: "#1234", category: "Other", amount: 3 })]);
    expect(tree[0].children![0].children![0].name).toBe("#1234");
  });
});
