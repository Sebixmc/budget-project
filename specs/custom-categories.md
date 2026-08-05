# Custom categories — user-created categories

**Work-queue item:** Custom categories — let the user create their own categories (not just rename/merge/delete the built-ins) from Settings → Category management, persisted per-user and offered everywhere the app lists categories.
**Status:** In review

## Purpose

Today the set of assignable categories is a fixed list baked into code (`ALL_CATEGORIES`, derived from the `RULES` keyword table in `web/lib/categorizer.ts`). Users can rename, merge, and delete categories in Settings, but they cannot invent a new one (e.g. "Childcare", "Tithing", "Side Business") without a code change. This feature lets a signed-in user add their own categories, which then appear in every category dropdown (Transactions filter + inline edit, Rules, Budget) and are persisted per-user under RLS. Built-in categories keep auto-categorizing imports as before; custom categories are assigned manually or via merchant rules.

## User-facing behavior

1. **Add a category.** In Settings → Category management, above the category list, an "Add category" text input with an **Add** button. The user types a name and clicks Add (or presses Enter). On success the new category appears in the list immediately with `0 tx` and no "Budgeted" badge.
2. **Validation feedback.** If the name is blank, a duplicate of an existing category (case-insensitive, built-in or custom or already-in-use), or a reserved name, an inline error appears and nothing is created.
3. **Use it everywhere.** The new category is immediately selectable in: the Transactions filter dropdown, the Transactions inline/bulk category dropdown, the Rules "assign category" dropdown, and the Budget builder's envelope list. Assigning a transaction to it works like any other category.
4. **Delete it.** A custom category with zero transactions can be deleted from the manager (same trash button as today). Deleting also removes it from the custom-category store so it stops appearing in dropdowns. Custom categories with transactions delete like built-ins: their transactions/rules move to `Other`.
5. **Rename/merge unchanged.** Renaming or merging a custom category behaves exactly like the existing rename/merge flow.

## Data flow

1. **New table** `user_categories` (migration `web/supabase/migrations/0006_user_categories.sql`): `user_id uuid` + `name text` + `created_at timestamptz default now()`, `PRIMARY KEY (user_id, name)`, RLS policies scoping every row to `auth.uid()` (select/insert/delete), `user_id default auth.uid()`. Additive, forward-only.
2. **Read (selectable list).** New helper `getSelectableCategories()` in `web/lib/data/categories.ts` returns the sorted union of: built-in `ALL_CATEGORIES`, the user's `user_categories` names, and categories in use on `transactions`/`budget_categories` (so nothing a user already relies on ever disappears). Server pages call it and pass the array down to client components as a prop, replacing the static `ALL_CATEGORIES` import at each call site.
3. **Read (manager list).** `getCategoryUsage()` (same file) additionally unions `user_categories` so a freshly-added empty category shows in the manager with `txCount: 0`.
4. **Write (create).** New server action `createCategory(name)` in `web/app/(app)/settings/actions.ts`: validate via a pure `validateCreate()` in `web/lib/categories.ts`, then `insert` into `user_categories`; revalidate the money views. RLS scopes the write to the user.
5. **Write (delete).** `deleteCategory()` additionally deletes the name from `user_categories` (in case it was a custom category), alongside the existing move-to-`Other` behavior.
6. **Categorization is untouched.** `web/lib/categorizer.ts` stays pure and keyword-driven; custom categories simply have no keywords, so imports never auto-assign to them (assignment is manual or via a saved merchant rule). Hard rule #3 (Transfer excluded) is unaffected because custom names can't be `Transfer` (reserved).

## Acceptance criteria (EARS)

- WHEN the user submits a non-empty category name that does not already exist (case-insensitive) and is not reserved, the system SHALL insert it into `user_categories` for that user and show it in the manager and in every category dropdown.
- WHEN the user submits a blank name, the system SHALL reject it with an inline error and create nothing.
- WHEN the user submits a name that already exists as a built-in, custom, or in-use category (case-insensitive), the system SHALL reject it as a duplicate and create nothing.
- WHEN the user submits a reserved name (`Transfer`, `Other`, `Uncategorized`), the system SHALL reject it and create nothing.
- WHEN a category is created, THEN another user SHALL NOT see it (RLS scopes `user_categories` to `auth.uid()`).
- WHEN the user deletes a custom category, the system SHALL remove it from `user_categories` and move any of its transactions/rules to `Other`, so it no longer appears in dropdowns.
- WHILE a custom category has no keywords, WHEN a CSV is imported, the system SHALL NOT auto-assign any transaction to it.

## Files to touch

- `web/supabase/migrations/0006_user_categories.sql` — new `user_categories` table + RLS (new).
- `web/lib/categories.ts` — add `RESERVED_FROM_CREATE` + `validateCreate(name, existingLower)` pure helper + `CreateError` type; unit-tested.
- `web/lib/categories.test.ts` — cases for `validateCreate` (empty, duplicate, reserved, ok).
- `web/lib/data/categories.ts` — add `getSelectableCategories()`; union `user_categories` into `getCategoryUsage()`.
- `web/app/(app)/settings/actions.ts` — add `createCategory()`; extend `deleteCategory()` to also remove from `user_categories`.
- `web/app/(app)/settings/category-manager.tsx` — "Add category" input + button + error handling.
- `web/app/(app)/transactions/page.tsx`, `transactions-table.tsx` — take categories from `getSelectableCategories()` (prop) instead of the static import.
- `web/app/(app)/rules/page.tsx` — same.
- `web/app/(app)/budget/budget-builder.tsx` (+ its server page) — feed the envelope list from the dynamic list instead of the static import.

## Out of scope

- Assigning keywords/auto-categorization rules to a custom category from the UI (users can still create a merchant rule the existing way).
- Per-category color/icon customization.
- Reordering or grouping categories.
- Changing how built-in categories are defined.

## Open questions

- Should a custom category also be creatable inline from the Transactions category dropdown (a "+ New category…" option), or is Settings-only fine for v1? (Spec assumes Settings-only.)

## Test plan

- Unit (Vitest): `web/lib/categories.test.ts` — `validateCreate` accepts a fresh name; rejects empty, duplicate (case-insensitive), and each reserved name.
- Manual browser verification (`npm run dev` → http://127.0.0.1:3000 against a real/local Supabase): add "Childcare" in Settings → it appears in the manager and in the Transactions/Rules/Budget dropdowns; assign a transaction to it; confirm a second account/user cannot see it; delete it and confirm it disappears from dropdowns.
- CI gate: `npm run lint && npm run typecheck && npm test && npm run build` all green.
