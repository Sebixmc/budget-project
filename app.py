import uuid
from flask import Flask, render_template, request, redirect, url_for, jsonify, flash
import database as db
from parser import detect_and_parse, BANK_FORMATS
from categorizer import ALL_CATEGORIES

app = Flask(__name__)
app.secret_key = "budget-app-local-secret"

_PALETTE = [
    '#0ea5e9','#8b5cf6','#10b981','#f59e0b','#ef4444','#ec4899',
    '#06b6d4','#84cc16','#f97316','#6366f1','#14b8a6','#a855f7',
    '#eab308','#22c55e','#3b82f6','#e11d48',
]

@app.template_filter('category_color')
def category_color(index):
    return _PALETTE[(index - 1) % len(_PALETTE)]

db.init_db()

# ── Pages ────────────────────────────────────────────────────────────────────

@app.route("/")
def dashboard():
    months = db.get_available_months()
    selected_month = request.args.get("month") or None
    selected_account = request.args.get("account_id")
    if selected_account:
        selected_account = int(selected_account)

    insights = db.get_insights(
        month=selected_month,
        account_id=selected_account,
    )
    accounts = db.get_accounts()
    return render_template(
        "dashboard.html",
        insights=insights,
        months=months,
        selected_month=selected_month,
        accounts=accounts,
        selected_account=selected_account,
        categories=ALL_CATEGORIES,
        all_categories=ALL_CATEGORIES,
        goals=db.get_goals(),
        rainy_day=db.get_rainy_day(),
    )


@app.route("/transactions")
def transactions():
    accounts = db.get_accounts()
    months = db.get_available_months()
    categories = db.get_categories()

    filters = {
        "account_id": request.args.get("account_id"),
        "category": request.args.get("category"),
        "month": request.args.get("month"),
        "flow": request.args.get("flow"),
        "search": request.args.get("search"),
        "hide_transfers": bool(request.args.get("hide_transfers")),
    }
    if filters["account_id"]:
        filters["account_id"] = int(filters["account_id"])

    txs = db.get_transactions(filters)
    return render_template(
        "transactions.html",
        transactions=txs,
        accounts=accounts,
        months=months,
        categories=categories,
        filters=filters,
        all_categories=ALL_CATEGORIES,
    )


@app.route("/upload", methods=["GET", "POST"])
def upload():
    accounts = db.get_accounts()

    if request.method == "POST":
        account_id = request.form.get("account_id")
        file = request.files.get("csv_file")

        if not account_id or not file or file.filename == "":
            flash("Please select an account and a CSV file.", "error")
            return redirect(url_for("upload"))

        account = db.get_account(int(account_id))
        if not account:
            flash("Invalid account.", "error")
            return redirect(url_for("upload"))

        try:
            file_bytes = file.read()
            rules = db.get_merchant_rules()
            bank_format = account.get("bank_format", "capital_one_bank")
            rows = detect_and_parse(file_bytes, bank_format, merchant_rules=rules)

            if not rows:
                flash("No transactions found in file. Check that you selected the right account type.", "warning")
                return redirect(url_for("upload"))

            batch_id = str(uuid.uuid4())[:8]
            imported, skipped = db.insert_transactions(rows, int(account_id), batch_id)
            db.log_upload(int(account_id), file.filename, imported, skipped)

            flash(
                f"Imported {imported} transactions from '{file.filename}'. "
                f"{skipped} duplicates skipped.",
                "success",
            )
        except Exception as e:
            flash(f"Error parsing file: {e}", "error")

        return redirect(url_for("upload"))

    upload_history = _get_upload_history()
    return render_template("upload.html", accounts=accounts, upload_history=upload_history)


def _get_upload_history():
    import sqlite3
    import database as db_mod
    with db_mod.get_db() as conn:
        rows = conn.execute("""
            SELECT u.*, a.name as account_name
            FROM uploads u JOIN accounts a ON a.id = u.account_id
            ORDER BY u.uploaded_at DESC LIMIT 20
        """).fetchall()
        return [dict(r) for r in rows]


@app.route("/monthly")
def monthly():
    months = db.get_available_months()
    selected_month = request.args.get("month") or (months[0] if months else None)
    accounts = db.get_accounts()
    selected_account = request.args.get("account_id")
    if selected_account:
        selected_account = int(selected_account)
    return render_template(
        "monthly.html",
        months=months,
        selected_month=selected_month,
        accounts=accounts,
        selected_account=selected_account,
        categories=ALL_CATEGORIES,
    )


