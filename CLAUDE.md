# Family Budget App — agent operating instructions

> This file is the contract every AI agent (and human) follows in this repo. It is loaded automatically by Claude Code. Read it fully before your first action in a session. Per-folder `CLAUDE.md` files add rules specific to that folder — read the one in a folder before writing a file there.

## Project orientation

Family Budget App is a **local-only** web app for a household (Sebi & Olivia) to track and understand spending across their Capital One and UCCU bank accounts. It runs entirely on the user's own machine at `http://127.0.0.1:5001`. There is **no cloud, no auth, no shared server**: each person clones the code and runs their own isolated copy against their own `budget.db`. The app is shareable *as code* — the database and raw bank CSVs never leave the machine and are never committed.

**The one load-bearing rule:** financial data is local and private. Nothing in this codebase may transmit, sync, upload, or phone home a user's transactions, account data, `budget.db`, or CSV exports. No telemetry, no analytics, no third-party API that receives financial data. If a change would send financial data off the device, it is wrong — see [`adr/001-local-only-no-cloud.md`](adr/001-local-only-no-cloud.md).

## Tech stack

- **Python 3 + Flask** — the app (`app.py`), served on port **5001** in debug mode. The Flask app object is `app.app`.
- **SQLite in WAL mode** — `budget.db` in the project folder, created on first run. All schema + queries live in `database.py`.
- **Jinja2 templates** (`templates/`) + **Tailwind CSS (CDN)** + **Chart.js / ECharts (CDN)** — no build step, no bundler, no `node_modules`.
- **Multi-bank CSV parsing** (`parser.py`) and **keyword/merchant-rule categorization** (`categorizer.py`) are pure-ish Python modules — the easiest and highest-value things to unit-test.
- **pytest** for tests, **ruff** for lint + format. Dev tools are in `requirements-dev.txt`.

There is deliberately **no** package manager beyond `pip`, no TypeScript, no Supabase, no Vercel, no Next.js. This app's whole point is that it runs offline on one machine. Do not add cloud services, a login system, or a database server without an ADR that revisits the local-only decision.

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
- Do not run destructive git commands (`git push --force`, `git reset --hard` on shared history) without explicit confirmation in chat. If the repo is pushed to GitHub, CI (`ruff` + `pytest`) must pass before merge.

## Spec-driven workflow rules

For anything larger than a one-file change, write the spec **before** implementation:

- Write it to `/specs/<short-name>.md` using the structure in [`/specs/TEMPLATE.md`](specs/TEMPLATE.md), with acceptance criteria in **EARS notation** (`WHEN <trigger>, the system SHALL <response>`). Use the `/specify` command.
- Summarize the spec back to the user before implementing.
- Trivial fixes can skip the separate spec but should still state acceptance criteria in the commit/PR body.

## Code style and tooling rules

- **Lint + format with ruff.** Ruff config is in `pyproject.toml`. Run `ruff check` and `ruff format --check` on the files you touched before claiming a task done. Don't hand-format against ruff or add a competing formatter (no black/flake8/isort — ruff does all three). Note: the legacy app modules (`app.py`, `database.py`, `parser.py`, `categorizer.py`) predate ruff and aren't normalized yet, so CI lints only `tests/` for now — normalizing them and widening CI is a tracked follow-up in [`/specs/proposed-tickets.md`](specs/proposed-tickets.md). New Python you write should be ruff-clean.
- **Tests ship with the feature**, in the same change — not a follow-up. Put them in `tests/` as `test_*.py`. The pure modules (`parser.py`, `categorizer.py`) and DB helpers (`database.py`) are the priority; run `pytest -q`.
- **Verify on a running server before marking anything done.** `bash start.sh` (or `python3 app.py`) must boot to `http://127.0.0.1:5001`, all nav tabs must load HTTP 200, and the feature you touched must work in the browser. Port stuck? `lsof -i :5001 -t | xargs kill -9`.
- **Keep parsing and categorization pure and testable.** `parser.detect_and_parse` and `categorizer.categorize` should stay free of DB/Flask imports so they can be unit-tested directly.

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

1. **Financial data stays on the device.** No code path may transmit transactions, account data, `budget.db`, or CSV contents to any network endpoint, third party, telemetry sink, or cloud service. (Load-bearing — [`adr/001-local-only-no-cloud.md`](adr/001-local-only-no-cloud.md).)
2. **Never commit financial data.** `*.db`, `*.db-shm`, `*.db-wal`, `*.csv`, and `uploads/` are gitignored and must never be added, even in tests or fixtures. Test fixtures use synthetic data only.
3. **Transfers are excluded from every spending/income/insight calculation.** Any query that totals, averages, or charts money filters out `category = 'Transfer'`. Adding a new metric means adding that filter — see the existing queries in `database.py`.
4. **Amounts are always stored positive; direction lives in `flow`** (`'debit'` or `'credit'`). Never store a signed amount. Never infer direction from the sign.
5. **Schema changes are additive, in-place migrations.** Follow the `_migrate_*` pattern in `database.py`: `ALTER TABLE ... ADD COLUMN` or `CREATE TABLE IF NOT EXISTS`, wrapped so an existing `budget.db` upgrades without data loss. Never rewrite or drop a user's data to change the schema. (See [`adr/003-additive-sqlite-migrations.md`](adr/003-additive-sqlite-migrations.md).)
6. **CSV re-uploads are idempotent.** The `UNIQUE(account_id, date, description, amount, flow)` constraint on `transactions` is what makes re-importing the same export safe (duplicates are skipped, not doubled). Don't weaken or bypass it.
7. **Merchant rules win over keyword matching** during categorization, and manual categorizations (`category_source = 'manual'`) are never overwritten by auto-categorization or rule re-application. (See [`adr/002-multi-bank-via-bank-format.md`](adr/002-multi-bank-via-bank-format.md) for the related bank-format decision.)
