# Budget builder — the paycheck cascade

**Work-queue item:** Budget builder: gross salary → taxes → monthly pivot → savings goals → category envelopes, as a single top-to-bottom cascade replacing the Budget page's planner layout.
**Status:** Draft

## Purpose

The Budget page currently offers a flat planner (income estimate + per-category limits). This feature rebuilds it as a **cascade that tells the paycheck's story top to bottom**: yearly facts (gross salary, taxes) → a prominent ÷12 pivot → monthly choices (savings goals first, then category envelopes), with the running remainder always visible and every envelope grounded by the user's real historical average. Design principle: **the pivot separates facts from choices** — everything above it is yearly (how pay and tax rates are quoted), everything below is monthly (how money is actually spent). Savings are allocated *before* spending ("pay yourself first").

## Decisions (settled with the user, 2026-08-04)

1. **Taxes are itemized, small** — a short editable list of lines (default four: Federal %, Utah state 4.55%, FICA 7.65%, plus add-your-own), each either a percent-of-gross or a fixed yearly amount. Labeled as estimates; this is a budgeting aid, not tax software.
2. **Savings goals are simple monthly commitments** (name + monthly amount). They are NOT linked to the dormant `goals` table (target/progress tracking) — that remains a separate future feature.
3. **Budgets stay per-person** (RLS as everywhere). No household/combined view in this iteration.

## User-facing behavior

The Budget page becomes one vertical flow (single column on mobile). Section labels split it: "Yearly — the facts" / "Monthly — your choices".

1. **Gross income card** — one yearly dollar input. Collapsed state: `Gross income — $85,000 / yr` with an edit affordance.
2. **Taxes card** — list of tax lines (name + percent-or-amount + value), add/remove; shows each line's computed yearly deduction and a summary row `After taxes $X`. First-run defaults pre-filled: Federal 12% (editable), Utah state 4.55%, FICA 7.65%. Collapsed state: one line with the line names/rates and total deduction.
3. **The pivot** — a visually prominent divider (largest number on the page): small print `$<after-tax> after taxes · ÷ 12`, headline `$<monthly> / month`.
4. **Pay yourself first card** — savings goals list: name + monthly amount input, each annotated with its yearly cost (`$583 /mo ≈ $6,996 / yr`), add/remove/rename. Summary row `Left to spend $X / mo`.
5. **Monthly envelopes card** — the existing per-category limit editing, restyled into the cascade: each expense category row shows name, `avg $N` hint from real transaction history, and a limit input. A one-tap **use** chip sets the input to the average. When the average exceeds the set limit, the hint renders in the warning color as `avg $N — above budget`. Categories sorted by historical average desc, zero-history categories last (hint shows `no history yet`).
6. **Sticky remainder bar** — pinned to the viewport bottom while the envelopes section is on screen: `Left to allocate $X of $Y` where Y = monthly after-tax minus savings. States: positive → success styling; exactly zero → success (`Fully allocated`); negative → danger styling (`Over by $X`). Updates live on every keystroke.
7. **Progressive collapse** — a stage whose data is already saved renders collapsed to its result line; clicking expands it for editing. First visit (no profile row) renders all stages expanded with defaults and placeholder amounts.
8. **Sankey integration** — the existing "Where the paycheck goes" Sankey uses the builder's numbers when a profile exists: income node = monthly after-tax (labeled `After-tax income`), savings goals render as first-class branches alongside category envelopes, remainder flows to Unallocated (or over-allocated warning per the existing chart spec). Without a profile, current behavior (estimate → historical fallback) is unchanged.
9. **Income categories** — `budget_categories` rows with `flow_type = 'income'` are out of the envelope list (income now comes from the profile); if any exist they are ignored by the cascade UI (not deleted).

## Data flow

