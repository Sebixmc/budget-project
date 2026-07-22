/**
 * Tests for the multi-bank CSV parser. Synthetic data only. Pins the hard
 * invariants: amounts are stored positive, direction lives in `flow`, internal
 * transfers categorize as Transfer, and per-bank quirks (UCCU posted-only,
 * Capital One note extraction, date normalization) are preserved.
 */
import { describe, expect, it } from "vitest";
import { cleanBankDescription, detectAndParse, parseDate } from "./parser";

describe("parseDate", () => {
  it("normalizes the known bank formats to YYYY-MM-DD", () => {
    expect(parseDate("2026-03-07")).toBe("2026-03-07");
    expect(parseDate("3/7/2026")).toBe("2026-03-07");
    expect(parseDate("03/07/26")).toBe("2026-03-07");
    expect(parseDate("2026/3/7")).toBe("2026-03-07");
  });
  it("returns the input trimmed when unparseable", () => {
    expect(parseDate("  not-a-date ")).toBe("not-a-date");
  });
});

describe("cleanBankDescription", () => {
  it("extracts a user note but keeps known tx-type prefixes as description", () => {
    expect(cleanBankDescription("for textbook - Deposit from Account XXXXXXX1")).toEqual([
      "Deposit from Account XXXXXXX1",
      "for textbook",
    ]);
    const [desc, note] = cleanBankDescription("Debit Card Purchase - MAVERIK PROVO UT");
    expect(desc).toBe("MAVERIK PROVO UT");
    expect(note).toBe("");
  });
});

describe("detectAndParse — capital_one_credit", () => {
  const csv = [
    "Transaction Date,Posted Date,Card No.,Description,Category,Debit,Credit",
    "2026-03-01,2026-03-02,1234,STARBUCKS STORE 5,Dining,4.75,",
    "2026-03-03,2026-03-04,1234,PAYROLL CREDIT,,,1500.00",
    ",,,,,,", // junk row: no date/desc -> skipped
  ].join("\n");

  it("splits debit/credit into flow and stores positive amounts", () => {
    const rows = detectAndParse(csv, "capital_one_credit");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      date: "2026-03-01",
      description: "STARBUCKS STORE 5",
      amount: 4.75,
      flow: "debit",
      category: "Dining",
    });
    expect(rows[1]).toMatchObject({ amount: 1500, flow: "credit" });
    expect(rows.every((r) => r.amount >= 0)).toBe(true);
  });
});

describe("detectAndParse — capital_one_bank", () => {
  const csv = [
    "Account Number,Transaction Description,Transaction Date,Transaction Type,Transaction Amount,Balance",
    "9999,Debit Card Purchase - WINCO FOODS,3/5/2026,Debit,52.10,1000",
    "9999,rent money - Withdrawal to Account XXXXXXX7777,3/6/2026,Debit,900.00,100",
  ].join("\n");

  it("cleans descriptions, extracts notes, and flags masked-account transfers", () => {
    const rows = detectAndParse(csv, "capital_one_bank");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      description: "WINCO FOODS",
      amount: 52.1,
      flow: "debit",
      category: "Groceries",
    });
    // Masked account -> Transfer, and the user note is split out.
    expect(rows[1].category).toBe("Transfer");
    expect(rows[1].notes).toBe("rent money");
    expect(rows[1].amount).toBe(900);
  });
});

describe("detectAndParse — uccu_checking", () => {
  const csv = [
    "Account Number,Post Date,Check,Description,Debit,Credit,Status,Balance,Classification",
    "1,3/10/2026,,MAVERIK 12,35.00,,Posted,500,Gas &amp; Fuel",
    "2,3/11/2026,,PENDING COFFEE,4.00,,Pending,496,Food &amp; Dining",
    "3,3/12/2026,,MOVE TO SAVINGS,100.00,,Posted,396,Transfer",
  ].join("\n");

  it("imports only Posted rows, unescapes classification, trusts explicit Transfer", () => {
    const rows = detectAndParse(csv, "uccu_checking");
    expect(rows).toHaveLength(2); // the Pending row is skipped
    expect(rows[0]).toMatchObject({ description: "MAVERIK 12", flow: "debit", category: "Gas & Fuel" });
    expect(rows[1].category).toBe("Transfer");
  });
});

describe("detectAndParse — unknown format", () => {
  it("throws", () => {
    expect(() => detectAndParse("a,b\n1,2", "nope")).toThrow(/Unknown bank format/);
  });
});
