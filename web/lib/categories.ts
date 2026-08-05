/**
 * Pure rules for the Settings category manager — no DB/framework imports so
 * they unit-test directly. The server actions in `app/(app)/settings/actions.ts`
 * enforce these before touching the database.
 */

/** `Transfer` is load-bearing for the transfers-excluded invariant (hard rule
 *  #3): renaming or merging it would silently pull transfers into spending
 *  totals. `Other` is the sink categories are deleted INTO, so it can't itself
 *  be deleted. */
export const RESERVED_FROM_RENAME = ["Transfer"] as const;
export const RESERVED_FROM_DELETE = ["Transfer", "Other"] as const;
/** Names a user can't create: system sinks (`Other`/`Uncategorized`) and the
 *  transfers-exclusion category (`Transfer`, hard rule #3). */
export const RESERVED_FROM_CREATE = ["Transfer", "Other", "Uncategorized"] as const;

export function isReservedFromRename(name: string): boolean {
  return (RESERVED_FROM_RENAME as readonly string[]).includes(name);
}

export function isReservedFromDelete(name: string): boolean {
  return (RESERVED_FROM_DELETE as readonly string[]).includes(name);
}

export function isReservedFromCreate(name: string): boolean {
  return (RESERVED_FROM_CREATE as readonly string[]).some(
    (r) => r.toLowerCase() === name.toLowerCase(),
  );
}

export type RenameError = "empty" | "same" | "reserved-source" | "reserved-target";

/** Validate a rename/merge request. `null` means it's allowed. */
export function validateRename(oldName: string, newName: string): RenameError | null {
  const from = oldName.trim();
  const to = newName.trim();
  if (!from || !to) return "empty";
  if (from === to) return "same";
  if (isReservedFromRename(from)) return "reserved-source";
  if (isReservedFromRename(to)) return "reserved-target";
  return null;
}

export type DeleteError = "empty" | "reserved";

/** Validate a delete request. `null` means it's allowed. */
export function validateDelete(name: string): DeleteError | null {
  const n = name.trim();
  if (!n) return "empty";
  if (isReservedFromDelete(n)) return "reserved";
  return null;
}

export type CreateError = "empty" | "reserved" | "duplicate";

/**
 * Validate a create-category request. `existing` is every category name that
 * already exists (built-in, custom, or in-use); the match is case-insensitive
 * so "groceries" can't shadow "Groceries". `null` means it's allowed.
 */
export function validateCreate(name: string, existing: readonly string[]): CreateError | null {
  const n = name.trim();
  if (!n) return "empty";
  if (isReservedFromCreate(n)) return "reserved";
  const lower = n.toLowerCase();
  if (existing.some((e) => e.toLowerCase() === lower)) return "duplicate";
  return null;
}
