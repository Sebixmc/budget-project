# Rule triage flows — post-upload batch categorization + save-as-rule on edit

**Work-queue item:** Inline merchant-rule creation: post-upload triage of uncategorized transactions + save-as-rule prompt on the Transactions page (promoted from proposed-tickets "Save as rule from a transaction edit").
**Status:** Implemented 2026-08-04 (unit-verified + CI green; in-browser pass pending — see Amendment)

## Purpose

Categorizing "Other" transactions today requires bouncing between the Transactions page and the Rules page, retyping merchant names. This feature embeds rule creation where the categorizing actually happens: (1) immediately after a CSV import, a triage panel groups all still-uncategorized transactions by merchant so each merchant gets categorized once — creating a rule and fixing every matching transaction in one pick; (2) on the Transactions page, changing a category offers to save the fix as a rule, with a live count of the other transactions it would repair. Together they turn one-at-a-time cleanup into one-decision-per-merchant.

## User-facing behavior

### Post-upload triage (Upload page)

1. User imports a CSV as today. On success, below the result line a **triage panel** appears: "N uncategorized across M merchants" listing every merchant group where the user still has transactions with `category = 'Other'` and `category_source = 'auto'` (all accounts, not just this upload — the goal is clearing the pile).
2. Each group row shows: cleaned merchant pattern (e.g. `maverik`), transaction count, summed amount, a category `<Select>`, and a **Skip** button.
3. Picking a category for a group immediately: upserts a merchant rule (`pattern → category`), recategorizes all of the user's matching auto-categorized transactions, and collapses the row with "✓ Groceries · 3 fixed".
4. A small "categorize without saving a rule" text action per group handles genuine one-offs (e.g. `check 1053`): sets the category on the group's transactions (marking them `manual`) without creating a rule.
5. **Skip** hides the group for this visit. When all groups are handled, the panel shows a done state. If there were zero uncategorized transactions after import, the panel doesn't render.

### Save-as-rule prompt (Transactions page)

6. When the user changes a category via a row's inline `<Select>`, the edit saves exactly as today (marked `manual`). Directly under that row a dismissible **rule prompt** appears: wand icon, "Always file `<pattern input>` as `<chosen category>`?" The pattern input is pre-filled with the cleaned merchant (editable). A live count shows how many *other* auto-categorized transactions match: "Save rule · fixes N more".
7. **Save rule** upserts the rule, recategorizes matching auto rows, and dismisses the prompt with a brief confirmation. **Just this once** (or editing another row, or navigating away) dismisses it with no side effects. The prompt never blocks further edits; only one prompt is visible at a time (a new edit replaces it).
8. After a **bulk** category apply, the same prompt appears only if every selected row shares one cleaned merchant pattern; otherwise no prompt.
9. If the cleaned pattern matches no other auto transactions, the button reads "Save rule" (future imports still benefit).

## Data flow

