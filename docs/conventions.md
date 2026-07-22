# Conventions

**Last reviewed:** 2026-07-22

Small, reversible choices live here (big, hard-to-reverse ones become ADRs). Add to this file instead of re-deciding the same thing every change.

## Naming

- Python files/modules: lowercase (`parser.py`, `categorizer.py`). Functions: `snake_case`.
- Templates: one `.html` per page under `templates/`, named for the route (`transactions.html` for `/transactions`).
- Branches: `<type>/<short-desc>` — `feat`/`fix`/`chore`/`docs` (see root `CLAUDE.md`).
- Commits: Conventional Commits — `feat: ...`, `fix: ...`, `chore: ...`, `docs: ...`.
- Tests: `tests/test_<module>.py`.

## Python

- Target Python 3. Standard library first; the only runtime dependency is Flask (`requirements.txt`). Don't add a dependency without a clear reason — every dep is something each user must `pip install` locally.
- Lint + format with **ruff** only (`ruff check .`, `ruff format .`). No black/flake8/isort.
- Keep `parser.py` and `categorizer.py` free of Flask/DB imports so they stay unit-testable in isolation.

## Data & SQLite

- All DB access goes through `database.py` helpers — routes in `app.py` don't write SQL inline.
- **Always parameterize queries** (`?` placeholders). Never f-string user input into SQL. (The few f-strings in `database.py` interpolate only internally-derived, validated values like `int(account_id)` and fixed month strings — keep it that way.)
- Amounts are stored **positive**; direction is `flow` (`'debit'`/`'credit'`).
- **Transfers** (`category = 'Transfer'`) are excluded from every spending/income/insight aggregate. New metric → add the filter.
- Schema changes are **additive** `_migrate_*` functions (see [`adr/003-additive-sqlite-migrations.md`](../adr/003-additive-sqlite-migrations.md)); never rewrite a user's `budget.db`.

## Categorization

- Priority is fixed: saved **merchant rules → keyword `RULES` → `raw_category` fallback → `Uncategorized`**.
- Manual categorizations set `category_source = 'manual'` and are never overwritten by auto-categorization or rule re-application.

## Error handling

- No bare `except: pass` that hides an error the user needs to see. Log with context, return a user-safe message/flash.

## Adding a convention

When you catch yourself (or an agent) re-deciding something, write the decision here in the same change. If it's hard to reverse or spans modules, write an ADR instead (`/new-adr`).
