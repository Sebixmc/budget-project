# Family Budget App — Spec

---

## ⚠️ Instructions for AI Agents

This spec is the source of truth for the project's state and the work queue. **Read it before starting any task.**

> **Repo guardrails (added 2026-07-22).** This project now also carries the startup-infrastructure agent scaffolding, adapted for its local-only Flask stack: root [`CLAUDE.md`](CLAUDE.md) (the agent contract + hard rules), per-folder `CLAUDE.md` files, `.claude/` subagents and slash commands (`/orient`, `/todo`, `/pickup`, `/specify`, `/handoff`, `/new-adr`, `/review-pr`), and the `docs/` · `specs/` · `adr/` · `handoff/` folders. **This file (`spec.md`) remains the master source of truth and the work queue** — the new folders add detail around it: `docs/` is durable reference, `specs/` holds per-feature EARS specs, `adr/` records why (seeded from the Decisions Log below), `handoff/` is the session trail. Start a session with `/orient`.

### Status convention

Every actionable item in this spec ends with a status tag. When you work on an item, update its tag in-place — never leave it stale.

| Tag | When to use |
|---|---|
| `[UNTOUCHED]` | Nobody has started this yet |
| `[IN PROGRESS]` | An agent is actively working on it (or paused mid-flight) |
| `[COMPLETED]` | Shipped and verified working |
| `[BLOCKED: reason]` | Can't proceed — say why (e.g. needs user input, dependency missing) |

### Rules

1. **Pick up `[UNTOUCHED]` items first.** If there are none, look for `[IN PROGRESS]` items that may have been abandoned (check git log to confirm).
2. **Flip to `[IN PROGRESS]` *before* you start writing code.** This signals to other agents/humans that the work is claimed.
3. **Flip to `[COMPLETED]` only after** you've manually verified the feature works end-to-end on a running server. Add a one-line note: `[COMPLETED — <date>: <what was done>]`.
4. **Don't delete items.** Even completed ones stay so future agents can see what shipped.
5. **If you add new work,** append it under "Open Work Queue" with `[UNTOUCHED]`.
6. **If the spec is wrong,** fix it. The spec drifts when code lands without doc updates — that's a bug.

### Verification baseline

Before marking anything `[COMPLETED]`, the server must run cleanly: `python3 app.py` boots to `http://127.0.0.1:5001`, all 8 nav tabs load with HTTP 200, and the feature you touched works in the browser. Port already in use? `lsof -i :5001 -t | xargs kill -9`.

---

## What It Is

A local-only web app for Sebi & Olivia to track and understand spending across their Capital One and UCCU (Utah Community Credit Union) accounts. Runs entirely on the user's machine at `http://127.0.0.1:5001`.

It is also designed to be **shareable as code** — anyone can clone the repo and run their own isolated copy, with no shared server, no login, and no way to see each other's financial data.

---

## Running Your Own Copy

Each person runs a completely independent instance of this app. There is no shared server, no login, and no way to see anyone else's data — isolation is total by design.

### Setup (first time)
```bash
# 1. Get the code (clone or download the project folder)
# 2. Run the start script — it creates a venv, installs deps, launches the app
bash start.sh
# Or manually:
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 app.py
```
Open `http://127.0.0.1:5001` in your browser.

### Your data stays local
- `budget.db` is created automatically on first run — this is your database.
- It is listed in `.gitignore` and will never be committed to the repo.
- Deleting `budget.db` wipes everything and starts fresh.
- To back up your data: copy `budget.db` somewhere safe.

### Sharing the code without sharing data
If you push this project to GitHub or share the folder, `.gitignore` excludes:
- `*.db`, `*.db-shm`, `*.db-wal` (your SQLite database)
- `*.csv` (your raw bank exports)
- `.venv/`, `__pycache__/`, `.env`
- `.claude/`, `uploads/`, `.DS_Store`

The other person gets a clean empty app on their machine. Your financial data never leaves your computer.

---

## Tech Stack
- **Backend:** Python 3 + Flask (port 5001, debug mode)
- **Database:** SQLite in WAL mode — `budget.db` in the project folder
- **Frontend:** Jinja2 templates, Tailwind CSS (CDN), Chart.js (CDN), ECharts 5 (CDN)
- **No auth, no cloud, no external services**

---

## Accounts

Accounts are seeded on first DB init with the defaults below, but the user can add/edit/delete accounts via the **Settings** tab. Each account has a `bank_format` that determines which CSV parser handles its uploads.

