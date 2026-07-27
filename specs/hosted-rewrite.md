# Hosted rewrite — Next.js + Supabase on Vercel

**Work-queue item:** "Migrate the app to a hosted, multi-user deployment (Vercel + Supabase) reachable from any device, with a first-class design system." (see spec.md Open Work Queue → *Hosted rewrite*)
**Status:** Approved
**Related:** [ADR-004](../adr/004-hosted-multi-user-supabase.md)

## Purpose

Move the Family Budget App from a local-only Flask/SQLite tool to a hosted, multi-user web app on **Vercel + Supabase**, reachable from any device, where each user sees only their own data (enforced by Postgres Row-Level Security) and the UI is rebuilt on a first-party design system. Feature parity with the current app is the target; the security model is the reason the rewrite is non-trivial.

## User-facing behavior

1. A user visits the hosted URL. If not signed in, they see a **sign-in screen** (Supabase Auth magic-link / OAuth). No app data is reachable while signed out.
2. After signing in, they land on the **Dashboard** and can navigate the same surfaces as today: Dashboard, Transactions, Monthly, Budget, Settings, Rules, Upload.
3. On first sign-in, their account is seeded with the four default accounts (Savor, Sebi Checking, Olivia Checking, Seblivia Savings) — scoped to them.
4. They upload a bank CSV (Capital One credit/bank, UCCU) on **Upload**; rows are parsed, categorized, and stored under their `user_id`. Re-uploading the same file imports nothing new (idempotent).
5. Every page shows only that user's data. Two different signed-in users never see each other's transactions, accounts, rules, goals, or budgets.
6. The whole UI uses one coherent design system (tokens, typography, spacing, components) and is responsive down to mobile.

## Data flow

Step-by-step, naming the new modules (`web/…`):

1. Request hits a Next.js **Route Handler / Server Action** (`web/app/**`). The user's session is read server-side via the Supabase server client (`web/lib/supabase/server.ts`), which uses the **anon** key + the user's auth cookie.
2. Queries go to Supabase Postgres **as the authenticated user**, so **RLS** restricts every row to `user_id = auth.uid()`. Money aggregations exclude `category = 'Transfer'`.
3. CSV parsing calls the pure module `web/lib/parser.ts` → `detectAndParse(bytes, bankFormat, merchantRules)`, which calls `web/lib/categorizer.ts` → `categorize(...)`. Neither imports Supabase or Next.
4. The Server Component renders using design-system primitives in `web/components/ui/`; charts get JSON from server or a route handler.
5. The `service_role` key is used **only** in trusted server-side admin paths (e.g. a first-sign-in seed) via `web/lib/supabase/admin.ts`, never exposed to the client.

## Acceptance criteria (EARS)

**Auth & isolation**
- WHEN an unauthenticated request hits any app route other than the auth routes, the system SHALL redirect to sign-in and return no user data.
- WHEN user A is signed in, the system SHALL return only rows where `user_id = A` for every table, enforced by RLS at the database (not only in application code).
- WHEN a query is attempted against another user's row id, the system SHALL return nothing (RLS denies), not that row.
- WHERE the Supabase `service_role` key is referenced, the system SHALL reference it only in server-side modules and NEVER in any `NEXT_PUBLIC_*` var or client component.

**Data invariants (carried from the current app)**
- WHEN a transaction is stored, the system SHALL store `amount` as a positive number and direction in `flow` (`'debit'`/`'credit'`).
- WHEN any spending/income/insight total, average, or chart is computed, the system SHALL exclude `category = 'Transfer'`.
- WHEN the same CSV is uploaded twice, the system SHALL skip duplicate rows via `UNIQUE(user_id, account_id, date, description, amount, flow)`.
- WHEN categorizing, the system SHALL apply merchant rules before keyword matching, and SHALL NOT overwrite a transaction whose `category_source = 'manual'`.
- WHEN a schema change is needed, the system SHALL add a new forward migration in `web/supabase/migrations/` and SHALL NOT edit an applied migration or drop user data.

**Deploy & CI**
- WHEN a PR is opened, CI SHALL run lint + typecheck + Vitest + `next build` for `web/` and pass before merge.
- WHEN `web/` is deployed to Vercel, the app SHALL read Supabase URL + keys from Vercel env vars, with the `service_role` key marked server-only.

## Files to touch

New app lives under `web/` (Flask code at root stays as reference until cutover):

- `web/` — Next.js app: `app/` (routes/pages), `components/ui/` (design system), `lib/` (parser, categorizer, supabase clients, queries).
- `web/supabase/migrations/*.sql` — Postgres schema + RLS policies + seed.
- `web/lib/parser.ts`, `web/lib/categorizer.ts` — ports of `parser.py` / `categorizer.py`.
- `web/**/*.test.ts` — Vitest ports of the pytest suite.
- `.github/workflows/web-ci.yml` — CI for the Next.js app.
- Docs: `adr/004-*.md`, this spec, `spec.md`, `CLAUDE.md` (done in PR1).

## Out of scope

- Bank-credential linking / Plaid — explicitly excluded (we keep CSV upload).
- Payments, billing, or any money movement.
- Real-time collaboration / shared households viewing the same data (each user is isolated; a future "shared household" is a separate decision).
- Migrating existing local `budget.db` data into Supabase (users start fresh by re-uploading CSVs; a data-import tool can be a later ticket).

## Open questions

- Auth method: magic-link only, or also Google OAuth? (Default: magic-link first, OAuth easy to add.) — **decide in PR3.**
- Charting lib: ECharts (matches current sunburst/Sankey) vs Recharts. (Default: ECharts via a React wrapper to preserve the sunburst/Sankey.) — **decide in PR5.**

## Test plan

- Unit (Vitest): `web/lib/parser.test.ts`, `web/lib/categorizer.test.ts` — ports of the pytest cases (Transfer detection, positive amounts, flow, merchant-rule priority, per-bank parsing).
- RLS: a test that signing in as user B cannot read user A's rows.
- Manual: sign in on desktop + phone, upload a synthetic CSV, walk every nav tab, confirm totals exclude Transfers and no cross-user leakage.