1. **Schema (additive migration `0003_budget_builder.sql`)** — two new tables, each with `user_id` + RLS policies in the same migration (hard rule #1):
   - `budget_profile` — `user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade`, `gross_annual numeric(14,2) not null default 0`, `tax_lines jsonb not null default '[]'` (array of `{name: string, kind: 'percent' | 'amount', value: number}` — percent of gross, or fixed **yearly** amount), `updated_at timestamptz` with the existing `set_updated_at` trigger.
   - `savings_goals` — `id uuid primary key default gen_random_uuid()`, `user_id uuid not null default auth.uid() references auth.users(id) on delete cascade`, `name text not null`, `monthly_amount numeric(14,2) not null default 0`, `sort_order int not null default 0`, `created_at timestamptz not null default now()`.
   - RLS: the same four own-rows policies (`user_id = auth.uid()`) used by every table.
2. **Pure math module** — `web/lib/budget-math.ts`: `computeCascade({grossAnnual, taxLines, goals, expenseLimits})` returns `{taxTotal, afterTaxAnnual, monthlyAfterTax, savingsMonthly, leftToSpendMonthly, allocated, leftToAllocate}`. All arithmetic in cents internally; outputs rounded to cents. Percent lines apply to gross; amount lines are yearly. Negative intermediate values are allowed and returned (UI shows over-states); nothing clamps silently. No Supabase/Next imports; full Vitest suite.
3. **Data layer** — `web/lib/data/budget.ts` `getBudget()` additionally selects the user's `budget_profile` row and `savings_goals` (RLS-scoped). Existing `averages` (per-category monthly, transfers excluded) and `avgIncome` are reused as-is for envelope hints and no-profile fallback.
4. **Server actions** — `web/app/(app)/budget/actions.ts` gains `saveProfile(grossAnnual, taxLines)`, `upsertGoal(id | null, name, monthlyAmount)`, `deleteGoal(id)` — all via the user-scoped server client so RLS applies; inputs validated/coerced server-side (non-negative amounts, percent 0–100, tax_lines shape).
5. **Sankey** — `web/lib/charts/sankey-data.ts`: `selectIncome` gains a highest-priority source (profile-derived monthly after-tax, label `After-tax income`); `buildBudgetSankey` accepts optional `savingsGoals: {name, monthly}[]` rendered as branches. Pure-module tests extended.
6. **UI** — `web/app/(app)/budget/budget-planner.tsx` is rebuilt as the cascade (rename to `budget-builder.tsx`); stage cards compose existing `components/ui/` primitives and design tokens only. The page (`page.tsx`) passes profile + goals into the Sankey inputs.

## Acceptance criteria (EARS)

- WHEN the user saves a gross annual income and tax lines, the system SHALL display after-tax yearly income equal to gross minus percent-of-gross lines and fixed yearly lines, and SHALL display the monthly pivot value equal to after-tax ÷ 12 rounded to cents.
- WHEN no `budget_profile` row exists, the system SHALL render all cascade stages expanded with the default tax lines (Federal 12%, Utah state 4.55%, FICA 7.65%) unsaved, and the Sankey/allocation SHALL fall back to current estimate/historical behavior.
- WHEN a savings goal's monthly amount changes, the system SHALL update its yearly annotation (monthly × 12), the `Left to spend` figure, and the sticky remainder bar without a page reload.
- WHEN total envelope limits equal monthly-after-tax minus savings, the sticky bar SHALL show a fully-allocated success state; WHEN limits exceed it, the bar SHALL show `Over by $X` in danger styling.
- WHEN a category has transaction history, its envelope row SHALL show the monthly average (transfers excluded) and a `use` control that sets the limit to that average; WHEN the average exceeds the set limit, the hint SHALL render in warning styling as `above budget`.
- WHEN a category has no transaction history, its row SHALL show `no history yet` and sort after categories with history.
- WHEN a stage has saved data, the system SHALL render it collapsed to its one-line result and SHALL expand it on click.
- WHEN a `budget_profile` with `gross_annual > 0` exists, the Sankey SHALL use monthly after-tax income as its income node (labeled `After-tax income`) and SHALL render each savings goal as a branch.
- WHEN any of these features read or write data, the system SHALL operate only on rows where `user_id = auth.uid()` (via RLS and the user-scoped client), and migration 0003 SHALL create both tables with `user_id` and RLS policies in the same file.
- WHEN invalid input is submitted (negative amounts, percent outside 0–100, malformed tax_lines), the server action SHALL reject it without persisting.

## Files to touch

- `web/supabase/migrations/0003_budget_builder.sql` — new tables + RLS (additive only)
- `web/lib/budget-math.ts` + `budget-math.test.ts` — pure cascade math + tests
- `web/lib/data/budget.ts` — load profile + goals alongside existing data
- `web/app/(app)/budget/actions.ts` — profile/goal server actions with validation
- `web/app/(app)/budget/budget-builder.tsx` — cascade UI (replaces `budget-planner.tsx`)
- `web/app/(app)/budget/page.tsx` — wire profile/goals into Sankey + builder
- `web/lib/charts/sankey-data.ts` + test — income source priority + goal branches

## Out of scope

- Linking savings goals to the dormant `goals` table (targets/progress) — future feature.
- Household/combined budget view across the two users.
- Pay-frequency modeling (biweekly paychecks, irregular income) — everything is annual ÷ 12.
- Real tax computation (brackets, deductions, credits) — lines are user-entered estimates.
- Editing category names (shipped separately) or the category keyword lists.

## Open questions

- None blocking. If `tax_lines` jsonb validation gets awkward in a server action, a `budget_tax_lines` table is the fallback — but jsonb keeps migration 0003 to two tables and the shape is small.

## Test plan

- Unit (Vitest): `budget-math.test.ts` — percent vs fixed lines, mixed, zero gross, over-allocation negatives, cent rounding (no float artifacts), goals summing; `sankey-data.test.ts` — income source priority (profile > estimate > historical), goal branches present, unallocated math with goals.
- Manual browser verification (on Sebi's machine, after migration 0003 is run in the Supabase SQL editor): build the cascade with real numbers; confirm pivot math, use-average chips, above-budget hints, sticky bar states incl. over-allocation, collapse/expand persistence across reload, Sankey shows after-tax income + goal branches, and a second account (Olivia) sees none of it (RLS).
- Gates: `npm run lint && npm run typecheck && npm test && npm run build` all green.
