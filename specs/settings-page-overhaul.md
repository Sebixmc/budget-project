# Settings page overhaul

**Work-queue item:** "Category rename / merge — let the user rename 'Other' or consolidate two categories. UPDATE across all transactions + update `budget_categories` if the renamed category had a budget." (expanded into a full settings-page build) + new item "Settings page overhaul".
**Status:** Approved

## Purpose

The Settings page (`/settings`) today only does account CRUD. This overhaul turns it into the app's real preferences hub: it consolidates account management into one section and adds Appearance (light/dark/system theme), Category management (rename / merge / delete), Profile & security (email + change password), Budget preferences (monthly-income estimate + default landing page), and a Data & privacy section (export everything, danger-zone bulk delete). Scope was confirmed with the user on 2026-08-04.

## User-facing behavior

The page becomes a single scrolling column of titled sections with a sticky in-page nav (jump links) on wide screens. Sections, in order:

1. **Appearance** — a Light / Dark / System segmented control. Changing it re-themes the whole app immediately and persists (no flash on reload). Stored client-side in `localStorage['theme']` (the pre-paint script in `app/layout.tsx` already reads it); "System" removes the key and follows `prefers-color-scheme`.
2. **Accounts** — the existing account cards (view/edit/delete) and the "Add an account" form, now grouped under one section header instead of floating as loose cards.
3. **Categories** — a table of the user's categories, each with its transaction count and whether it has a budget target. Each row can be **renamed** (typing an existing category name performs a **merge**) or **deleted** (its transactions move to "Other"). `Transfer` is shown but locked (renaming it would break the transfers-excluded invariant, hard rule #3).
4. **Budget preferences** — the monthly-income estimate (same value as the Budget page) and a "default page after sign-in" picker (Dashboard / Transactions / Monthly / Budget).
5. **Profile & security** — the signed-in email (read-only) and a change-password form.
6. **Data & privacy** — "Export all my data" (downloads a JSON file of the user's accounts, transactions, rules, budgets, goals) and a danger zone to delete **all** transactions (type-to-confirm).

## Data flow

- **Theme**: client-only. `appearance-card.tsx` writes `localStorage['theme']` and toggles `document.documentElement.classList` `dark`. No DB, no server.
- **Accounts**: unchanged — `settings/actions.ts` (`createAccount`/`updateAccount`/`deleteAccount`) against `accounts` (RLS-scoped), rendered by `account-card.tsx`.
- **Categories**: `lib/data/categories.ts` `getCategoryUsage()` reads distinct categories from `transactions` + `budget_categories` (user-scoped, so RLS applies) with per-category tx counts. `settings/actions.ts` `renameCategory(old,new)` runs `UPDATE transactions/merchant_rules SET category=new WHERE category=old`, and for `budget_categories` (composite PK `user_id,category`) either renames the row or, if a `new` row already exists, drops the `old` row (merge keeps the existing target). `deleteCategory(name)` moves its transactions and rules to `Other` and drops its budget row. Both reject reserved names (`Transfer`).
- **Budget preferences**: income reuses the Budget page's `setIncome`. Default page → new `user_settings` table via `lib/data/settings.ts` + `updateDefaultPage` action; the login flow (`app/login/page.tsx`) reads `user_settings.default_page` after sign-in and redirects there (allowlisted, falling back to `/dashboard`).
- **Profile/password**: client `security-card.tsx` calls `supabase.auth.updateUser({ password })` via the browser client (`lib/supabase/client.ts`).
- **Data export**: GET route handler `app/(app)/settings/export/route.ts` runs as the user (server client, RLS) and streams a JSON attachment. **Delete-all**: `deleteAllTransactions` action deletes the user's `transactions` rows.

## Acceptance criteria (EARS)

- WHEN the user selects a theme (Light/Dark/System), the system SHALL apply it immediately and persist it so a reload shows the same theme with no flash.
- WHEN the user renames category A to a name B that does not exist, the system SHALL update every one of the user's transactions, merchant rules, and the budget target from A to B.
- WHEN the user renames A to an existing category B (a merge), the system SHALL move A's transactions and rules to B and keep B's existing budget target.
- WHEN the user attempts to rename or delete `Transfer`, the system SHALL refuse (to preserve the transfers-excluded invariant).
- WHEN the user deletes category A, the system SHALL recategorize A's transactions and rules to `Other` and remove A's budget target.
- WHEN the user changes their password to one under 8 characters, the system SHALL reject it with a message and not call Supabase.
- WHEN the user sets a default landing page and next signs in, the system SHALL redirect them to that page (falling back to `/dashboard` for any unrecognized value).
- WHEN the user requests a data export, the system SHALL download a JSON file containing only that user's rows.
- WHEN the user confirms "delete all transactions", the system SHALL delete only that user's transactions and leave accounts, rules, and budgets intact.
- All category/rename/merge/delete writes SHALL be RLS-scoped so no query touches another user's rows (hard rule #1); the new `user_settings` table SHALL ship with `user_id` + RLS in the same migration (hard rule #5).

## Files to touch

- `web/supabase/migrations/0003_user_settings.sql` — new `user_settings` table (`user_id` PK, `default_page`), RLS policies.
- `web/lib/data/categories.ts` — `getCategoryUsage()` (new).
- `web/lib/data/settings.ts` — `getUserSettings()` (new).
- `web/app/(app)/settings/actions.ts` — add `renameCategory`, `deleteCategory`, `updateDefaultPage`, `setMonthlyIncome`, `deleteAllTransactions`.
- `web/app/(app)/settings/export/route.ts` — JSON export (new).
- `web/app/(app)/settings/page.tsx` — rebuilt as sectioned page.
- `web/app/(app)/settings/appearance-card.tsx`, `category-manager.tsx`, `security-card.tsx`, `preferences-card.tsx`, `data-card.tsx` — new client sections.
- `web/components/app/settings-section.tsx` — section wrapper with anchor id (new).
- `web/app/login/page.tsx` — honor `default_page` on sign-in.
- `web/lib/data/categories.test.ts`, `web/app/(app)/settings/actions.test.ts` — tests.

## Out of scope

- Making the built-in categorizer keyword list user-editable — a rename does not change how future CSV imports auto-label (built-in keyword matches reappear under old names unless a merchant rule pins the new name). Called out to the user.
- Email change (auth identity change), 2FA, account deletion, notifications/email — no infra for these.
- Per-account default currency / locale — single USD assumption stands.

## Test plan

- Unit (Vitest): `categories.test.ts` covers `getCategoryUsage` shaping; `actions.test.ts` covers rename-vs-merge branch selection and reserved-name rejection (pure helpers extracted where possible).
- `npm run lint && npm run typecheck && npm test && npm run build` all green.
- Manual browser verification on `http://127.0.0.1:3000` against Supabase: toggle theme, rename+merge a category and confirm dashboard totals update, change password, set default page and re-login, export JSON, delete-all. NOTE: the dev container's firewall blocks Supabase (see hosted-rewrite Amendment), so full in-browser verification may need to run outside the container.
