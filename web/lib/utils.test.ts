import { describe, expect, it } from "vitest";
import { cn, formatCurrency, formatMonthLabel } from "./utils";

describe("cn", () => {
  it("merges conflicting tailwind classes, last wins", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
  it("drops falsy values", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });
});

describe("formatCurrency", () => {
  it("formats USD with cents by default", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
  });
  it("can drop cents", () => {
    expect(formatCurrency(1234.5, { cents: false })).toBe("$1,235");
  });
});

describe("formatMonthLabel", () => {
  it("renders a month key as name + year", () => {
    expect(formatMonthLabel("2026-08")).toBe("August 2026");
  });
  it("handles the first and last month without off-by-one", () => {
    expect(formatMonthLabel("2026-01")).toBe("January 2026");
    expect(formatMonthLabel("2026-12")).toBe("December 2026");
  });
  it("does not shift month in timezones west of UTC", () => {
    // `new Date("2026-08")` is UTC midnight, which is July 31 in the US —
    // the reason the helper parses the string by hand.
    expect(formatMonthLabel("2026-08")).not.toContain("July");
  });
  it("falls back to the raw value when it is not a month key", () => {
    expect(formatMonthLabel("nonsense")).toBe("nonsense");
    expect(formatMonthLabel("2026-13")).toBe("2026-13");
  });
});
