# Proposed Tickets

Loose idea backlog surfaced during work but not yet shaped into a work-queue item. Agents and the developer append here throughout the week; in a periodic triage pass, promote entries into the "Open Work Queue" of [`/spec.md`](../spec.md) (as `[UNTOUCHED]`) or delete them as noise.

> The primary tracker is `spec.md`'s Open Work Queue. This file is the pre-queue: rough thoughts that aren't yet clear enough to be a queue item. When an idea is shaped enough to act on, move it to `spec.md`.

## How to append an entry

Add a single bullet under the right section, in this format:

- **<one-line description>** — <one or two sentences of rationale>. Surfaced by: <session context>. <YYYY-MM-DD>

Keep entries terse. When unsure whether to propose something, propose it — capture is cheap, lost observations are expensive.

## How to triage

Walk each section. For each entry:
- **Promote** — add it to `spec.md`'s Open Work Queue under the right priority; remove the entry here.
- **Defer** — leave it with a note like `(defer: revisit YYYY-MM-DD)`.
- **Discard** — delete it. Git history preserves the decision.

## Categories

### Feature ideas

_Things that add product capability. Usually need a spec before implementation._

<!-- example:
- **Weekly budget periods** — some bills are weekly; monthly-only budgeting is awkward for them. Surfaced by: budget-tab session. 2026-07-22
-->

- **Automatic bank sync instead of manual CSV upload** — replace the monthly CSV chore with a daily pull. Capital One has no self-serve API (OFX/Direct Connect is dead, DevExchange is partner-gated), so this means an aggregator: SimpleFIN Bridge (~$1.50/mo, read-only, no SDK, likely first choice), Teller (free tier, embed a Connect flow), or Plaid (best Capital One OAuth + `/transactions/sync`, but needs production approval and costs more). **Requires an ADR before implementation** per root CLAUDE.md — storing long-lived bank access tokens is a bigger sensitivity jump than the transaction data itself (needs its own `user_id` + RLS table, encrypted at rest, server-side exchange only, Vercel Cron for the pull). The existing `UNIQUE(user_id, account_id, date, description, amount, flow)` constraint already makes overlapping re-fetches idempotent, and `lib/categorizer.ts` is unaffected. Verify current Capital One coverage/pricing with the vendor before writing code. Surfaced by: first-deploy session, deferred by developer. 2026-08-03
- **Auto-detect bank format from CSV headers** — `detectAndParse()` in `web/lib/parser.ts` doesn't actually detect; it switches on a `bankFormat` the caller passes in. The three formats have disjoint headers (`Card No.` / `Transaction Description` / `Classification`), so header sniffing is ~20 lines and removes a dropdown plus a chance to pick the wrong format. Cheap friction win, independent of any aggregator work. Surfaced by: first-deploy session. 2026-08-03
- **Accept pasted CSV text on the Upload page** — a textarea alongside the file picker; often faster than the Files app on mobile. Surfaced by: first-deploy session. 2026-08-03

### Bugs and follow-ups

_Things noticed in passing that are broken, fragile, or need fixing._

### Refactors and technical debt

_Code that works but should be improved for clarity, performance, or maintainability._

### Tooling and developer experience

_Test coverage, lint config, the start script, local-run ergonomics._

- **Normalize legacy modules to ruff-clean and widen CI lint to the whole repo** — `app.py`, `database.py`, `parser.py`, `categorizer.py` predate ruff; CI currently lints only `tests/`. Run `ruff check --fix .` + `ruff format .`, eyeball the diff (especially import reordering), then change `.github/workflows/ci.yml` to lint `.` instead of `tests/`. Surfaced by: infra-template application. 2026-07-22
- **Expand test coverage to `parser.py` and `database.py`** — only `categorizer.py` and a boot smoke test exist so far. Add parser tests per bank format (Capital One credit/bank, UCCU) using synthetic CSV bytes, and DB idempotency tests for `insert_transactions`. Surfaced by: infra-template application. 2026-07-22

### Hosted rewrite — deferred parity (web/)

_Legacy Flask features not yet reproduced in the Next.js port. See [`hosted-rewrite.md`](hosted-rewrite.md) / [ADR-004](../adr/004-hosted-multi-user-supabase.md)._

- **Dashboard goals + rainy-day widgets** — the `goals` and `rainy_day_log` tables exist with RLS in `web/supabase/migrations/0001_init.sql`, but the Dashboard doesn't yet render the goal cards or rainy-day balance widget. Port CRUD + progress bars. Surfaced by: hosted rewrite PR7. 2026-07-22
- **Budget Sankey diagram** — the Budget page shows an allocation summary (income → allocated → unallocated/over) instead of the legacy ECharts Sankey. Add a Sankey (recharts has one, or ECharts-react) once the planner is validated. Surfaced by: hosted rewrite PR9. 2026-07-22
- **Expandable sunburst on Dashboard** — legacy had a click-to-expand 3-level sunburst with a detail panel; the port uses a category donut + breakdown table. Reintroduce the sunburst interaction if wanted. Surfaced by: hosted rewrite PR7. 2026-07-22
- **"Save as rule" from a transaction edit** — promoted 2026-08-03 into the Open Work Queue as "Inline merchant-rule creation"; spec at [`rule-triage-flows.md`](rule-triage-flows.md).
- **Migrate existing local budget.db into Supabase** — users currently start fresh by re-uploading CSVs. A one-time importer (read SQLite → insert under the user's id) would preserve manual categorizations/notes. Surfaced by: hosted rewrite. 2026-07-22
- **Legacy Flask retirement** — once the hosted app is validated against real data, remove `app.py`/`database.py`/`templates/` etc. and collapse root docs to point at `web/`. Surfaced by: hosted rewrite. 2026-07-22

### Documentation gaps

_Docs that are missing, stale, or misleading (including `spec.md` drift)._

### Open questions

_Things to discuss that aren't shaped enough to be work-queue items yet._