| Name | Type | Owner | Bank format |
|---|---|---|---|
| Savor Credit Card | Credit | Joint | `capital_one_credit` |
| Sebi Checking | Checking | Sebi | `capital_one_bank` |
| Olivia Checking | Checking | Olivia | `capital_one_bank` |
| Seblivia Savings | Savings | Joint | `capital_one_bank` |

Supported `bank_format` values: `capital_one_credit`, `capital_one_bank`, `uccu_checking`.

---

## Database

All writes hit SQLite immediately. WAL mode is on so reads never block writes and there's no in-memory state between requests.

### Tables

**`accounts`** — bank accounts. `bank_format` column added via migration (`_migrate_bank_format`); defaults to `capital_one_bank` for legacy rows.

**`transactions`**
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| account_id | FK → accounts | |
| date | TEXT (YYYY-MM-DD) | |
| description | TEXT | Cleaned merchant name |
| amount | REAL | Always positive |
| flow | TEXT | `'debit'` or `'credit'` |
| category | TEXT | Auto or manually set |
| category_source | TEXT | `'auto'` or `'manual'` |
| notes | TEXT | User-added context |
| raw_category | TEXT | Bank's original category label (when provided) |
| upload_batch | TEXT | Short ID grouping one CSV upload |

Unique constraint on `(account_id, date, description, amount, flow)` — re-uploading the same CSV is safe, duplicates are skipped.

**`uploads`** — log of every CSV import (account, filename, timestamp, rows imported/skipped).

**`merchant_rules`** — saved categorization patterns.
- `pattern` (UNIQUE, lowercased): substring matched against transaction descriptions
- `category`: target category to assign
- Used during CSV import (rules take priority over keyword matching) and can be re-applied to existing auto-categorized transactions

**`goals`** — savings goals shown on the dashboard.
- `name`, `target_amount`, `current_amount` (self-reported), `color`, `target_date`, `notes`

**`rainy_day_log`** — emergency fund balance history.
- Self-reported balance entries with timestamps. Current balance = latest row. Old entries are kept as history.

**`budget_categories`** — user's planned monthly limits per category.
- `category` (PK), `monthly_limit`, `flow_type` (`'expense'` or `'income'`, added via `_migrate_flow_type`)
- Only categories that have been explicitly added by the user appear here

**`budget_income`** — single-row table with the user's estimated monthly income.
- `id=1` CHECK constraint, `monthly_estimate` (REAL), `updated_at`
- Used by the Sankey diagram as the income source value if set; falls back to historical average

---

## CSV Parsing

`parser.py` exposes `BANK_FORMATS` (a dict of format keys to display names) and `detect_and_parse(file_bytes, bank_format, merchant_rules=None)` which routes to the right sub-parser based on the account's `bank_format`.

### `capital_one_credit` (Savor)
Columns: `Transaction Date, Posted Date, Card No., Description, Category, Debit, Credit`
- Debit → `flow='debit'`, Credit → `flow='credit'`
- Capital One's `Category` stored as `raw_category` (fallback if keyword matching fails)

