# Family Budget App — agent operating instructions

> This file is the contract every AI agent (and human) follows in this repo. It is loaded automatically by Claude Code. Read it fully before your first action in a session. Per-folder `CLAUDE.md` files add rules specific to that folder — read the one in a folder before writing a file there.

## Project orientation

Family Budget App is a **hosted, multi-user** web app for a household (Sebi & Olivia) to track and understand spending across their Capital One and UCCU bank accounts. It runs as a **Next.js app on Vercel** backed by **Supabase** (managed Postgres + Auth), reachable from any device. Each person signs in and sees **only their own** data; isolation is enforced in the database by **Row-Level Security (RLS)**, not by running separate copies.

> **Architecture pivot in progress (2026-07-22, [ADR-004](adr/004-hosted-multi-user-supabase.md)).** The app is migrating from the original local-only Flask/SQLite stack to the hosted Next.js/Supabase stack. During the migration the legacy Flask app (`app.py`, `database.py`, `parser.py`, `categorizer.py`, `templates/`) still lives at the repo root as the reference implementation; the new app is built in [`web/`](web/). When the port is complete the Flask app is retired. Where a rule below says "legacy," it means the Flask code being ported out.

**The one load-bearing rule:** a user's financial data is visible only to that user. Every table holding user data carries a `user_id` and is protected by an RLS policy (`user_id = auth.uid()`), so no code path — even a buggy one — can return one user's transactions, accounts, `budget.db`-equivalent rows, or uploaded CSV contents to another user. The Supabase **`service_role` key never reaches the browser or the client bundle**; it lives only in server-side environment variables. No telemetry or third-party analytics receives financial data. If a change could leak one user's data to another or move the service key clientward, it is wrong — see [`adr/004-hosted-multi-user-supabase.md`](adr/004-hosted-multi-user-supabase.md).

## Tech stack

**Target stack (the hosted app, in [`web/`](web/)):**

- **Next.js (App Router) + TypeScript** — deployed on **Vercel**. Server Components + Route Handlers / Server Actions for data access; the Supabase `service_role` key is used **only** in server-side code.
- **Supabase** — managed **Postgres** (data), **Auth** (passwordless magic-link / OAuth), and **Storage**. All schema lives in `web/supabase/migrations/` as SQL migrations; **every table has `user_id` + RLS**.
- **Tailwind CSS** + a **first-party design system** (design tokens + reusable UI primitives in `web/components/ui/`). Charts via a React charting lib (ECharts/Recharts). Real build step, `package.json`, `node_modules`.
- **Pure, testable logic** — CSV parsing and categorization are ported to framework-free TypeScript modules (`web/lib/parser.ts`, `web/lib/categorizer.ts`) so they unit-test directly, just like the Python originals.
- **Vitest** for tests, **ESLint + Prettier** (or Biome) for lint/format, **`tsc --noEmit`** for typecheck.

**Legacy stack (being ported out, repo root):** Python 3 + Flask (`app.py`), SQLite `budget.db` (`database.py`), Jinja templates (`templates/`), `parser.py` + `categorizer.py`, pytest + ruff. Keep it working as the reference until the port is complete; don't add new features to it.

Do not add a payments processor, a bank-credential/Plaid integration, or move the `service_role` key toward the client without an ADR — see [ADR-004](adr/004-hosted-multi-user-supabase.md).

## Knowledge base pointer

Before asking the user for context, check these — the answer is often already written down:

- [`spec.md`](spec.md) — **the master source of truth** for what the app does, its data model, and the open work queue. Read it before starting any task. It uses in-line status tags (`[UNTOUCHED]`/`[IN PROGRESS]`/`[COMPLETED]`/`[BLOCKED]`) that you keep current.
- `/docs/` — long-lived "how it works" knowledge. Start with [`/docs/architecture.md`](docs/architecture.md) and [`/docs/conventions.md`](docs/conventions.md).
- `/specs/<NAME>.md` — a detailed spec for one non-trivial feature (written before implementing it).
- `/handoff/` — summaries of recent work sessions. Read the most recent one relevant to your task.
- `/adr/` — major, hard-to-reverse architecture decisions, numbered sequentially.

