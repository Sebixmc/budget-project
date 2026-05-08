import csv
import html as html_mod
import io
from datetime import datetime
from categorizer import categorize

BANK_FORMATS = {
    "capital_one_credit": "Capital One Credit Card",
    "capital_one_bank":   "Capital One Checking / Savings",
    "uccu_checking":      "UCCU Checking",
}


def _parse_date(raw: str) -> str:
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%m-%d-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(raw.strip(), fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return raw.strip()


def _normalize_amount(raw: str) -> float:
    return abs(float(raw.replace(",", "").replace("$", "").strip() or 0))


# Prefixes Capital One bank CSVs prepend before the actual merchant name
_CARD_PREFIXES = [
    "Debit Card Purchase - ",
    "Digital Card Purchase - ",
    "360 Checking Card Adjustment Signature (Credit) ",
    "360 Checking Card Adjustment Signature (Debit) ",
]

# Transaction type strings that legitimately contain " - " (not user notes)
_KNOWN_TX_TYPES = [
    "debit card purchase",
    "digital card purchase",
    "360 checking card adjustment",
]


def _clean_bank_description(raw: str) -> tuple[str, str]:
    """
    Returns (cleaned_description, user_note).

    Capital One lets users add notes to transfers in the format:
      "user note here - Deposit from Account XXXXXXX1234"
    This splits those out so the note lands in the notes field.
    """
    note = ""
    desc = raw.strip()

    # Extract user note: anything before " - " that isn't a known transaction type prefix
    if " - " in desc:
        before, after = desc.split(" - ", 1)
        if not any(before.lower().startswith(t) for t in _KNOWN_TX_TYPES):
            note = before.strip()
            desc = after.strip()

    # Strip card purchase type prefixes to get the raw merchant name
    for prefix in _CARD_PREFIXES:
        if desc.lower().startswith(prefix.lower()):
            desc = desc[len(prefix):]
            break

    return desc.strip(), note


def _is_internal_transfer(description: str) -> bool:
    """
    Capital One masks account numbers as XXXXXXX#### in transfer descriptions.
    Any transaction referencing a masked account is an internal transfer.
    """
    return "xxxxxxx" in description.lower()


def detect_and_parse(file_bytes: bytes, bank_format: str, merchant_rules: list = None) -> list[dict]:
    text = file_bytes.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))

    if bank_format == "capital_one_credit":
        return _parse_credit(reader, merchant_rules)
    elif bank_format == "capital_one_bank":
        return _parse_bank(reader, merchant_rules)
    elif bank_format == "uccu_checking":
        return _parse_uccu(reader, merchant_rules)
    else:
        raise ValueError(f"Unknown bank format: {bank_format}")


def _parse_credit(reader, merchant_rules=None) -> list[dict]:
    """
    Capital One Savor credit card CSV:
      Transaction Date, Posted Date, Card No., Description, Category, Debit, Credit
    """
    rows = []
    for raw in reader:
        row = {k.strip().lower(): (v or "").strip() for k, v in raw.items()}

        date_raw = row.get("transaction date") or row.get("date") or ""
        description = row.get("description") or row.get("merchant name") or ""
        debit = row.get("debit") or ""
        credit = row.get("credit") or ""
        raw_cat = row.get("category") or ""

        if not date_raw or not description:
            continue

        if debit:
            amount = _normalize_amount(debit)
            flow = "debit"
        elif credit:
            amount = _normalize_amount(credit)
            flow = "credit"
        else:
            continue

        rows.append({
            "date": _parse_date(date_raw),
            "description": description,
            "amount": round(amount, 2),
            "flow": flow,
            "raw_category": raw_cat,
            "category": categorize(description, raw_cat, merchant_rules),
            "notes": "",
        })
    return rows


def _parse_bank(reader, merchant_rules=None) -> list[dict]:
    """
    Capital One 360 Checking / Savings CSV:
      Account Number, Transaction Description, Transaction Date,
      Transaction Type, Transaction Amount, Balance
    """
    rows = []
    for raw in reader:
        row = {k.strip().lower(): (v or "").strip() for k, v in raw.items()}

        date_raw = (
            row.get("transaction date")
            or row.get("date")
            or row.get("posted date")
            or ""
        )
        raw_description = (
            row.get("transaction description")
            or row.get("description")
            or row.get("memo")
            or ""
        )
        amount_raw = row.get("transaction amount") or row.get("amount") or ""
        tx_type = row.get("transaction type") or ""

        if not date_raw or not raw_description or not amount_raw:
            continue

        try:
            amount_val = float(amount_raw.replace(",", "").replace("$", "").strip())
        except ValueError:
            continue

        # Determine flow from Transaction Type column (most reliable for Cap One bank CSVs)
        if tx_type.lower() in ("debit", "withdrawal", "purchase"):
            flow = "debit"
        elif tx_type.lower() in ("credit", "deposit"):
            flow = "credit"
        else:
            flow = "debit" if amount_val < 0 else "credit"

        # Clean description and extract any user note
        description, note = _clean_bank_description(raw_description)

        # Internal transfers (masked account numbers) always categorize as Transfer
        if _is_internal_transfer(raw_description):
            category = "Transfer"
        else:
            category = categorize(description, merchant_rules=merchant_rules)

        rows.append({
            "date": _parse_date(date_raw),
            "description": description,
            "amount": round(abs(amount_val), 2),
            "flow": flow,
            "raw_category": "",
            "category": category,
            "notes": note,
        })
    return rows


def _parse_uccu(reader, merchant_rules=None) -> list[dict]:
    """
    UCCU Checking CSV:
      Account Number, Post Date, Check, Description, Debit, Credit, Status, Balance, Classification
    - Dates: M/D/YYYY
    - Separate Debit / Credit columns (one is empty per row)
    - Classification: UCCU's own category label (may contain HTML entities like &amp;)
    - Only import rows with Status == 'Posted'
    """
    rows = []
    for raw in reader:
        row = {k.strip().lower(): (v or "").strip() for k, v in raw.items()}

        date_raw       = row.get("post date") or ""
        description    = row.get("description") or ""
        debit          = row.get("debit") or ""
        credit         = row.get("credit") or ""
        status         = row.get("status") or ""
        classification = html_mod.unescape(row.get("classification") or "")

        # Skip pending / unposted rows
        if status.lower() != "posted":
            continue

        if not date_raw or not description:
            continue

        if debit:
            amount = _normalize_amount(debit)
            flow = "debit"
        elif credit:
            amount = _normalize_amount(credit)
            flow = "credit"
        else:
            continue

        # UCCU explicitly labels transfers — trust it
        if classification.lower() == "transfer":
            category = "Transfer"
        else:
            category = categorize(description, classification, merchant_rules)

        rows.append({
            "date": _parse_date(date_raw),
            "description": description,
            "amount": round(amount, 2),
            "flow": flow,
            "raw_category": classification,
            "category": category,
            "notes": "",
        })
    return rows