@app.route("/budget")
def budget():
    months = db.get_available_months()
    budget_cats = db.get_budget_categories()
    budget_cat_types = db.get_budget_category_types()
    averages = db.get_budget_averages("all")
    income_estimate = db.get_budget_income()
    avg_income = db.get_avg_income()
    skip = {'Transfer', 'Uncategorized', 'Income'}
    available_cats = [c for c in ALL_CATEGORIES if c not in skip and c not in budget_cats]
    return render_template(
        "budget.html",
        months=months,
        budget_cats=budget_cats,
        budget_cat_types=budget_cat_types,
        averages=averages,
        income_estimate=income_estimate,
        avg_income=avg_income,
        available_cats=available_cats,
    )


@app.route("/settings")
def settings():
    accounts = db.get_accounts()
    # Attach transaction count per account
    import sqlite3 as _sqlite3
    with db.get_db() as conn:
        counts = {
            r["account_id"]: r["cnt"]
            for r in conn.execute(
                "SELECT account_id, COUNT(*) as cnt FROM transactions GROUP BY account_id"
            ).fetchall()
        }
    for acct in accounts:
        acct["tx_count"] = counts.get(acct["id"], 0)
    return render_template("settings.html", accounts=accounts, bank_formats=BANK_FORMATS)


@app.route("/api/accounts", methods=["POST"])
def api_create_account():
    data = request.get_json() or {}
    name        = data.get("name", "").strip()
    type_       = data.get("type", "checking").strip()
    owner       = data.get("owner", "").strip()
    bank_format = data.get("bank_format", "").strip()
    if not name or not bank_format:
        return jsonify({"error": "name and bank_format required"}), 400
    if bank_format not in BANK_FORMATS:
        return jsonify({"error": "unknown bank_format"}), 400
    acct_id = db.create_account(name, type_, owner, bank_format)
    return jsonify({"ok": True, "id": acct_id})


@app.route("/api/accounts/<int:acct_id>", methods=["DELETE"])
def api_delete_account(acct_id):
    account = db.get_account(acct_id)
    if not account:
        return jsonify({"error": "Account not found"}), 404
    tx_count = db.delete_account(acct_id)
    return jsonify({"ok": True, "deleted_transactions": tx_count})


@app.route("/api/accounts/<int:acct_id>", methods=["PATCH"])
def api_update_account(acct_id):
    data = request.get_json() or {}
    name        = data.get("name", "").strip()
    owner       = data.get("owner", "").strip()
    bank_format = data.get("bank_format", "").strip()
    if not name or not bank_format:
        return jsonify({"error": "name and bank_format required"}), 400
    if bank_format not in BANK_FORMATS:
        return jsonify({"error": "unknown bank_format"}), 400
    db.update_account(acct_id, name, owner, bank_format)
    return jsonify({"ok": True})


@app.route("/rules")
def rules():
    all_rules = db.get_merchant_rules()
    return render_template("rules.html", rules=all_rules, categories=ALL_CATEGORIES)


@app.route("/breakdown")
def breakdown():
    months = db.get_available_months()
    selected_month = request.args.get("month") or (months[0] if months else None)
    accounts = db.get_accounts()
    selected_account = request.args.get("account_id")
    if selected_account:
        selected_account = int(selected_account)
    return render_template(
        "breakdown.html",
        months=months,
        selected_month=selected_month,
        accounts=accounts,
        selected_account=selected_account,
    )


# ── API ───────────────────────────────────────────────────────────────────────

@app.route("/api/monthly")
def api_monthly():
    month = request.args.get("month")
    account_id = request.args.get("account_id")
    if not month:
        months = db.get_available_months()
        month = months[0] if months else None
    if not month:
        return jsonify({"error": "no data"}), 404
    if account_id:
        account_id = int(account_id)
    return jsonify(db.get_monthly_report(month=month, account_id=account_id))


@app.route("/api/sunburst")
def api_sunburst():
    month = request.args.get("month")
    account_id = request.args.get("account_id")
    if account_id:
        account_id = int(account_id)
    return jsonify(db.get_sunburst_data(month=month, account_id=account_id))


@app.route("/api/insights")
def api_insights():
    month = request.args.get("month")
    account_id = request.args.get("account_id")
    if account_id:
        account_id = int(account_id)
    return jsonify(db.get_insights(month=month, account_id=account_id))


@app.route("/api/transactions/bulk-category", methods=["POST"])
def api_bulk_category():
    data = request.get_json()
    ids = [int(i) for i in (data or {}).get("ids", [])]
    category = (data or {}).get("category", "").strip()
    if not ids or not category:
        return jsonify({"error": "ids and category required"}), 400
    db.bulk_update_category(ids, category)
    return jsonify({"ok": True, "updated": len(ids)})


@app.route("/api/transaction/<int:tx_id>/category", methods=["POST"])
def api_update_category(tx_id):
    data = request.get_json()
    category = (data or {}).get("category", "").strip()
    if not category:
        return jsonify({"error": "category required"}), 400
    db.update_transaction_category(tx_id, category)
    return jsonify({"ok": True})


