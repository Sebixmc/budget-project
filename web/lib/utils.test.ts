import { describe, expect, it } from "vitest";
import { cn, formatCurrency } from "./utils";

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
