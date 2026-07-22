# Architecture

**Last reviewed:** 2026-07-22

> How the app is put together. Under a page on purpose — the full data model and page-by-page behavior live in [`/spec.md`](../spec.md); this is the map, not the territory.

## System shape

A single-process Flask app serving server-rendered Jinja2 pages plus a JSON API that the pages call for charts. Everything runs on one machine; SQLite is the only store.

```
Browser ──HTTP──> Flask (app.py, 127.0.0.1:5001, debug)
                     │   render_template(...)        ← Jinja2 pages in templates/
                     │   jsonify(...)                ← /api/* endpoints for charts
                     ▼
                  database.py  ──sqlite3──> budget.db  (WAL mode, gitignored)
                     ▲
   parser.py (CSV → normalized rows) ──> categorizer.py (assign a category)
```

No bundler, no `node_modules`. Tailwind, Chart.js, and ECharts load from CDNs in `templates/base.html`. There is no build step: edit a `.py` or `.html` file and reload.

## Key modules

- **`app.py`** — the Flask app object (`app.app`), all page routes and `/api/*` endpoints. Calls `db.init_db()` at import. Thin: it parses request args, calls `database.py`, and renders a template or returns JSON.
- **`database.py`** — the SQLite schema, the `_migrate_*` in-place migrations, and every query. `DB_PATH` is a module global (`budget.db` next to the file); it's read at call time, so tests can point it at a temp file before importing `app`.
- **`parser.py`** — `BANK_FORMATS` (format key → display name) and `detect_and_parse(file_bytes, bank_format, merchant_rules=None)`, which routes to the right per-bank sub-parser and returns normalized rows (positive `amount` + `flow`).
- **`categorizer.py`** — `categorize(description, raw_category='', merchant_rules=None)`, `ALL_CATEGORIES`, and the keyword `RULES`. Priority: merchant rules → keywords → `raw_category` fallback → `Uncategorized`.
- **`templates/`** — one Jinja2 file per page plus `base.html` (layout, nav, Tailwind config). See [`templates/CLAUDE.md`](../templates/CLAUDE.md).

## Data flow (a CSV upload, the core path)

1. User picks an account + CSV on `/upload` → `POST /upload` in `app.py`.
2. `parser.detect_and_parse(bytes, account.bank_format, merchant_rules)` normalizes rows: cleans the description, sets positive `amount` + `flow`, and asks `categorizer.categorize(...)` for a category (merchant rules applied here so imports land pre-categorized).
3. `database.insert_transactions(rows, account_id, batch_id)` inserts, relying on `UNIQUE(account_id, date, description, amount, flow)` to skip duplicates → returns `(imported, skipped)`.
4. `database.log_upload(...)` records the batch. The dashboard/monthly/budget pages then read aggregates via `/api/*`, all of which exclude `category = 'Transfer'`.

## The load-bearing rule

Financial data stays on the device — no network path may transmit transactions, account data, `budget.db`, or CSV contents anywhere. See the root [`CLAUDE.md`](../CLAUDE.md) hard rules and [`adr/001-local-only-no-cloud.md`](../adr/001-local-only-no-cloud.md).
