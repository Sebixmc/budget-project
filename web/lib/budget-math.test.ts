import { describe, expect, it } from "vitest";
import {
  computeCascade,
  sumIncomeSources,
  taxLineYearly,
  DEFAULT_TAX_LINES,
  type CascadeInput,
} from "./budget-math";

describe("sumIncomeSources", () => {
  it("sums yearly sources exactly to the cent", () => {
    expect(
      sumIncomeSources([
        { name: "Salary", amount: 85000 },
        { name: "Side income", amount: 4200.5 },
      ]),
    ).toBe(89200.5);
    expect(sumIncomeSources([{ name: "A", amount: 0.1 }, { name: "B", amount: 0.2 }])).toBe(0.3);
    expect(sumIncomeSources([])).toBe(0);
  });
});

const base: CascadeInput = { grossAnnual: 0, taxLines: [], goals: [], expenseLimits: [] };

describe("taxLineYearly", () => {
  it("computes percent lines against gross", () => {
    expect(taxLineYearly({ name: "Federal", kind: "percent", value: 12 }, 85000)).toBe(10200);
    expect(taxLineYearly({ name: "Utah", kind: "percent", value: 4.55 }, 85000)).toBe(3867.5);
  });

  it("passes fixed yearly amounts through, rounded to cents", () => {
    expect(taxLineYearly({ name: "Flat", kind: "amount", value: 1234.567 }, 85000)).toBe(1234.57);
  });

  it("rounds percent results to cents", () => {
    // 7.65% of $33,333 = $2,549.9745 → $2,549.97
    expect(taxLineYearly({ name: "FICA", kind: "percent", value: 7.65 }, 33333)).toBe(2549.97);
  });
});

describe("computeCascade", () => {
  it("chains gross → taxes → pivot → savings → envelopes", () => {
    const c = computeCascade({
      grossAnnual: 85000,
      taxLines: DEFAULT_TAX_LINES, // 12% + 4.55% + 7.65% = 24.2% of 85k = 20,570
      goals: [{ monthlyAmount: 500 }, { monthlyAmount: 83.33 }],
      expenseLimits: [1200, 400, 250],
    });
    expect(c.taxTotal).toBe(20570);
    expect(c.afterTaxAnnual).toBe(64430);
    expect(c.monthlyAfterTax).toBe(5369.17); // 64,430 / 12 = 5,369.1666… → .17
    expect(c.savingsMonthly).toBe(583.33);
    expect(c.leftToSpendMonthly).toBe(4785.84);
    expect(c.allocated).toBe(1850);
    expect(c.leftToAllocate).toBe(2935.84);
  });

  it("mixes percent and fixed-amount lines", () => {
    const c = computeCascade({
      ...base,
      grossAnnual: 50000,
      taxLines: [
        { name: "Federal", kind: "percent", value: 10 }, // 5,000
        { name: "Local levy", kind: "amount", value: 1200 }, // 1,200 / yr
      ],
    });
    expect(c.taxTotal).toBe(6200);
    expect(c.afterTaxAnnual).toBe(43800);
    expect(c.monthlyAfterTax).toBe(3650);
  });

  it("zero gross: percent lines deduct nothing, amount lines still bite", () => {
    const percentOnly = computeCascade({ ...base, taxLines: DEFAULT_TAX_LINES });
    expect(percentOnly.taxTotal).toBe(0);
    expect(percentOnly.monthlyAfterTax).toBe(0);

    const withAmount = computeCascade({
      ...base,
      taxLines: [{ name: "Flat", kind: "amount", value: 600 }],
    });
    expect(withAmount.afterTaxAnnual).toBe(-600);
    expect(withAmount.monthlyAfterTax).toBe(-50);
  });

  it("returns negatives unclamped when over-allocated", () => {
    const c = computeCascade({
      grossAnnual: 12000,
      taxLines: [],
      goals: [{ monthlyAmount: 400 }],
      expenseLimits: [800], // 1000/mo after tax − 400 savings = 600 left, 800 allocated
    });
    expect(c.leftToSpendMonthly).toBe(600);
    expect(c.leftToAllocate).toBe(-200);
  });

  it("keeps cents exact — no float artifacts", () => {
    const c = computeCascade({
      ...base,
      goals: [{ monthlyAmount: 0.1 }, { monthlyAmount: 0.2 }],
      expenseLimits: [0.1, 0.2],
    });
    expect(c.savingsMonthly).toBe(0.3);
    expect(c.allocated).toBe(0.3);
    expect(c.leftToAllocate).toBe(-0.6);
  });

  it("rounds the monthly pivot to cents", () => {
    // 100 / 12 = 8.3333… → 8.33
    const c = computeCascade({ ...base, grossAnnual: 100 });
    expect(c.monthlyAfterTax).toBe(8.33);
  });

  it("sums goals and envelopes independently of order", () => {
    const a = computeCascade({
      ...base,
      grossAnnual: 60000,
      goals: [{ monthlyAmount: 250 }, { monthlyAmount: 100.5 }],
      expenseLimits: [10, 20, 30],
    });
    const b = computeCascade({
      ...base,
      grossAnnual: 60000,
      goals: [{ monthlyAmount: 100.5 }, { monthlyAmount: 250 }],
      expenseLimits: [30, 10, 20],
    });
    expect(a).toEqual(b);
    expect(a.savingsMonthly).toBe(350.5);
    expect(a.allocated).toBe(60);
  });

  it("handles the empty cascade", () => {
    const c = computeCascade(base);
    expect(c).toEqual({
      taxTotal: 0,
      afterTaxAnnual: 0,
      monthlyAfterTax: 0,
      savingsMonthly: 0,
      leftToSpendMonthly: 0,
      allocated: 0,
      leftToAllocate: 0,
    });
  });
});
