/**
 * Pure, client-safe settings constants and validation. No DB/server imports so
 * both client components (the preferences form, the login redirect) and the
 * server data layer can share them.
 */

/** Pages a user is allowed to pick as their post-sign-in landing page. */
export const DEFAULT_PAGE_OPTIONS = [
  { value: "/dashboard", label: "Dashboard" },
  { value: "/transactions", label: "Transactions" },
  { value: "/monthly", label: "Monthly" },
  { value: "/budget", label: "Budget" },
] as const;

export const DEFAULT_PAGE_FALLBACK = "/dashboard";

export function isValidDefaultPage(page: string): boolean {
  return DEFAULT_PAGE_OPTIONS.some((o) => o.value === page);
}
