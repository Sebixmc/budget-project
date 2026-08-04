import { describe, expect, it } from "vitest";
import {
  isReservedFromDelete,
  isReservedFromRename,
  validateDelete,
  validateRename,
} from "./categories";

describe("validateRename", () => {
  it("allows a plain rename to a new name", () => {
    expect(validateRename("Dining", "Eating Out")).toBeNull();
  });
  it("allows a merge (target already exists) — same rule, resolved server-side", () => {
    expect(validateRename("Dining", "Groceries")).toBeNull();
  });
  it("rejects empty names", () => {
    expect(validateRename("", "X")).toBe("empty");
    expect(validateRename("X", "   ")).toBe("empty");
  });
  it("rejects renaming a category to itself", () => {
    expect(validateRename("Groceries", "Groceries")).toBe("same");
    expect(validateRename(" Groceries ", "Groceries")).toBe("same");
  });
  it("refuses to rename Transfer (protects the transfers-excluded invariant)", () => {
    expect(validateRename("Transfer", "Moving Money")).toBe("reserved-source");
  });
  it("refuses to rename anything INTO Transfer", () => {
    expect(validateRename("Groceries", "Transfer")).toBe("reserved-target");
  });
});

describe("validateDelete", () => {
  it("allows deleting a normal category", () => {
    expect(validateDelete("Shopping")).toBeNull();
  });
  it("rejects empty", () => {
    expect(validateDelete("  ")).toBe("empty");
  });
  it("refuses to delete Transfer and Other", () => {
    expect(validateDelete("Transfer")).toBe("reserved");
    expect(validateDelete("Other")).toBe("reserved");
  });
});

describe("reserved-name helpers", () => {
  it("Transfer is locked from rename; Other is not", () => {
    expect(isReservedFromRename("Transfer")).toBe(true);
    expect(isReservedFromRename("Other")).toBe(false);
  });
  it("both Transfer and Other are locked from delete", () => {
    expect(isReservedFromDelete("Transfer")).toBe(true);
    expect(isReservedFromDelete("Other")).toBe(true);
    expect(isReservedFromDelete("Groceries")).toBe(false);
  });
});