@app.route("/api/merchant-rules", methods=["GET"])
def api_list_rules():
    return jsonify(db.get_merchant_rules())


@app.route("/api/merchant-rules", methods=["POST"])
def api_save_rule():
    data = request.get_json() or {}
    pattern = data.get("pattern", "").strip()
    category = data.get("category", "").strip()
    apply_existing = bool(data.get("apply_to_existing", False))
    if not pattern or not category:
        return jsonify({"error": "pattern and category required"}), 400
    rule_id = db.save_merchant_rule(pattern, category)
    updated = db.apply_rule_to_existing(pattern, category) if apply_existing else 0
    return jsonify({"ok": True, "rule_id": rule_id, "updated_count": updated})


@app.route("/api/merchant-rules/<int:rule_id>", methods=["DELETE"])
def api_delete_rule(rule_id):
    db.delete_merchant_rule(rule_id)
    return jsonify({"ok": True})


@app.route("/api/merchant-rules/reapply", methods=["POST"])
def api_reapply_rules():
    total = db.reapply_all_rules()
    return jsonify({"ok": True, "updated_count": total})


@app.route("/api/transaction/<int:tx_id>/notes", methods=["POST"])
def api_update_notes(tx_id):
    data = request.get_json()
    notes = (data or {}).get("notes", "")
    db.update_transaction_notes(tx_id, notes)
    return jsonify({"ok": True})


# ── Goals API ─────────────────────────────────────────────────────────────────

@app.route("/api/goals", methods=["GET"])
def api_list_goals():
    return jsonify(db.get_goals())


@app.route("/api/goals", methods=["POST"])
def api_create_goal():
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    target = data.get("target_amount")
    if not name or target is None:
        return jsonify({"error": "name and target_amount required"}), 400
    goal_id = db.create_goal(
        name=name,
        target_amount=float(target),
        color=data.get("color", "#0ea5e9"),
        target_date=data.get("target_date") or None,
        notes=data.get("notes", ""),
    )
    return jsonify({"ok": True, "id": goal_id})


@app.route("/api/goals/<int:goal_id>", methods=["PATCH"])
def api_update_goal(goal_id):
    data = request.get_json() or {}
    db.update_goal(goal_id, **data)
    return jsonify({"ok": True})


@app.route("/api/goals/<int:goal_id>", methods=["DELETE"])
def api_delete_goal(goal_id):
    db.delete_goal(goal_id)
    return jsonify({"ok": True})


# ── Rainy day API ─────────────────────────────────────────────────────────────

@app.route("/api/rainy-day", methods=["GET"])
def api_get_rainy_day():
    return jsonify(db.get_rainy_day())


@app.route("/api/rainy-day", methods=["POST"])
def api_update_rainy_day():
    data = request.get_json() or {}
    balance = data.get("balance")
    if balance is None:
        return jsonify({"error": "balance required"}), 400
    db.update_rainy_day(float(balance), data.get("note", ""))
    return jsonify({"ok": True, "balance": float(balance)})


# ── Budget API ────────────────────────────────────────────────────────────────

@app.route("/api/budget/categories", methods=["GET"])
def api_get_budget_categories():
    return jsonify(db.get_budget_categories())


@app.route("/api/budget/categories", methods=["POST"])
def api_upsert_budget_category():
    data = request.get_json() or {}
    category = data.get("category", "").strip()
    limit = data.get("monthly_limit")
    flow_type = data.get("flow_type", "expense").strip() or "expense"
    if not category or limit is None:
        return jsonify({"error": "category and monthly_limit required"}), 400
    db.upsert_budget_category(category, float(limit), flow_type)
    return jsonify({"ok": True})


@app.route("/api/budget/categories/<path:category>", methods=["DELETE"])
def api_delete_budget_category(category):
    db.delete_budget_category(category)
    return jsonify({"ok": True})


@app.route("/api/budget/income", methods=["GET"])
def api_get_budget_income():
    estimate = db.get_budget_income()
    return jsonify({"monthly_estimate": estimate})


@app.route("/api/budget/income", methods=["POST"])
def api_set_budget_income():
    data = request.get_json() or {}
    estimate = data.get("monthly_estimate")
    if estimate is None:
        return jsonify({"error": "monthly_estimate required"}), 400
    if float(estimate) <= 0:
        db.clear_budget_income()
    else:
        db.set_budget_income(float(estimate))
    return jsonify({"ok": True})


@app.route("/api/budget/averages")
def api_budget_averages():
    period = request.args.get("period", "all")
    return jsonify(db.get_budget_averages(period))


@app.route("/api/budget/sankey")
def api_budget_sankey():
    data = db.get_budget_sankey_data()
    if not data:
        return jsonify({"empty": True})
    return jsonify(data)


if __name__ == "__main__":
    app.run(debug=True, port=5001, host="127.0.0.1")