1. **Pattern cleaning** — new pure module `web/lib/merchant.ts`: `cleanMerchantPattern(description)` lowercases, strips `#1234`-style store suffixes, bare trailing digit runs, and Capital One `XXXXXXX####` masks, collapses whitespace. No Supabase/Next imports (unit-testable, same rule as parser/categorizer).
2. **Triage groups** — server function `getUncategorizedGroups()` in `web/app/(app)/upload/actions.ts`: selects the user's transactions where `category = 'Other'` and `category_source = 'auto'` (RLS scopes to the user), groups in TS by `cleanMerchantPattern(description)`, returns `{pattern, count, total, sampleDescription}` sorted by count desc. Money display only — no Transfer-exclusion concern (nothing is summed into insights; the panel shows group totals as a description, and Transfer rows are auto-categorized as Transfer, so they are never `Other`).
3. **Rule save + apply** — shared server action `createRuleAndApply(pattern, category)` (new `web/app/(app)/rules/shared.ts` or exported from `rules/actions.ts`): upserts into `merchant_rules` (`onConflict: user_id,pattern`, pattern lowercased), then updates `transactions` set `category` where `category_source = 'auto'` and `description ilike %pattern%`, returning the updated count. Mirrors `reapplyRules()`; **never touches `category_source = 'manual'` rows** (hard rule #7).
4. **Match count preview** — server action `countRuleMatches(pattern)` returns the count of auto-categorized transactions matching `ilike %pattern%` (excluding the just-edited row client-side). Called when the rule prompt opens and debounced when the pattern input is edited.
5. **UI components** — `web/components/app/triage-panel.tsx` (client; rendered by the Upload page after a successful import) and `web/components/app/rule-prompt.tsx` (client; rendered by `transactions-table.tsx` under the active row). Both compose existing `components/ui/` primitives.

## Acceptance criteria (EARS)

- WHEN a CSV import succeeds and the user has ≥1 transaction with `category = 'Other'` and `category_source = 'auto'`, the system SHALL render the triage panel grouped by cleaned merchant pattern with per-group count and total.
- WHEN a category is picked for a triage group, the system SHALL upsert a merchant rule for that pattern, set that category on all of the user's matching auto-categorized transactions, and report the number updated.
- WHEN "categorize without saving a rule" is used on a group, the system SHALL set the category on that group's transactions with `category_source = 'manual'` and SHALL NOT create a rule.
- WHEN a triage group is skipped, the system SHALL hide it without modifying any data.
- WHEN a CSV import succeeds and no auto-categorized 'Other' transactions exist, the system SHALL NOT render the triage panel.
- WHEN the user changes a single transaction's category inline, the system SHALL save the edit as `manual` immediately and SHALL offer a dismissible rule prompt pre-filled with the cleaned pattern and a count of other matching auto rows.
- WHEN "Save rule" is confirmed in the prompt, the system SHALL upsert the rule and recategorize matching auto rows only.
- WHEN the prompt is dismissed by any means, the system SHALL make no changes beyond the already-saved edit.
- WHEN a bulk category apply's selected rows do not share one cleaned pattern, the system SHALL NOT show the rule prompt.
- WHILE a rule prompt is open, WHEN another category edit is made, the system SHALL replace the prompt with one for the new edit.
- WHEN any rule is applied by these flows, the system SHALL never modify transactions with `category_source = 'manual'`.

## Files to touch

- `web/lib/merchant.ts` — new: `cleanMerchantPattern()` (pure)
- `web/lib/merchant.test.ts` — new: Vitest cases incl. Capital One/UCCU suffix shapes
- `web/app/(app)/rules/actions.ts` — add `createRuleAndApply`, `countRuleMatches`
- `web/app/(app)/upload/actions.ts` — add `getUncategorizedGroups`; extend upload result plumbing
- `web/app/(app)/upload/page.tsx` / `upload-form.tsx` — render triage panel after success
- `web/components/app/triage-panel.tsx` — new client component
- `web/components/app/rule-prompt.tsx` — new client component
- `web/app/(app)/transactions/transactions-table.tsx` — hook prompt into single + bulk edit paths

## Out of scope

- The per-row "wand" affordance for creating a rule without editing a category (option B in the design discussion) — may follow later.
- A standalone triage mode on the Transactions page; triage lives on the Upload page only.
- Fuzzy/regex rule patterns; patterns remain case-insensitive substrings.
- Changes to the categorizer's built-in keyword list or the DB schema (none needed).

## Open questions

- None blocking. Naming of the "Uncategorized" bucket: triage targets `category = 'Other'` only; legacy "Uncategorized" appears in `ALL_CATEGORIES` but the categorizer never emits it for new imports.

## Amendment 2026-08-04

Implemented as specced, with three small deviations:

- **Grouping lives in the pure layer.** The by-merchant grouping (count, rounded
  total, ids, sample, ordering) is `groupByMerchant()` in `web/lib/merchant.ts`
  rather than inline in `upload/actions.ts`, so it unit-tests directly;
  `getUncategorizedGroups()` is the RLS-scoped query + the pure call. Groups also
  carry the row `ids` so the one-off path targets exactly the grouped rows.
- **"Categorize without saving a rule" reuses `bulkCategory()`** from
  `transactions/actions.ts` (same semantics: sets category, marks `manual`) —
  no new server action.
- **Rule-matching `ilike` escapes LIKE wildcards** (`%`, `_`, `\`) so a pattern
  matches as a literal substring, exactly like the categorizer's `includes()`.
- **The rule prompt floats instead of living under the row** (changed
  2026-08-04, at Sebi's request after live use). Spec §6 placed the prompt
  "directly under that row", but the common workflow — filter on `Other`, fix
  rows one by one — removes the edited row from the filtered list on refresh,
  leaving the prompt nowhere stable to sit. It now renders as a non-blocking
  panel pinned bottom-center of the viewport, unaffected by list refreshes,
  filters, or scrolling; single and bulk edits share it. All other prompt
  behavior (dismissal semantics, live count, one-at-a-time) is as specced.
- **Bulk edits queue a prompt per merchant** (changed 2026-08-04, at Sebi's
  request after live use). Spec §8 showed the prompt only when every selected
  row shared one cleaned pattern; now a mixed-merchant bulk apply queues one
  prompt per distinct cleaned merchant (largest group first, "n of N"
  indicator). Save rule / Just this once each advance instantly to the next
  item in the same screen position — spam-clickable without moving the mouse
  (the brief saved-confirmation shows only on the final item); "Skip all"
  abandons the rest of the queue with no side effects. A single-row edit is a
  queue of one and behaves exactly as before.

Verification: Vitest covers `cleanMerchantPattern` + `groupByMerchant`
(31 tests green) and lint/typecheck/`next build` pass. The manual browser
pass in the Test plan could **not** be run from the implementing dev
container — its firewall blocks the Supabase host (see proposed-tickets
2026-08-04) — so the work-queue item stays `[IN PROGRESS]` until someone
walks the Test plan on a real deployment.

## Test plan

- Unit (Vitest): `web/lib/merchant.test.ts` — store-number stripping (`TRADER JOES #451` → `trader joes`), account masks, whitespace collapse, already-clean names unchanged.
- Manual browser verification on `npm run dev` against the real Supabase project:
  1. Import the synthetic Capital One CSV → triage panel lists uncategorized merchants with counts.
  2. Pick a category for a multi-transaction group → row collapses with "fixed" count; Transactions page shows the new category; Rules page shows the rule; manual rows untouched.
  3. Skip a group → disappears, data unchanged on refresh it returns.
  4. Inline-edit a category on Transactions → prompt appears with cleaned pattern + correct count; Save rule fixes matches; "Just this once" leaves only the single edit.
  5. Bulk-select rows from one merchant → apply category → prompt appears; mixed merchants → no prompt.
  6. Re-import the same CSV → still idempotent (0 imported, N skipped), no duplicate rules (upsert).