### `capital_one_bank` (Checking / Savings, 360 accounts)
Columns: `Account Number, Transaction Description, Transaction Date, Transaction Type, Transaction Amount, Balance`
- `Transaction Type=Debit` → `flow='debit'`; `Credit` → `flow='credit'`
- Description cleaned: `"Debit Card Purchase - MERCHANT CITY ST"` → `"MERCHANT CITY ST"`
- Notes baked into description (`"for textbook - Deposit from..."`) are extracted to `notes`
- Any description containing `XXXXXXX` (Capital One's masked account format) is auto-categorized as `Transfer`
- Date parser handles both `M/D/YYYY` and `M/D/YY` formats

### `uccu_checking` (Utah Community Credit Union)
Columns: `Account Number, Post Date, Check, Description, Debit, Credit, Status, Balance, Classification`
- Only rows with `Status=="Posted"` are imported
- Date format: `M/D/YYYY`
- Classification field has HTML entities (`&amp;`) — unescaped via `html.unescape()`
- `Classification == "Transfer"` → auto-categorized as Transfer
- UCCU classification labels are mapped via fallback (e.g. `Food & Dining` → `Dining`, `Banking Fee` → `Fees & Charges`)

---

## Auto-Categorization

`categorize(description, raw_category='', merchant_rules=None)` in `categorizer.py`.

**Priority order:**
1. Saved merchant rules (if `merchant_rules` provided) — substring match
2. Keyword RULES list — first match wins
3. `raw_category` fallback map (used for Capital One's category labels and UCCU's classifications)
4. `Uncategorized`

`ALL_CATEGORIES` (sorted, used everywhere the UI needs to list categories):
`Dining, Education, Entertainment, Fees & Charges, Fitness, Gas & Fuel, Groceries, Health & Medical, Home & Garden, Income, Other, Pet, Rent & Housing, Savings & Investments, Shopping, Subscriptions, Transfer, Transportation, Travel, Uncategorized, Utilities`

Transfers are **excluded from all dashboard/insight calculations** — they never appear in spending totals, charts, or averages.

---

## Pages

### Dashboard (`/`)
- Month + account filter (defaults to **all time** — empty `month` query string)
- KPI cards: Total Spent, Total Income, Net, Transaction Count
- ECharts sunburst (3-level: Spending/Income → Category → Transaction)
  - **Expandable on click**: clicking a leaf swaps the grid layout (`lg:grid-cols-2` → `lg:grid-cols-3`), grows the sunburst to span 2 cols at 520px height, drops the monthly bar chart down a row, and reveals a right-side detail panel
  - Detail panel has 3 states: empty / branch summary / leaf with editable category dropdown that saves to DB on change
  - Collapse button reverts the layout
  - Outer leaves inherit their parent category's color (via `assignColors()` in JS)
- Monthly spending bar chart (last 13 months)
  - Clicking a bar navigates to `/monthly?month=YYYY-MM`
  - Selected month highlighted lighter
- Top 15 merchants (bar)
- Category breakdown table with % of total
- **Goals widget** — grid of goal cards with color progress bars, "% complete", days-until-target
  - Inline "+ Add Goal" form, click a card to edit (modal) or delete
- **Rainy day widget** — current balance prominent, history log of recent updates, inline "Update Balance" form

### Transactions (`/transactions`)
- Filters: month, account, category, flow (spending/income), search, hide-transfers toggle
- Checkbox column with select-all
- Bulk action bar — appears when ≥1 row is checked, applies category to all selected
- Inline category dropdown saves immediately
- Inline notes field saves on blur or Enter
- Manual-edit badge (✎) next to manually categorized rows
- **"Save as rule?" floating panel** — appears after a single category change with an editable pattern (pre-filled with the merchant description) and a checkbox to apply the rule to existing auto-categorized matches. Saves to `merchant_rules` so future imports auto-categorize this merchant.

### Monthly (`/monthly`)
- Month selector
- KPI cards: Spent, Income, Net this month + rolling average
- Line chart: income vs spending across all months, selected month highlighted, dashed average lines
- Sunburst scoped to the selected month — click a leaf for the edit modal
- Category table: this month's spend, all-month rolling average, delta vs average, same-calendar-month average (e.g. all Aprils — shows `—` until 2+ years of data)

### Budget (`/budget`) — **planning only, no actuals**
This tab is intentionally void of actual spending data. It's a tool to *plan* what your budget should be, informed by historical averages. The budget-vs-reality comparison lives elsewhere (dashboard / monthly).

- **Period selector pills**: `All time | Last 3 months | Last month | <same-month picker>` — changes the historical avg shown per row via JS fetch, no page reload
- **Sankey diagram** (ECharts) — appears once at least one expense-type category has a positive budget
  - Source node: `Income` (size = user's estimated monthly income, falls back to historical avg)
  - Target nodes: each budgeted expense category sized to its `monthly_limit`
  - `Unallocated` node shown when income > sum of budgets (otherwise meta shows ⚠️ Over by $X)
  - Meta text labels source as `Estimated income` or `Avg income` based on whether the user set an estimate
- **Budget table** — three columns only: `Category | Avg / month | Your Budget`
  - **Empty by default.** Categories only appear when the user explicitly adds them via the "Add to budget" row
  - First row pinned: `↑ Monthly Income` (special row, distinct emerald styling) — user enters their estimated monthly income here; this drives the Sankey
  - Each added row has: category name + flow_type badge (`expense` or `income`) + remove × button
  - Inputs save on blur to `POST /api/budget/categories`
  - Footer totals row sums avg + budget across added categories only
- **Add to budget** card below the table — category dropdown (only categories not already added), Expense/Income toggle pills, "+ Add" button. New rows appear instantly and are saved with `monthly_limit=0` (target unset until user types one)
- Income-tagged rows are excluded from the Sankey (they aren't expense outflows)

### Settings (`/settings`)
- Account cards with view/edit modes
- Edit: name, owner, `bank_format` (dropdown from `BANK_FORMATS`)
- Delete account: confirmation modal showing transaction count; cascades to `transactions` + `uploads` rows
- Add account form: name, owner, type, bank_format

### Rules (`/rules`)
- Table of saved merchant rules (pattern, category, created date)
- Add rule manually
- Delete individual rules
- "Re-apply all rules to existing transactions" — runs every rule against all `category_source='auto'` rows

### Upload (`/upload`)
- Account picker (lists each account with its `bank_format`)
- CSV file picker
- Capital One + UCCU export instructions
- Upload history (last 20 uploads with imported/skipped counts)

### ~~Breakdown~~ (removed)
The old `/breakdown` page was removed. Its functionality was folded into the expandable sunburst on the dashboard. The route file `templates/breakdown.html` still exists but isn't linked from the nav.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/insights` | Dashboard data (by_category, top_merchants, monthly_totals, KPIs) |
| GET | `/api/monthly` | Full monthly report (KPIs, trend, category averages) |
| GET | `/api/sunburst` | Nested tree for ECharts sunburst (includes tx_id on leaves) |
| POST | `/api/transaction/<id>/category` | Update single transaction category |
| POST | `/api/transaction/<id>/notes` | Update single transaction notes |
| POST | `/api/transactions/bulk-category` | Bulk-update category on N transactions |
| GET, POST | `/api/merchant-rules` | List / create merchant rules |
| DELETE | `/api/merchant-rules/<id>` | Delete a rule |
| POST | `/api/merchant-rules/reapply` | Re-apply every rule to existing auto transactions |
| POST | `/api/accounts` | Create account |
| PATCH | `/api/accounts/<id>` | Update account (name, owner, bank_format) |
| DELETE | `/api/accounts/<id>` | Delete account + all its transactions |
| GET, POST | `/api/goals` | List / create goals |
| PATCH | `/api/goals/<id>` | Update a goal (name, target, current_amount, etc.) |
| DELETE | `/api/goals/<id>` | Delete a goal |
| GET, POST | `/api/rainy-day` | Get current balance / record a new balance |
| GET, POST | `/api/budget/categories` | List budget categories / upsert one (with flow_type) |
| DELETE | `/api/budget/categories/<category>` | Remove a category from the budget |
| GET, POST | `/api/budget/income` | Get / set user's monthly income estimate |
| GET | `/api/budget/averages?period=...` | Returns `{cat: avg}` for `all`/`3mo`/`1mo`/`YYYY-MM`. Also includes `__income__` key for income avg over the same period |
| GET | `/api/budget/sankey` | Sankey nodes + links + meta for the budget planning chart |

---

## File Map

```
app.py                       Flask app: routes + API endpoints
database.py                  SQLite schema, migrations, all DB queries
parser.py                    Multi-bank CSV parsing (BANK_FORMATS + detect_and_parse)
categorizer.py               Keyword rules + ALL_CATEGORIES + merchant_rules integration
requirements.txt             Python deps
start.sh                     Sets up .venv, installs deps, launches app
.gitignore                   Excludes *.db, *.csv, .venv/, .claude/, etc.
budget.db                    SQLite database (gitignored, created on first run)
spec.md                      THIS FILE — source of truth for state + open work
templates/
  base.html                  Layout, nav, Tailwind config, global styles
  dashboard.html             Home page: KPIs, sunburst, monthly bar, goals, rainy day
  transactions.html          Transaction list with filters + bulk actions + rules panel
  monthly.html               Single-month detail view with line + sunburst
  budget.html                Planning-only budget tab with Sankey
  settings.html              Account CRUD
  rules.html                 Merchant rules CRUD
  upload.html                CSV upload with bank-specific instructions
  breakdown.html             (removed from nav, file still exists)
```

---

## Open Work Queue

Pick up `[UNTOUCHED]` items in priority order. Add new items as `[UNTOUCHED]` if you discover them.

### High priority

- [ ] **Budget vs reality comparison in dashboard/monthly** — when the user has budget targets set, show a "$X of $Y budgeted (Z% used)" indicator per category on the dashboard's category breakdown table and on the monthly tab. Color: green if under, amber/red if over. `[UNTOUCHED]`
- [ ] **Olivia's Checking CSV** — confirm a UCCU or Capital One export from her checking account uploads cleanly end-to-end. Watch for unexpected description formats or classification labels not yet in the fallback map. `[UNTOUCHED]`
- [ ] **Savor Credit Card CSV upload** — confirm the `capital_one_credit` parser path imports successfully with a real Savor export. `[UNTOUCHED]`

### Medium priority

- [ ] **Manual transaction entry** — let the user add a cash purchase or anything not in a CSV. Probably a button on the Transactions tab that opens a small form (date, description, amount, flow, category, account, optional notes). `[UNTOUCHED]`
- [ ] **Delete transaction** — let the user remove a bad import (per-row × button or bulk-delete in the same flow as bulk-category). `[UNTOUCHED]`
- [ ] **Category rename / merge** — let the user rename "Other" or consolidate two categories. UPDATE across all transactions + update `budget_categories` if the renamed category had a budget. `[UNTOUCHED]`
- [ ] **Export filtered transactions as CSV** — on the Transactions page, an "Export" button that downloads whatever's matching the current filters. `[UNTOUCHED]`
- [ ] **Net worth tracker** — manually input account balances over time. Probably a new tab or a section on the dashboard. Decide: per-account balance log vs single total. `[UNTOUCHED]`

### Low priority / future

- [ ] **Shared access over home network** — currently bound to 127.0.0.1. Once Sebi's home network is set up, switch to `0.0.0.0` and decide on a minimal auth mechanism so it's still safe to expose. `[UNTOUCHED]`
- [ ] **Same-month year-over-year comparison** — already in `get_monthly_report()` via `cal_avg_by_cat` and `same_month_avg`. Will start showing real numbers automatically once 2+ years of data exist. `[UNTOUCHED]`
- [ ] **End-to-end manual verification pass** — walk every nav tab, every form, every API endpoint with current data; note anything broken or weird. `[UNTOUCHED]`
- [ ] **Goal contribution from transactions** — let the user mark a transaction (e.g. a savings transfer) as a contribution to a specific goal, which updates that goal's `current_amount` automatically. Currently goals are fully self-reported. `[UNTOUCHED]`
- [ ] **Budget period flexibility** — currently all budgets are monthly. Consider allowing weekly/biweekly/annual budgets per category. `[UNTOUCHED]`

### Completed (do not delete)

- [x] Merchant rules system — save rule from a manual category edit, apply on future imports, re-apply across existing rows. `[COMPLETED — 2026-04-28]`
- [x] UCCU CSV support + multi-bank format system (`bank_format` field routes to the right parser). `[COMPLETED — 2026-05-07]`
- [x] `.gitignore` + per-user isolation (everyone runs their own copy with their own `budget.db`). `[COMPLETED — 2026-05-07]`
- [x] Delete bank accounts (cascades to transactions and uploads) — in Settings. `[COMPLETED — 2026-05-07]`
- [x] Dashboard defaults to all-time (was incorrectly defaulting to most recent month). `[COMPLETED — 2026-05-07]`
- [x] Sunburst outer leaves inherit parent category color (was rendering grey because `colorFor()` returned a truthy fallback). `[COMPLETED — 2026-05-07]`
- [x] Breakdown tab folded into expandable sunburst on the dashboard. `[COMPLETED — 2026-05-07]`
- [x] Goals widget on dashboard (CRUD + progress bars + edit modal). `[COMPLETED — 2026-05-07]`
- [x] Rainy day fund widget on dashboard (balance + history log). `[COMPLETED — 2026-05-07]`
- [x] Budget tab with Sankey, period selector, historical averages. `[COMPLETED — 2026-05-07]`
- [x] Monthly income estimate (`budget_income` table) drives Sankey source node, falls back to historical avg. `[COMPLETED — 2026-05-07]`
- [x] Budget table starts blank; user adds categories explicitly with Income/Expense type toggle and × remove button. `[COMPLETED — 2026-05-07]`
- [x] Budget tab stripped of actuals/delta — pure planning surface. `[COMPLETED — 2026-05-07]`

---

## Decisions Log

Short record of architectural/UX decisions so future agents understand the *why*.

- **Local-only, no auth, share-the-code model** — chosen over a shared server with login to avoid password loops, account management complexity, and the security burden of holding multiple users' financial data. Each person's data lives on their own machine, full stop.
- **Multi-bank via `bank_format` field on accounts** — chosen over branching on account type (`checking` vs `credit`) so we can add UCCU/Ally/etc. without growing the type enum, and so the same account type can have different CSV formats per bank.
- **Merchant rules priority** — rules win over keyword matching during import. Rationale: if the user explicitly told the system "this merchant is X", that's higher signal than any heuristic.
- **Budget tab is planning-only** — actuals/deltas were removed intentionally so the page is a clean decision-making surface. The budget-vs-reality view lives on dashboard/monthly where actuals already live.
- **Income estimate prefers user value over historical avg** — once a user sets it, that's their plan. The historical avg is shown as a reference but doesn't override the user's intent.
- **`Income` excluded from Budget tab's expense category dropdown** — the `↑ Monthly Income` row at the top of the budget table handles income separately, so the per-category Income choice would be redundant/confusing.
