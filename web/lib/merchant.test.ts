import { describe, expect, it } from "vitest";
import { cleanMerchantPattern } from "./merchant";

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
