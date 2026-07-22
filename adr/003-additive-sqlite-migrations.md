# ADR-003: Additive, in-place SQLite migrations (never rewrite the user's DB)

**Status**: Accepted
**Date**: 2026-05-07
**Deciders**: Sebi

## Context

Because the app is local-only ([ADR-001](001-local-only-no-cloud.md)), every user's `budget.db` is the *only* copy of their financial data, and it lives on their machine — there is no central database the developer controls and no migration pipeline that runs on deploy. When the schema evolves (a new column, a new table), an already-running user's database must upgrade itself the next time they pull the code and launch, without losing any data and without the user running any migration command.

## Decision

Schema evolution is done with **additive, idempotent migrations** run at startup from `init_db()` in `database.py`. The base schema uses `CREATE TABLE IF NOT EXISTS`; changes are `_migrate_*` functions that do `ALTER TABLE ... ADD COLUMN` (wrapped in try/except to no-op if the column already exists) or `CREATE TABLE IF NOT EXISTS` for new tables, plus careful data backfills (e.g. seeding `budget_income_sources` from the legacy single-row estimate). Migrations never drop or rewrite user data. This is hard rule #5 in the root `CLAUDE.md`.

## Consequences

- **Positive:** Any existing `budget.db` upgrades in place on next launch — no manual steps, no data loss, no reset.
- **Positive:** Old and new code tolerate each other's schemas reasonably well because changes are additive.
- **Negative:** The schema only grows — columns aren't removed or renamed in place, so some legacy columns/tables linger (e.g. the single-row `budget_income` kept alongside `budget_income_sources`). That's an accepted cost of never resetting user data.
- **Constraint on future work:** No destructive migration, no "drop and recreate," no `budget.db` reset as part of a feature. If a change genuinely can't be done additively, it needs its own ADR and an explicit, opt-in, data-preserving path.

## Alternatives Considered

- **A migration framework (Alembic) with versioned up/down scripts:** rejected as overkill for a single-file SQLite app with no server and no shared DB; it adds a dependency and ceremony for what a handful of guarded `ALTER`s handle.
- **Reset the DB on schema change (drop + recreate + re-import):** rejected — it would destroy the user's only copy of their categorized history and self-reported goals/rainy-day/budget data, which never came from a re-importable CSV.
