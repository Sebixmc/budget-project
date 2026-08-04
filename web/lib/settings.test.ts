import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_FALLBACK, DEFAULT_PAGE_OPTIONS, isValidDefaultPage } from "./settings";

describe("isValidDefaultPage", () => {
  it("accepts every offered option", () => {
    for (const o of DEFAULT_PAGE_OPTIONS) expect(isValidDefaultPage(o.value)).toBe(true);
  });
  it("rejects anything not in the allowlist (guards against open redirect)", () => {
    expect(isValidDefaultPage("/settings")).toBe(false);
    expect(isValidDefaultPage("https://evil.example")).toBe(false);
    expect(isValidDefaultPage("")).toBe(false);
  });
  it("the fallback is itself a valid page", () => {
    expect(isValidDefaultPage(DEFAULT_PAGE_FALLBACK)).toBe(true);
  });
});
