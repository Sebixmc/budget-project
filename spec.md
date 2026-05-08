# Family Budget App — Spec

## What It Is
A local-only web app for Sebi & Olivia to track and understand spending across their Capital One accounts. Runs entirely on their Mac at `http://127.0.0.1:5001`. Start it with `python3 app.py` from the project folder.

## Running Your Own Copy

Each person runs a completely independent instance of this app. There is no shared server, no login, and no way to see anyone else's data — isolation is total by design.

### Setup (first time)
```bash
# 1. Get the code (clone or download the project folder)
# 2. Run the start script — it checks Python, installs deps, and launches
bash start.sh
# Or directly:
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
If you push this project to GitHub or share the folder:
- `.gitignore` ensures `*.db`, `.claude/`, and `*.csv` are excluded.
- The other person gets a clean empty app on their machine.
- Your financial data never leaves your computer.

---

## Accounts
| Name | Type | Owner | Cap One Account # |
|------|------|-------|-------------------|
| Savor Credit Card | Credit | Joint | — |
| Sebi Checking | Checking | Sebi | ...3358 |
| Olivia Checking | Checking | Olivia | ...8919 |
| Seblivia Savings | Savings | Joint | ...8522 |

---

## Tech Stack
- **Backend:** Python 3 + Flask
- **Database:** SQLite (WAL mode) — `budget.db` in the project folder
- **Frontend:** Jinja2 templates, Tailwind CSS (CDN), Chart.js (CDN), ECharts (CDN)
- **No auth, no cloud, no external services**

---

## Database

### Tables
**`accounts`** — the 4 Capital One accounts seeded on startup.

**`transactions`**
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| account_id | FK → accounts | |
| date | TEXT (YYYY-MM-DD) | |
| description | TEXT | Cleaned merchant name (card prefixes stripped) |
| amount | REAL | Always positive |
| flow | TEXT | `'debit'` or `'credit'` |
| category | TEXT | Auto or manually set |
| category_source | TEXT | `'auto'` or `'manual'` |
| notes | TEXT | User-added context |
| raw_category | TEXT | Capital One's original category label (credit card only) |
| upload_batch | TEXT | Short ID grouping one CSV upload |

Unique constraint on `(account_id, date, description, amount, flow)` — re-uploading the same CSV is safe, duplicates are skipped.

**`uploads`** — log of every CSV import (account, filename, timestamp, rows imported/skipped).

### Write Durability
Every edit hits SQLite immediately and synchronously — WAL mode ensures no data loss. Nothing is held in memory between requests. Specifically:
- **CSV upload** → `insert_transactions()` — permanent
- **Category change (single)** → `UPDATE transactions SET category = ?` — permanent
- **Category change (bulk)** → same UPDATE across N rows — permanent
- **Notes edit** → `UPDATE transactions SET notes = ?` — permanent

---

## CSV Parsing

Capital One exports three different CSV formats. The parser auto-detects based on account type selected at upload time.

### Credit Card (Savor)
Columns: `Transaction Date, Posted Date, Card No., Description, Category, Debit, Credit`
- Debit column → `flow = 'debit'`
- Credit column → `flow = 'credit'`
- Capital One's `Category` column is stored as `raw_category` and used as fallback if keyword matching fails

### Checking / Savings (360 accounts)
Columns: `Account Number, Transaction Description, Transaction Date, Transaction Type, Transaction Amount, Balance`
- `Transaction Type` of `Debit` → `flow = 'debit'`, `Credit` → `flow = 'credit'`
- Description is cleaned: `"Debit Card Purchase - MERCHANT CITY ST"` → `"MERCHANT CITY ST"`
- User notes baked into descriptions (`"for textbook - Deposit from..."`) are extracted and saved to the `notes` field
- Any description containing `XXXXXXX` (Capital One's masked account number format) is auto-categorized as `Transfer` regardless of other keywords

---

## Auto-Categorization

Keyword matching against the cleaned description. Rules are checked in order — first match wins.

| Category | Example triggers |
|----------|-----------------|
| Income | payroll, irs treas, tax ref, interest paid, byu refund |
| Transfer | withdrawal to, capital one mobile pmt, funds tran |
| Rent & Housing | yardi, tpm inc, resident, rent |
| Utilities | provo city, questargas, google fiber, verizon |
| Groceries | winco, smiths food, whole foods, wegmans, costco |
| Dining | taco bell, java junkie, starbucks, doordash, sushi |
| Gas & Fuel | maverik, shell, chevron, exxon |
| Transportation | clipper systems, airgarage, honk, uber, lyft, parking |
| Education | brigham young, byu, myeducator, ww norton |
| Subscriptions | spotify, netflix, perplexity, apple com bill, google one |
| Shopping | amazon, target, walmart, butora |
| Entertainment | fandango, sundance, ticketmaster, nintendo |
| Health & Medical | walgreens, cvs, pharmacy, copay |
| Fitness | planet fitness, peloton, crossfit |
| Travel | airbnb, delta, marriott, expedia |
| Pet | petco, chewy, veterinary |
| Home & Garden | ace hardware, plumber, contractor |
| Savings & Investments | fidelity, vanguard, robinhood |
| Other | catch-all |

Transfers are **excluded from all dashboard/insight calculations** — they never appear in spending totals, charts, or averages.

---

## Pages

### Dashboard (`/`)
- Month + account filter
- KPI cards: Total Spent, Total Income, Net, Transaction Count
- Category doughnut chart
- Monthly spending bar chart (last 13 months)
- Top 15 merchants (bar)
- Category breakdown table with % of total

### Transactions (`/transactions`)
- Filters: month, account, category, flow (spending/income), search, hide-transfers toggle
- **Checkbox column** — select individual rows or use select-all
- **Bulk action bar** — appears when ≥1 row is checked; pick a category and apply to all selected at once; updates DOM in-place without page reload
- Individual inline category dropdown — changes save immediately on selection
- Inline notes field — saves on blur or Enter
- Manual-edit badge (✎) shown next to any manually categorized transaction

### Monthly (`/monthly`)
- Month selector
- KPI cards: Spent, Income, Net this month + rolling average spend
- Line chart: income vs spending across all months, selected month highlighted, dashed average lines
- Sunburst chart scoped to the selected month — click a leaf to edit its category via a modal
- Category table:
  - This month's spend
  - All-month rolling average
  - Delta vs average (green = under, red = over)
  - Same-calendar-month average (e.g. all Aprils) — shows `—` until 2+ years of data

### Breakdown (`/breakdown`)
- Month + account filter
- Full ECharts sunburst: Spending/Income → Categories → individual transactions
- Right-side panel: clicking a branch lists its children; clicking a leaf shows the transaction and an editable category dropdown that saves to the DB immediately

### Upload (`/upload`)
- Account picker (Savor CC, Sebi Checking, Olivia Checking, Seblivia Savings)
- CSV file picker
- Step-by-step Capital One export instructions
- Upload history (last 20 uploads with imported/skipped counts)

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/insights` | Dashboard data (by_category, top_merchants, monthly_totals, KPIs) |
| GET | `/api/monthly` | Full monthly report for one month (KPIs, trend, category averages) |
| GET | `/api/sunburst` | Nested tree data for ECharts sunburst (includes tx_id on leaves) |
| POST | `/api/transaction/<id>/category` | Update single transaction category |
| POST | `/api/transaction/<id>/notes` | Update single transaction notes |
| POST | `/api/transactions/bulk-category` | Update category on N transactions at once |

---

## What's Not Built Yet (Phase 2)

These are things discussed but not started:

### Budgeting Layer
- No budget limits or targets exist yet
- Plan: once spending patterns are understood from real data, add per-category monthly budget targets
- Undecided: which budgeting method (50/30/20, zero-based, custom envelopes, or custom)
- The monthly category table is the natural home for a "Goal" column

### Things to Decide / Build Next
- [ ] **Budget targets per category** — dollar limit per month, shown in category table as goal vs actual
- [ ] **Olivia's Checking CSV** — not uploaded yet; need her to export it
- [ ] **Savor Credit Card CSV** — not uploaded yet
- [ ] **Manual transaction entry** — add a cash purchase or anything not in a CSV
- [ ] **Delete transaction** — remove a bad import
- [ ] **Category rename** — rename "Other" or consolidate two categories across all transactions
- [ ] **Export** — download filtered transactions as CSV
- [ ] **Net worth tracker** — manually input account balances over time
- [ ] **Shared access over home network** — revisit once home network is set up
- [ ] **Same-month year-over-year comparison** — works automatically once 2+ years of data exist
