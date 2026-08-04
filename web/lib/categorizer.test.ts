/**
 * Port of tests/test_categorizer.py — pins the priority order
 * (merchant rules → keyword RULES → bank raw category → "Other") and the
 * transfer/income handling. Synthetic descriptions only.
 */
import { describe, expect, it } from "vitest";
import { ALL_CATEGORIES, categorize } from "./categorizer";

describe("categorize", () => {
  it("keyword match wins over default", () => {
    expect(categorize("STARBUCKS STORE 123")).toBe("Eating Out");
    expect(categorize("WINCO FOODS #45")).toBe("Groceries");
    expect(categorize("SHELL OIL 9987")).toBe("Car & Gas");
  });

  it("merchant rule beats keyword", () => {
    const rules = [{ pattern: "starbucks", category: "Shopping" }];
    expect(categorize("STARBUCKS STORE 123", "", rules)).toBe("Shopping");
  });

  it("income is checked before transfer", () => {
    expect(categorize("PAYROLL DIRECT DEP ACME INC")).toBe("Income");
  });

  it("detects internal transfers and card payments", () => {
    expect(categorize("Withdrawal to Account XXXXXXX1234")).toBe("Transfer");
    expect(categorize("CAPITAL ONE MOBILE PMT")).toBe("Transfer");
  });

  it("falls back to the bank's raw category when no keyword matches", () => {
    expect(categorize("MERCHANT 4471", "Food & Drink")).toBe("Eating Out");
    expect(categorize("MERCHANT 4471", "Gas")).toBe("Car & Gas");
  });

  it("falls back to Other when nothing matches", () => {
    expect(categorize("ZZZ UNKNOWN MERCHANT 9999")).toBe("Other");
  });
});

describe("ALL_CATEGORIES", () => {
  it("is sorted and de-duplicated and contains the key categories", () => {
    expect(ALL_CATEGORIES).toEqual([...new Set(ALL_CATEGORIES)].sort());
    expect(ALL_CATEGORIES).toContain("Transfer");
    expect(ALL_CATEGORIES).toContain("Other");
  });
});
