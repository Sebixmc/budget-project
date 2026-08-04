# Interactive insight charts — drill-down sunburst (Dashboard) + budget Sankey (Budget)

**Work-queue item:** Interactive insight charts: ECharts drill-down sunburst on Dashboard + income→allocation Sankey on Budget (promoted from proposed-tickets "Budget Sankey diagram" and "Expandable sunburst on Dashboard").
**Status:** Draft

## Purpose

Two legacy charts were dropped in the hosted port and are now the biggest visual-parity gap. The Dashboard's category donut is flat — you can't see *what's inside* a category or drill into it. The Budget page lost the Sankey that made "where does the paycheck go" legible at a glance. Both come back via ECharts (sanctioned in root CLAUDE.md's stack line: "ECharts/Recharts"), which supports sunburst drill-down and Sankey natively — one new dependency serves both charts.

## User-facing behavior

### Spending sunburst (Dashboard)

1. The Dashboard's "By category" donut is replaced by a three-ring **sunburst**: inner ring = flow (`Spending` / `Income`), middle ring = categories, outer ring = merchants (grouped by `cleanMerchantPattern`, so `TRADER JOES #451` and `TRADER JOES #310` are one wedge).
2. **Clicking any wedge zooms in** — that node becomes the center and its children fill the rings (ECharts native `nodeClick: 'rootToNode'`). **Clicking the center circle zooms back out** one level. Hovering shows a tooltip with the node's name and dollar total.
3. The sunburst respects the same scope as the rest of the Dashboard (current month/account context the page already queries) and **excludes `category = 'Transfer'` entirely** (hard rule #3).
4. Wedges too small to label are still clickable; labels truncate rather than overlap. With no transactions in scope, the card shows the existing empty state.
5. The category breakdown table stays — the sunburst complements it, not replaces it.

### Budget Sankey (Budget page)

6. Above the existing allocation summary, a **Sankey** renders when ≥1 expense budget category has `monthly_limit > 0`: a single income node on the left (labeled `Monthly income` from `budget_income.monthly_estimate` if set, else `Avg income` computed from credit transactions excluding Transfer) flowing into one node per budgeted expense category (link width = `monthly_limit`).
7. If income exceeds the sum of limits, the remainder flows to an **Unallocated** node. If limits exceed income, no Unallocated node renders and a meta line above the chart shows "⚠ Over-allocated by $X" (mirrors legacy behavior; links are never scaled or clipped).
8. A meta line shows `Income $X · Budgeted $Y · Unallocated $Z` (or the over-allocated warning). With no budgeted expense categories, the Sankey and meta line don't render — the page looks exactly as today.
9. Hovering a link highlights the flow and shows `source → target · $value`; hovering a node highlights its adjacent links (ECharts `emphasis: focus: 'adjacency'`).

### Shared

10. Chart colors come from one palette module aligned with the design tokens — no scattered hex values (`web/` CLAUDE.md design rule; charts need concrete color values, so the palette module is the single sanctioned place they live).
11. Charts render client-side only (dynamic import, no SSR) inside the existing card shells; pages stay Server Components. Charts resize with their container.

## Data flow

1. **Sunburst tree (pure)** — new `web/lib/charts/sunburst-data.ts`: `buildSunburstTree(rows)` takes `{description, amount, flow, category}[]` (already Transfer-filtered by the query) and returns the ECharts nested `{name, value, children}` tree: flow → category (sorted by total desc) → merchant (grouped via `cleanMerchantPattern`, summed, sorted desc). No Supabase/Next imports — unit-tested like parser/categorizer.
2. **Sunburst query** — `web/lib/data/insights.ts` gains `getSunburstRows(scope)`: selects the user's transactions in the Dashboard's current scope with `category != 'Transfer'` (RLS scopes rows to the user). The page calls it server-side and passes rows to the client chart component, which builds the tree.
3. **Sankey graph (pure)** — new `web/lib/charts/sankey-data.ts`: `buildBudgetSankey({income, expenseLimits})` returns `{nodes, links, meta}` with the income → category links, conditional Unallocated node, and over/under totals. Pure and unit-tested; all rounding to cents here.
4. **Sankey inputs** — the Budget page already loads `budget_categories` (filter `flow_type = 'expense'`, `monthly_limit > 0`) and `budget_income`; fallback avg income reuses the existing income query (credits, Transfer excluded). No new tables, no schema changes.
5. **ECharts wrapper** — new `web/components/charts/echarts.tsx`: thin `"use client"` wrapper around `echarts/core` with tree-shaken imports (`SunburstChart`, `SankeyChart`, `TooltipComponent`, canvas renderer), `ResizeObserver` handling, and disposal on unmount. `web/components/charts/spending-sunburst.tsx` and `budget-sankey.tsx` compose it.
6. **Dependency** — add `echarts` (core, tree-shaken) to `web/package.json`. No `echarts-for-react` — the wrapper is ~40 lines and avoids a second dependency. Recharts stays for the existing bar/donut-style charts elsewhere (Monthly page untouched).

## Acceptance criteria (EARS)

- WHEN the Dashboard renders with ≥1 non-Transfer transaction in scope, the system SHALL render a three-ring sunburst (flow → category → cleaned merchant) whose dollar totals match the breakdown table for the same scope.
- WHEN a sunburst wedge is clicked, the system SHALL zoom so that wedge becomes the root; WHEN the center circle is clicked, the system SHALL zoom out one level.
- WHEN transactions with `category = 'Transfer'` exist in scope, the system SHALL exclude them from every sunburst ring and total.
- WHEN the Dashboard scope has no non-Transfer transactions, the system SHALL show the existing empty state and no sunburst.
- WHEN the Budget page renders and ≥1 expense category has `monthly_limit > 0`, the system SHALL render a Sankey from a single income node to each budgeted expense category with link value equal to that category's limit.
- WHEN income exceeds total budgeted, the system SHALL render an Unallocated node carrying the difference; WHEN total budgeted exceeds income, the system SHALL render no Unallocated node and SHALL show an over-allocated warning in the meta line.
- WHEN `budget_income.monthly_estimate` is 0 or unset, the system SHALL fall back to average income computed from credit-flow transactions excluding Transfer.
- WHEN no expense category has a positive limit, the system SHALL render the Budget page without the Sankey, identical to today.
- WHEN either chart renders, the system SHALL derive all colors from the shared chart palette module.

## Files to touch

- `web/package.json` — add `echarts`
- `web/lib/charts/sunburst-data.ts` + `sunburst-data.test.ts` — pure tree builder + tests
- `web/lib/charts/sankey-data.ts` + `sankey-data.test.ts` — pure graph builder + tests
- `web/lib/charts/palette.ts` — token-aligned chart palette (single home for chart hex values)
- `web/lib/data/insights.ts` — add `getSunburstRows(scope)`
- `web/components/charts/echarts.tsx` — client wrapper (tree-shaken echarts/core)
- `web/components/charts/spending-sunburst.tsx`, `web/components/charts/budget-sankey.tsx` — chart components
- `web/app/(app)/dashboard/page.tsx` — swap donut for sunburst in the category card
- `web/app/(app)/budget/page.tsx` — render Sankey + meta line above the allocation summary

## Out of scope

- Multiple income-source branches in the Sankey — the legacy app had a `budget_income_sources` table; the web schema has a single `budget_income` row per user. Multi-source needs an additive migration and is a separate ticket if wanted.
- The legacy sunburst's leaf-level detail panel with in-chart category editing ("Save Category") — category editing lives on the Transactions page now (rule prompt shipped separately). Sunburst leaves are merchants, not individual transactions.
- Migrating existing Recharts charts (Monthly bars, spend trend) to ECharts.
- Persisting sunburst zoom state across navigation.

## Open questions

- None blocking. If bundle size from `echarts/core` proves heavy in `next build` output, the wrapper's dynamic import already isolates it to the two pages; further trimming is an optimization, not a design change.

## Test plan

- Unit (Vitest): `sunburst-data.test.ts` — grouping by cleaned merchant, flow split, Transfer rows never present in output when passed (defensive filter), sort order, cent rounding. `sankey-data.test.ts` — under/over/exactly-allocated cases, income fallback selection, no-expense-categories → null.
- Manual browser verification on `npm run dev` against the real Supabase project:
  1. Dashboard: sunburst renders; totals match the breakdown table; click a category → zooms in with merchants visible; click center → zooms out; Transfer transactions absent.
  2. Budget: set limits on ≥2 categories with income covering them → Sankey shows income → categories + Unallocated; raise limits past income → Unallocated disappears, over-allocated warning shows; clear all limits → no Sankey.
  3. `npm run lint && npm run typecheck && npm test && npm run build` all green; build output confirms echarts loads only on Dashboard/Budget routes.