Each of these folders has its own `CLAUDE.md` with rules specific to it. Read it when you write a file there.

**How `spec.md` and these folders relate:** `spec.md` stays the canonical, always-current picture and work queue. `/docs/` is the durable reference extracted from it; `/specs/` holds one detailed EARS spec per non-trivial feature; `/adr/` records the *why* behind hard-to-reverse decisions (seeded from `spec.md`'s Decisions Log); `/handoff/` is the session trail. When these disagree, `spec.md` wins and you fix the drift.

## Work-queue and workflow rules

This project has **no Linear and no external tracker** — the work queue is the "Open Work Queue" section of [`spec.md`](spec.md). Treat each bullet there like a ticket.

- **Claim before you code.** Flip a queue item to `[IN PROGRESS]` in `spec.md` before writing code, and to `[COMPLETED — <date>: <what shipped>]` only after you've verified it end-to-end on a running server. Never leave a status stale.
- **Pick up `[UNTOUCHED]` items first**, in the priority order given (High → Medium → Low).
- **Don't delete items** — completed ones stay as the shipped record.
- Use the `/todo` command to see the queue and `/pickup` to start an item (they read `spec.md`, not a tracker).

## Git and branch rules

This is a git repo. `budget.db`, `*.csv`, `.venv/`, and secrets are gitignored and must **never** be committed (they contain real financial data) — see the Hard rules.

- Do work on feature branches off `main` when the change is non-trivial: `<type>/<short-description>` where type is `feat` / `fix` / `chore` / `docs`. Keep the description hyphenated and under ~5 words.
- Keep changes small and focused. Prefer a sequence of small commits/PRs over one large one.
- Use Conventional Commit messages: `feat: ...`, `fix: ...`, `chore: ...`, `docs: ...`.
- Do not run destructive git commands (`git push --force`, `git reset --hard` on shared history) without explicit confirmation in chat. CI must pass before merge: for `web/`, that's lint + typecheck + Vitest + `next build`; for the legacy Flask code, `ruff` + `pytest`.

## Spec-driven workflow rules

For anything larger than a one-file change, write the spec **before** implementation:

- Write it to `/specs/<short-name>.md` using the structure in [`/specs/TEMPLATE.md`](specs/TEMPLATE.md), with acceptance criteria in **EARS notation** (`WHEN <trigger>, the system SHALL <response>`). Use the `/specify` command.
- Summarize the spec back to the user before implementing.
- Trivial fixes can skip the separate spec but should still state acceptance criteria in the commit/PR body.

## Code style and tooling rules

- **Lint + format with ruff.** Ruff config is in `pyproject.toml`. Run `ruff check` and `ruff format --check` on the files you touched before claiming a task done. Don't hand-format against ruff or add a competing formatter (no black/flake8/isort — ruff does all three). Note: the legacy app modules (`app.py`, `database.py`, `parser.py`, `categorizer.py`) predate ruff and aren't normalized yet, so CI lints only `tests/` for now — normalizing them and widening CI is a tracked follow-up in [`/specs/proposed-tickets.md`](specs/proposed-tickets.md). New Python you write should be ruff-clean.
- **Tests ship with the feature**, in the same change — not a follow-up. Put them in `tests/` as `test_*.py`. The pure modules (`parser.py`, `categorizer.py`) and DB helpers (`database.py`) are the priority; run `pytest -q`.
- **Verify on a running server before marking anything done.** For `web/`: `npm run build` must pass and `npm run dev` must boot to `http://127.0.0.1:3000` with the feature working in the browser against a real Supabase project (or local Supabase). For legacy Flask: `python3 app.py` boots to `http://127.0.0.1:5001`. Port stuck? `lsof -i :3000 -t | xargs kill -9`.
- **Keep parsing and categorization pure and testable.** `web/lib/parser.ts` and `web/lib/categorizer.ts` (and their legacy `parser.detect_and_parse` / `categorizer.categorize` originals) stay free of DB/framework imports so they can be unit-tested directly.

## Communication and behavior rules

- When you make a decision the team needs to remember, write it down in the right place **as part of the same change**. Chats vanish; files persist. Durable "how it works" → `/docs/`; hard-to-reverse decisions → `/adr/` (`/new-adr`); session state → `/handoff/` (`/handoff`).
- On a vague instruction, ask **one** clarifying question, then proceed. Never invent files, function names, table columns, or library APIs. If you don't know, say so.
- If you're about to do something that contradicts a rule here or in a folder `CLAUDE.md`, **stop and ask.** Confident rule-breaking is worse than asking.
- If you keep correcting the same agent mistake, add a rule to the relevant `CLAUDE.md` in the same change. Teaching the repo its own conventions is part of the work.

## Proposing future work

During work you'll notice things worth doing that aren't part of the current task. Don't lose them and don't derail to fix them. Add them to the **Open Work Queue** in [`spec.md`](spec.md) as `[UNTOUCHED]`, or, if they're rough/half-formed ideas, append a bullet to [`/specs/proposed-tickets.md`](specs/proposed-tickets.md). Capture is cheap; lost observations are expensive.

## Session hygiene rules

- If a session has run long or the context feels heavy, suggest writing a handoff (`/handoff`) and starting fresh.
- Do not run destructive commands (`rm -rf`, `DROP TABLE`, deleting `budget.db`) without explicit confirmation in chat. Read-only and additive commands are fine.
- **Never delete or overwrite a user's `budget.db`.** It is their only copy of their financial data and is not in git. If a task seems to require resetting the DB, stop and ask.
- Do not modify `.env`/secret files. Tell the user which value to change and let them edit it.

## Hard rules — these are not preferences

These are domain invariants drawn from how the app actually works ([`spec.md`](spec.md)). State each as something you can check your diff against.

1. **A user's data is visible only to that user, enforced by RLS.** Every table holding user data has a `user_id` column and RLS policies scoping every row to `auth.uid()`. New tables ship with `user_id` + RLS **in the same migration** — never a table without it. No query, view, or RPC may return another user's rows. (Load-bearing — [`adr/004-hosted-multi-user-supabase.md`](adr/004-hosted-multi-user-supabase.md).)
2. **The `service_role` key is server-only; never commit secrets.** The `service_role` / service key and any DB connection string live only in server-side env vars (never `NEXT_PUBLIC_*`, never in the client bundle). `.env*` files are gitignored and never committed. The browser gets only the public `anon` key, which is inert without a session because of RLS. Test fixtures use synthetic data only — no real transactions or CSVs in the repo or CI, ever.
3. **Transfers are excluded from every spending/income/insight calculation.** Any query that totals, averages, or charts money filters out `category = 'Transfer'`. Adding a new metric means adding that filter — see the ported queries in `web/lib/` (and the legacy `database.py` for reference).
4. **Amounts are always stored positive; direction lives in `flow`** (`'debit'` or `'credit'`). Never store a signed amount. Never infer direction from the sign.
5. **Schema changes are additive, forward migrations.** Add a new timestamped SQL file to `web/supabase/migrations/`; use `ALTER TABLE ... ADD COLUMN` / `CREATE TABLE IF NOT EXISTS`. Never rewrite or drop a user's data to change the schema, and never edit an already-applied migration — write a new one. (Spirit of [`adr/003-additive-sqlite-migrations.md`](adr/003-additive-sqlite-migrations.md), carried into Postgres.)
6. **CSV re-uploads are idempotent.** A `UNIQUE(user_id, account_id, date, description, amount, flow)` constraint on `transactions` is what makes re-importing the same export safe (duplicates are skipped, not doubled). Don't weaken or bypass it.
7. **Merchant rules win over keyword matching** during categorization, and manual categorizations (`category_source = 'manual'`) are never overwritten by auto-categorization or rule re-application. (See [`adr/002-multi-bank-via-bank-format.md`](adr/002-multi-bank-via-bank-format.md) for the related bank-format decision.)
