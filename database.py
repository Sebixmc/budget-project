import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "budget.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                type TEXT NOT NULL,  -- 'credit', 'checking', 'savings'
                owner TEXT NOT NULL  -- 'joint', 'seb', 'wife'
            );

            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                description TEXT NOT NULL,
                amount REAL NOT NULL,        -- always positive; use flow for direction
                flow TEXT NOT NULL,          -- 'debit' or 'credit'
                category TEXT NOT NULL DEFAULT 'Uncategorized',
                category_source TEXT NOT NULL DEFAULT 'auto',  -- 'auto' or 'manual'
                notes TEXT DEFAULT '',
                raw_category TEXT DEFAULT '',
                upload_batch TEXT DEFAULT '',
                FOREIGN KEY (account_id) REFERENCES accounts(id),
                UNIQUE(account_id, date, description, amount, flow)
            );

            CREATE TABLE IF NOT EXISTS uploads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id INTEGER NOT NULL,
                filename TEXT NOT NULL,
                uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
                rows_imported INTEGER NOT NULL DEFAULT 0,
                rows_skipped INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (account_id) REFERENCES accounts(id)
            );

            CREATE TABLE IF NOT EXISTS merchant_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pattern TEXT NOT NULL UNIQUE,
                category TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS goals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                target_amount REAL NOT NULL,
                current_amount REAL NOT NULL DEFAULT 0,
                color TEXT NOT NULL DEFAULT '#0ea5e9',
                target_date TEXT,
                notes TEXT DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS rainy_day_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                balance REAL NOT NULL,
                note TEXT DEFAULT '',
                recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS budget_categories (
                category TEXT PRIMARY KEY,
                monthly_limit REAL NOT NULL,
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS budget_income (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                monthly_estimate REAL NOT NULL,
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
        """)
        _seed_accounts(conn)
        _migrate_bank_format(conn)
        _migrate_flow_type(conn)


def _migrate_flow_type(conn):
    """Add flow_type column to budget_categories if it doesn't exist yet."""
    try:
        conn.execute(
            "ALTER TABLE budget_categories ADD COLUMN flow_type TEXT NOT NULL DEFAULT 'expense'"
        )
    except Exception:
        pass  # Column already exists


def _migrate_bank_format(conn):
    """Add bank_format column to accounts if it doesn't exist yet."""
    try:
        conn.execute("ALTER TABLE accounts ADD COLUMN bank_format TEXT NOT NULL DEFAULT 'capital_one_bank'")
    except Exception:
        pass  # Column already exists
    # Credit accounts default to capital_one_bank — fix them
    conn.execute(
        "UPDATE accounts SET bank_format = 'capital_one_credit' "
        "WHERE type = 'credit' AND bank_format = 'capital_one_bank'"
    )


def _seed_accounts(conn):
    defaults = [
        ("Savor Credit Card", "credit", "joint"),
        ("Sebi Checking", "checking", "seb"),
        ("Olivia Checking", "checking", "wife"),
        ("Seblivia Savings", "savings", "joint"),
    ]
    for name, type_, owner in defaults:
        conn.execute(
            "INSERT OR IGNORE INTO accounts (name, type, owner) VALUES (?, ?, ?)",
            (name, type_, owner),
        )
    # Rename legacy names if the DB was seeded with the old defaults
    renames = [
        ("Seb Checking", "Sebi Checking"),
        ("Wife Checking", "Olivia Checking"),
        ("Joint Savings", "Seblivia Savings"),
    ]
    for old, new in renames:
        # Only rename if old name exists and new name doesn't (avoids UNIQUE conflict)
        conn.execute(
            "UPDATE accounts SET name = ? WHERE name = ? AND NOT EXISTS (SELECT 1 FROM accounts WHERE name = ?)",
            (new, old, new),
        )


def get_accounts():
    with get_db() as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM accounts ORDER BY id").fetchall()]


def get_account(account_id):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM accounts WHERE id = ?", (account_id,)).fetchone()
        return dict(row) if row else None


def create_account(name, type_, owner, bank_format):
    with get_db() as conn:
        conn.execute(
            "INSERT INTO accounts (name, type, owner, bank_format) VALUES (?, ?, ?, ?)",
            (name, type_, owner, bank_format),
        )
        return conn.execute("SELECT last_insert_rowid() as id").fetchone()["id"]


def update_account(account_id, name, owner, bank_format):
    with get_db() as conn:
        conn.execute(
            "UPDATE accounts SET name = ?, owner = ?, bank_format = ? WHERE id = ?",
            (name, owner, bank_format, account_id),
        )


def delete_account(account_id):
    """Delete an account and all its transactions and upload history."""
    with get_db() as conn:
        tx_count = conn.execute(
            "SELECT COUNT(*) FROM transactions WHERE account_id = ?", (account_id,)
        ).fetchone()[0]
        conn.execute("DELETE FROM transactions WHERE account_id = ?", (account_id,))
        conn.execute("DELETE FROM uploads WHERE account_id = ?", (account_id,))
        conn.execute("DELETE FROM accounts WHERE id = ?", (account_id,))
        return tx_count


def insert_transactions(rows, account_id, batch_id):
    imported = skipped = 0
    with get_db() as conn:
        for row in rows:
            try:
                conn.execute(
                    """INSERT INTO transactions
                       (account_id, date, description, amount, flow, category, category_source, raw_category, notes, upload_batch)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        account_id,
                        row["date"],
                        row["description"],
                        row["amount"],
                        row["flow"],
                        row["category"],
                        "auto",
                        row.get("raw_category", ""),
                        row.get("notes", ""),
                        batch_id,
                    ),
                )
                imported += 1
            except sqlite3.IntegrityError:
                skipped += 1
    return imported, skipped


def log_upload(account_id, filename, imported, skipped):
    with get_db() as conn:
        conn.execute(
            "INSERT INTO uploads (account_id, filename, rows_imported, rows_skipped) VALUES (?, ?, ?, ?)",
            (account_id, filename, imported, skipped),
        )


def update_transaction_category(transaction_id, category):
    with get_db() as conn:
        conn.execute(
            "UPDATE transactions SET category = ?, category_source = 'manual' WHERE id = ?",
            (category, transaction_id),
        )


def bulk_update_category(ids, category):
    placeholders = ",".join("?" * len(ids))
    with get_db() as conn:
        conn.execute(
            f"UPDATE transactions SET category = ?, category_source = 'manual' WHERE id IN ({placeholders})",
            [category] + list(ids),
        )


def update_transaction_notes(transaction_id, notes):
    with get_db() as conn:
        conn.execute("UPDATE transactions SET notes = ? WHERE id = ?", (notes, transaction_id))


def get_transactions(filters=None):
    filters = filters or {}
    clauses = ["1=1"]
    params = []

    if filters.get("account_id"):
        clauses.append("t.account_id = ?")
        params.append(filters["account_id"])
    if filters.get("category"):
        clauses.append("t.category = ?")
        params.append(filters["category"])
    if filters.get("month"):
        clauses.append("strftime('%Y-%m', t.date) = ?")
        params.append(filters["month"])
    if filters.get("flow"):
        clauses.append("t.flow = ?")
        params.append(filters["flow"])
    if filters.get("hide_transfers"):
        clauses.append("t.category != 'Transfer'")
    if filters.get("search"):
        clauses.append("LOWER(t.description) LIKE ?")
        params.append(f"%{filters['search'].lower()}%")

    where = " AND ".join(clauses)
    query = f"""
        SELECT t.*, a.name as account_name, a.type as account_type, a.owner as account_owner
        FROM transactions t
        JOIN accounts a ON a.id = t.account_id
        WHERE {where}
        ORDER BY t.date DESC, t.id DESC
    """
    with get_db() as conn:
        return [dict(r) for r in conn.execute(query, params).fetchall()]


def get_insights(month=None, account_id=None):
    clauses = ["flow = 'debit'", "category != 'Transfer'"]
    params = []
    if month:
        clauses.append("strftime('%Y-%m', date) = ?")
        params.append(month)
    if account_id:
        clauses.append("account_id = ?")
        params.append(account_id)
    where = " AND ".join(clauses)

    with get_db() as conn:
        by_category = conn.execute(
            f"SELECT category, SUM(amount) as total FROM transactions WHERE {where} GROUP BY category ORDER BY total DESC",
            params,
        ).fetchall()

        top_merchants = conn.execute(
            f"SELECT description, SUM(amount) as total, COUNT(*) as count FROM transactions WHERE {where} GROUP BY description ORDER BY total DESC LIMIT 15",
            params,
        ).fetchall()

        monthly_totals = conn.execute(
            """SELECT strftime('%Y-%m', date) as month, SUM(amount) as total
               FROM transactions WHERE flow = 'debit' AND category != 'Transfer'
               GROUP BY month ORDER BY month DESC LIMIT 13""",
        ).fetchall()

        total_spent = conn.execute(
            f"SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE {where}",
            params,
        ).fetchone()["total"]

        income_clauses = ["flow = 'credit'", "category != 'Transfer'"]
        income_params = []
        if month:
            income_clauses.append("strftime('%Y-%m', date) = ?")
            income_params.append(month)
        if account_id:
            income_clauses.append("account_id = ?")
            income_params.append(account_id)
        income_where = " AND ".join(income_clauses)

        total_income = conn.execute(
            f"SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE {income_where}",
            income_params,
        ).fetchone()["total"]

        tx_count = conn.execute(
            f"SELECT COUNT(*) as cnt FROM transactions WHERE {where}", params
        ).fetchone()["cnt"]

    return {
        "by_category": [dict(r) for r in by_category],
        "top_merchants": [dict(r) for r in top_merchants],
        "monthly_totals": [dict(r) for r in monthly_totals],
        "total_spent": round(total_spent, 2),
        "total_income": round(total_income, 2),
        "net": round(total_income - total_spent, 2),
        "tx_count": tx_count,
    }


def get_available_months():
    with get_db() as conn:
        rows = conn.execute(
            "SELECT DISTINCT strftime('%Y-%m', date) as month FROM transactions ORDER BY month DESC"
        ).fetchall()
        return [r["month"] for r in rows]


def get_categories():
    with get_db() as conn:
        rows = conn.execute(
            "SELECT DISTINCT category FROM transactions ORDER BY category"
        ).fetchall()
        return [r["category"] for r in rows]


def get_monthly_report(month, account_id=None):
    """
    Full breakdown for a single month:
      - KPIs for that month
      - Per-category spending for that month
      - All-month trend series (income vs spending)
      - Rolling average per category (across all available months)
      - Same calendar-month average (e.g. April across all years)
    Transfers excluded throughout.
    """
    base = ["category != 'Transfer'"]
    if account_id:
        base.append(f"account_id = {int(account_id)}")
    base_where = " AND ".join(base)

    month_filter = f"strftime('%Y-%m', date) = '{month}'"
    cal_month = month[5:7]  # e.g. '04'

    with get_db() as conn:
        # ── Selected month KPIs ──────────────────────────────────────────────
        spent_row = conn.execute(
            f"SELECT COALESCE(SUM(amount),0) as v FROM transactions "
            f"WHERE {base_where} AND flow='debit' AND {month_filter}"
        ).fetchone()
        income_row = conn.execute(
            f"SELECT COALESCE(SUM(amount),0) as v FROM transactions "
            f"WHERE {base_where} AND flow='credit' AND {month_filter}"
        ).fetchone()

        # ── Selected month by category ───────────────────────────────────────
        by_cat = conn.execute(
            f"""SELECT category, SUM(amount) as total, COUNT(*) as cnt
                FROM transactions
                WHERE {base_where} AND flow='debit' AND {month_filter}
                GROUP BY category ORDER BY total DESC""",
        ).fetchall()

        # ── All-months trend (income + spending per month) ───────────────────
        trend = conn.execute(
            f"""SELECT strftime('%Y-%m', date) as m,
                       SUM(CASE WHEN flow='debit'  THEN amount ELSE 0 END) as spent,
                       SUM(CASE WHEN flow='credit' THEN amount ELSE 0 END) as income
                FROM transactions
                WHERE {base_where}
                GROUP BY m ORDER BY m ASC"""
        ).fetchall()

        # ── Rolling average per category (across ALL months in DB) ──────────
        n_months_row = conn.execute(
            f"""SELECT COUNT(DISTINCT strftime('%Y-%m', date)) as n
                FROM transactions WHERE {base_where}"""
        ).fetchone()
        n_months = max(n_months_row["n"], 1)

        cat_totals = conn.execute(
            f"""SELECT category, SUM(amount) as total
                FROM transactions
                WHERE {base_where} AND flow='debit'
                GROUP BY category"""
        ).fetchall()
        avg_by_cat = {r["category"]: round(r["total"] / n_months, 2) for r in cat_totals}

        # ── Same calendar-month average (April across all years, etc.) ───────
        same_cal_months = conn.execute(
            f"""SELECT COUNT(DISTINCT strftime('%Y-%m', date)) as n,
                       SUM(CASE WHEN flow='debit'  THEN amount ELSE 0 END) as spent,
                       SUM(CASE WHEN flow='credit' THEN amount ELSE 0 END) as income
                FROM transactions
                WHERE {base_where} AND strftime('%m', date) = '{cal_month}'"""
        ).fetchone()
        n_cal = max(same_cal_months["n"], 1)
        same_month_avg = {
            "spent":  round(same_cal_months["spent"]  / n_cal, 2),
            "income": round(same_cal_months["income"] / n_cal, 2),
            "n_years": same_cal_months["n"],
        }

        # ── Same cal-month average per category ─────────────────────────────
        cal_cat = conn.execute(
            f"""SELECT category, SUM(amount) as total
                FROM transactions
                WHERE {base_where} AND flow='debit'
                  AND strftime('%m', date) = '{cal_month}'
                GROUP BY category"""
        ).fetchall()
        cal_avg_by_cat = {r["category"]: round(r["total"] / n_cal, 2) for r in cal_cat}

    selected_spent  = round(spent_row["v"],  2)
    selected_income = round(income_row["v"], 2)

    return {
        "month": month,
        "selected": {
            "spent":  selected_spent,
            "income": selected_income,
            "net":    round(selected_income - selected_spent, 2),
            "by_category": [
                {
                    "category": r["category"],
                    "total":    round(r["total"], 2),
                    "count":    r["cnt"],
                    "avg":      avg_by_cat.get(r["category"], 0),
                    "cal_avg":  cal_avg_by_cat.get(r["category"], 0),
                    "vs_avg":   round(r["total"] - avg_by_cat.get(r["category"], 0), 2),
                }
                for r in by_cat
            ],
        },
        "trend": [
            {"month": r["m"], "spent": round(r["spent"], 2), "income": round(r["income"], 2)}
            for r in trend
        ],
        "averages": {
            "spent":  round(sum(r["spent"]  for r in trend) / max(len(trend), 1), 2),
            "income": round(sum(r["income"] for r in trend) / max(len(trend), 1), 2),
            "n_months": n_months,
            "by_category": [
                {"category": cat, "avg": avg}
                for cat, avg in sorted(avg_by_cat.items(), key=lambda x: -x[1])
            ],
        },
        "same_month_avg": same_month_avg,
        "cal_avg_by_cat": cal_avg_by_cat,
    }


def get_merchant_rules():
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM merchant_rules ORDER BY created_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]


def save_merchant_rule(pattern, category):
    pattern = pattern.lower().strip()
    with get_db() as conn:
        conn.execute(
            """INSERT INTO merchant_rules (pattern, category)
               VALUES (?, ?)
               ON CONFLICT(pattern) DO UPDATE SET category = excluded.category""",
            (pattern, category),
        )
        row = conn.execute(
            "SELECT id FROM merchant_rules WHERE pattern = ?", (pattern,)
        ).fetchone()
        return row["id"]


def delete_merchant_rule(rule_id):
    with get_db() as conn:
        conn.execute("DELETE FROM merchant_rules WHERE id = ?", (rule_id,))


def apply_rule_to_existing(pattern, category):
    """Update auto-categorized transactions whose description contains pattern."""
    with get_db() as conn:
        result = conn.execute(
            """UPDATE transactions SET category = ?
               WHERE category_source = 'auto'
               AND LOWER(description) LIKE ?""",
            (category, f"%{pattern.lower().strip()}%"),
        )
        return result.rowcount


def reapply_all_rules():
    """Re-run every saved merchant rule against all auto-categorized transactions."""
    rules = get_merchant_rules()
    total = 0
    for rule in rules:
        total += apply_rule_to_existing(rule["pattern"], rule["category"])
    return total


def get_sunburst_data(month=None, account_id=None):
    """
    Returns a nested dict for ECharts sunburst:
      root → [Spending, Income]
        → categories
          → individual transactions (leaves)
    Transfers are excluded.
    """
    clauses = ["category != 'Transfer'"]
    params = []
    if month:
        clauses.append("strftime('%Y-%m', date) = ?")
        params.append(month)
    if account_id:
        clauses.append("account_id = ?")
        params.append(account_id)
    where = " AND ".join(clauses)

    with get_db() as conn:
        rows = conn.execute(
            f"""SELECT id, date, description, amount, flow, category
                FROM transactions WHERE {where}
                ORDER BY category, amount DESC""",
            params,
        ).fetchall()

    # Group: flow → category → transactions
    tree = {"Spending": {}, "Income": {}}
    for r in rows:
        branch = "Income" if r["flow"] == "credit" else "Spending"
        cat = r["category"]
        if cat not in tree[branch]:
            tree[branch][cat] = []
        tree[branch][cat].append({
            "name": r["description"][:40],
            "value": round(r["amount"], 2),
            "date": r["date"],
            "tx_id": r["id"],
            "category": r["category"],
            "flow": r["flow"],
        })

    def build_branch(label, categories):
        cat_nodes = []
        for cat, txs in sorted(categories.items(), key=lambda x: -sum(t["value"] for t in x[1])):
            total = round(sum(t["value"] for t in txs), 2)
            leaves = [
                {"name": t["name"], "value": t["value"], "date": t["date"]}
                for t in txs
            ]
            cat_nodes.append({
                "name": cat,
                "value": total,
                "children": leaves,
            })
        branch_total = round(sum(n["value"] for n in cat_nodes), 2)
        return {"name": label, "value": branch_total, "children": cat_nodes}

    children = []
    if tree["Spending"]:
        children.append(build_branch("Spending", tree["Spending"]))
    if tree["Income"]:
        children.append(build_branch("Income", tree["Income"]))

    return {"name": "Overview", "children": children}


# ── Goals ─────────────────────────────────────────────────────────────────────

def get_goals():
    with get_db() as conn:
        return [dict(r) for r in conn.execute(
            "SELECT * FROM goals ORDER BY created_at DESC"
        ).fetchall()]


def create_goal(name, target_amount, color="#0ea5e9", target_date=None, notes=""):
    with get_db() as conn:
        conn.execute(
            "INSERT INTO goals (name, target_amount, color, target_date, notes) VALUES (?,?,?,?,?)",
            (name, float(target_amount), color, target_date or None, notes),
        )
        return conn.execute("SELECT last_insert_rowid() as id").fetchone()["id"]


def update_goal(goal_id, **fields):
    allowed = {"name", "target_amount", "current_amount", "color", "target_date", "notes"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    with get_db() as conn:
        conn.execute(
            f"UPDATE goals SET {set_clause} WHERE id = ?",
            list(updates.values()) + [goal_id],
        )


def delete_goal(goal_id):
    with get_db() as conn:
        conn.execute("DELETE FROM goals WHERE id = ?", (goal_id,))


# ── Rainy day fund ────────────────────────────────────────────────────────────

def get_rainy_day():
    with get_db() as conn:
        current = conn.execute(
            "SELECT * FROM rainy_day_log ORDER BY recorded_at DESC LIMIT 1"
        ).fetchone()
        log = conn.execute(
            "SELECT * FROM rainy_day_log ORDER BY recorded_at DESC LIMIT 6"
        ).fetchall()
    return {
        "balance": dict(current)["balance"] if current else None,
        "last_updated": dict(current)["recorded_at"][:10] if current else None,
        "log": [dict(r) for r in log],
    }


def update_rainy_day(balance, note=""):
    with get_db() as conn:
        conn.execute(
            "INSERT INTO rainy_day_log (balance, note) VALUES (?, ?)",
            (float(balance), note or ""),
        )


# ── Budget categories ─────────────────────────────────────────────────────────

def get_budget_categories():
    """Returns {category: monthly_limit} dict."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT category, monthly_limit FROM budget_categories ORDER BY category"
        ).fetchall()
    return {r["category"]: r["monthly_limit"] for r in rows}


def get_budget_category_types():
    """Returns {category: flow_type} dict ('expense' or 'income')."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT category, flow_type FROM budget_categories ORDER BY category"
        ).fetchall()
    return {r["category"]: r["flow_type"] for r in rows}


def upsert_budget_category(category, monthly_limit, flow_type='expense'):
    with get_db() as conn:
        conn.execute(
            """INSERT INTO budget_categories (category, monthly_limit, flow_type)
               VALUES (?, ?, ?)
               ON CONFLICT(category) DO UPDATE
               SET monthly_limit = excluded.monthly_limit,
                   flow_type = excluded.flow_type,
                   updated_at = datetime('now')""",
            (category, float(monthly_limit), flow_type),
        )


def delete_budget_category(category):
    with get_db() as conn:
        conn.execute("DELETE FROM budget_categories WHERE category = ?", (category,))


# ── Budget income estimate ────────────────────────────────────────────────────

def get_budget_income():
    """Returns user-set monthly income estimate, or None if not set."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT monthly_estimate FROM budget_income WHERE id = 1"
        ).fetchone()
    return row["monthly_estimate"] if row else None


def set_budget_income(monthly_estimate):
    with get_db() as conn:
        conn.execute(
            """INSERT INTO budget_income (id, monthly_estimate)
               VALUES (1, ?)
               ON CONFLICT(id) DO UPDATE
               SET monthly_estimate = excluded.monthly_estimate,
                   updated_at = datetime('now')""",
            (float(monthly_estimate),),
        )


def clear_budget_income():
    with get_db() as conn:
        conn.execute("DELETE FROM budget_income")


def get_avg_income():
    """Historical average monthly income across all months in the DB."""
    with get_db() as conn:
        trend = conn.execute(
            "SELECT strftime('%Y-%m', date) as m, SUM(amount) as income "
            "FROM transactions WHERE flow = 'credit' AND category != 'Transfer' GROUP BY m"
        ).fetchall()
    if not trend:
        return 0
    return round(sum(r["income"] for r in trend) / len(trend), 2)


def get_budget_averages(period="all"):
    """
    Returns {category: avg_monthly_spend} for debit transactions (excl. Transfers).
    period: 'all' | '3mo' | '1mo' | 'YYYY-MM' (same calendar month across all years)
    """
    with get_db() as conn:
        def _income_avg_for_months(conn, month_list):
            """Average monthly income over the given list of YYYY-MM strings."""
            if not month_list:
                return 0
            ph = ",".join("?" * len(month_list))
            row = conn.execute(
                f"SELECT COALESCE(SUM(amount),0) as total FROM transactions "
                f"WHERE flow='credit' AND category!='Transfer' "
                f"AND strftime('%Y-%m', date) IN ({ph})",
                month_list,
            ).fetchone()
            return round(row["total"] / len(month_list), 2)

        if period == "all":
            n = conn.execute(
                "SELECT COUNT(DISTINCT strftime('%Y-%m', date)) as n FROM transactions "
                "WHERE category != 'Transfer' AND flow = 'debit'"
            ).fetchone()["n"] or 1
            rows = conn.execute(
                "SELECT category, SUM(amount) as total FROM transactions "
                "WHERE category != 'Transfer' AND flow = 'debit' GROUP BY category"
            ).fetchall()
            result = {r["category"]: round(r["total"] / n, 2) for r in rows}
            all_months = [r["m"] for r in conn.execute(
                "SELECT DISTINCT strftime('%Y-%m', date) as m FROM transactions"
            ).fetchall()]
            result["__income__"] = _income_avg_for_months(conn, all_months)
            return result

        elif period == "3mo":
            months = [r["m"] for r in conn.execute(
                "SELECT DISTINCT strftime('%Y-%m', date) as m FROM transactions ORDER BY m DESC LIMIT 3"
            ).fetchall()]
            if not months:
                return {}
            ph = ",".join("?" * len(months))
            rows = conn.execute(
                f"SELECT category, SUM(amount) as total FROM transactions "
                f"WHERE category != 'Transfer' AND flow = 'debit' "
                f"AND strftime('%Y-%m', date) IN ({ph}) GROUP BY category",
                months,
            ).fetchall()
            result = {r["category"]: round(r["total"] / len(months), 2) for r in rows}
            result["__income__"] = _income_avg_for_months(conn, months)
            return result

        elif period == "1mo":
            last = conn.execute(
                "SELECT DISTINCT strftime('%Y-%m', date) as m FROM transactions ORDER BY m DESC LIMIT 1"
            ).fetchone()
            if not last:
                return {}
            rows = conn.execute(
                "SELECT category, SUM(amount) as total FROM transactions "
                "WHERE category != 'Transfer' AND flow = 'debit' "
                "AND strftime('%Y-%m', date) = ? GROUP BY category",
                (last["m"],),
            ).fetchall()
            result = {r["category"]: round(r["total"], 2) for r in rows}
            result["__income__"] = _income_avg_for_months(conn, [last["m"]])
            return result

        elif len(period) == 7 and period[4] == "-":
            # Same calendar month average, e.g. '2026-04' → all Aprils
            cal = period[5:7]
            n = conn.execute(
                "SELECT COUNT(DISTINCT strftime('%Y-%m', date)) as n FROM transactions "
                "WHERE category != 'Transfer' AND flow = 'debit' AND strftime('%m', date) = ?",
                (cal,),
            ).fetchone()["n"] or 1
            rows = conn.execute(
                "SELECT category, SUM(amount) as total FROM transactions "
                "WHERE category != 'Transfer' AND flow = 'debit' "
                "AND strftime('%m', date) = ? GROUP BY category",
                (cal,),
            ).fetchall()
            result = {r["category"]: round(r["total"] / n, 2) for r in rows}
            cal_months = [r["m"] for r in conn.execute(
                "SELECT DISTINCT strftime('%Y-%m', date) as m FROM transactions "
                "WHERE strftime('%m', date) = ?", (cal,)
            ).fetchall()]
            result["__income__"] = _income_avg_for_months(conn, cal_months)
            return result

    return {}


def get_budget_sankey_data():
    """
    Returns nodes + links for ECharts sankey.
    Income flows out to each budgeted category, remainder goes to Unallocated.
    Uses user-set income estimate if available, otherwise historical average.
    """
    budget_cats = get_budget_categories()
    budget_types = get_budget_category_types()

    # Only expense-type categories with a positive limit flow out from income in the Sankey
    expense_cats = {
        cat: limit for cat, limit in budget_cats.items()
        if budget_types.get(cat, 'expense') == 'expense' and limit > 0
    }
    if not expense_cats:
        return None

    # Prefer user-set estimate; fall back to historical average
    income_estimate = get_budget_income()
    if income_estimate is not None:
        avg_income = income_estimate
        income_source = "estimated"
    else:
        avg_income = get_avg_income()
        income_source = "historical"

    total_budgeted = round(sum(expense_cats.values()), 2)
    unallocated = round(avg_income - total_budgeted, 2)

    links = [
        {"source": "Income", "target": cat, "value": round(limit, 2)}
        for cat, limit in sorted(expense_cats.items(), key=lambda x: -x[1])
    ]
    if unallocated > 0:
        links.append({"source": "Income", "target": "Unallocated", "value": unallocated})

    return {
        "avg_income": avg_income,
        "income_source": income_source,
        "total_budgeted": total_budgeted,
        "unallocated": max(unallocated, 0),
        "over_budget": abs(min(unallocated, 0)),
        "links": links,
    }
