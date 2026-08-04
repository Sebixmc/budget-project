import { describe, expect, it } from "vitest";
import { cleanMerchantPattern, groupByMerchant } from "./merchant";

describe("cleanMerchantPattern", () => {
  it("lowercases and strips #-style store numbers", () => {
    expect(cleanMerchantPattern("TRADER JOES #451")).toBe("trader joes");
    expect(cleanMerchantPattern("DUNKIN #349912 Q35")).toBe("dunkin q35");
    expect(cleanMerchantPattern("CIRCLE K # 2723444")).toBe("circle k");
  });

  it("strips bare trailing digit runs (Capital One store suffixes)", () => {
    expect(cleanMerchantPattern("MAVERIK 12")).toBe("maverik");
    expect(cleanMerchantPattern("STARBUCKS STORE 5")).toBe("starbucks store");
    expect(cleanMerchantPattern("CHECK 1053")).toBe("check");
    expect(cleanMerchantPattern("WINCO FOODS 41 84")).toBe("winco foods");
  });

  it("strips Capital One XXXXXXX#### account masks", () => {
    expect(cleanMerchantPattern("Deposit from Account XXXXXXX1234")).toBe("deposit from account");
    expect(cleanMerchantPattern("Withdrawal to XXXXXXXX0042 - savings")).toBe(
      "withdrawal to - savings",
    );
  });

  it("collapses whitespace", () => {
    expect(cleanMerchantPattern("  FIVE   SUSHI  BROS  ")).toBe("five sushi bros");
  });

  it("leaves already-clean names unchanged (digits inside a name survive)", () => {
    expect(cleanMerchantPattern("maverik")).toBe("maverik");
    expect(cleanMerchantPattern("7 Eleven")).toBe("7 eleven");
    expect(cleanMerchantPattern("Java Junkie")).toBe("java junkie");
    expect(cleanMerchantPattern("UCCU Online Banking")).toBe("uccu online banking");
  });

  it("keeps UCCU-style descriptions intact apart from trailing numbers", () => {
    expect(cleanMerchantPattern("SMITHS FOOD #123 PROVO UT")).toBe("smiths food provo ut");
    expect(cleanMerchantPattern("Elevated Checking Fee")).toBe("elevated checking fee");
  });

  it("returns '' when nothing merchant-like remains — callers must handle", () => {
    expect(cleanMerchantPattern("#1234")).toBe("");
    expect(cleanMerchantPattern("")).toBe("");
    expect(cleanMerchantPattern("   ")).toBe("");
  });

  it("never throws on odd input and keeps output a valid substring pattern", () => {
    // A pattern is only useful if `description.toLowerCase().includes(pattern)`
    // holds for the description it was derived from (single-spaced inputs).
    for (const desc of ["TACO BELL 291", "AMZN Mktp US*Z123AB", "TPM, INC", "BYU Store #14"]) {
      const p = cleanMerchantPattern(desc);
      expect(p.length).toBeGreaterThan(0);
    }
  });
});

describe("groupByMerchant", () => {
  const rows = [
    { id: "a", description: "MAVERIK 12", amount: 30.5 },
    { id: "b", description: "MAVERIK 288", amount: 12.25 },
    { id: "c", description: "TRADER JOES #451", amount: 54.1 },
    { id: "d", description: "Java Junkie", amount: 6.4 },
    { id: "e", description: "maverik", amount: 8.05 },
  ];

  it("groups by cleaned pattern with count, rounded total, ids and a sample", () => {
    const groups = groupByMerchant(rows);
    expect(groups.map((g) => g.pattern)).toEqual(["maverik", "trader joes", "java junkie"]);
    const maverik = groups[0];
    expect(maverik.count).toBe(3);
    expect(maverik.total).toBe(50.8);
    expect(maverik.ids).toEqual(["a", "b", "e"]);
    expect(maverik.sampleDescription).toBe("MAVERIK 12");
  });

  it("sorts by count desc, breaking ties by total desc", () => {
    const groups = groupByMerchant(rows.slice(2)); // trader joes 54.10 vs java junkie 6.40 vs maverik 8.05
    expect(groups.map((g) => g.pattern)).toEqual(["trader joes", "maverik", "java junkie"]);
  });

  it("falls back to the raw lowercased description when cleaning empties it", () => {
    const groups = groupByMerchant([{ id: "x", description: "#1234", amount: 1 }]);
    expect(groups).toHaveLength(1);
    expect(groups[0].pattern).toBe("#1234");
  });

  it("drops rows with no description at all and handles empty input", () => {
    expect(groupByMerchant([{ id: "x", description: "  ", amount: 1 }])).toEqual([]);
    expect(groupByMerchant([])).toEqual([]);
  });

  it("avoids float drift in totals", () => {
    const groups = groupByMerchant([
      { id: "1", description: "cafe", amount: 0.1 },
      { id: "2", description: "cafe", amount: 0.2 },
    ]);
    expect(groups[0].total).toBe(0.3);
  });
});
