"""Unit tests for categorizer.categorize — the pure heart of auto-categorization.

Priority order (highest first): merchant rules → keyword RULES → the bank's
raw category label → "Other". These tests pin that order and the domain-specific
transfer/income handling. Synthetic descriptions only.
"""

from categorizer import ALL_CATEGORIES, categorize


def test_keyword_match_wins_over_default():
    assert categorize("STARBUCKS STORE 123") == "Dining"
    assert categorize("WINCO FOODS #45") == "Groceries"
    assert categorize("SHELL OIL 9987") == "Gas & Fuel"


def test_merchant_rule_beats_keyword():
    # "starbucks" would normally be Dining; a merchant rule overrides it.
    rules = [{"pattern": "starbucks", "category": "Shopping"}]
    assert categorize("STARBUCKS STORE 123", merchant_rules=rules) == "Shopping"


def test_income_checked_before_transfer():
    # "Payroll" is income; must not be swallowed by transfer heuristics.
    assert categorize("PAYROLL DIRECT DEP ACME INC") == "Income"


def test_transfer_detection():
    assert categorize("Withdrawal to Account XXXXXXX1234") == "Transfer"
    assert categorize("CAPITAL ONE MOBILE PMT") == "Transfer"


def test_raw_category_fallback_when_no_keyword():
    # No keyword matches "MERCHANT 4471", so the bank's own label decides.
    assert categorize("MERCHANT 4471", raw_capital_one_category="Food & Drink") == "Dining"
    assert categorize("MERCHANT 4471", raw_capital_one_category="Gas") == "Gas & Fuel"


def test_falls_back_to_other_when_nothing_matches():
    assert categorize("ZZZ UNKNOWN MERCHANT 9999") == "Other"


def test_all_categories_is_sorted_and_deduped():
    assert ALL_CATEGORIES == sorted(set(ALL_CATEGORIES))
    assert "Transfer" in ALL_CATEGORIES
    assert "Other" in ALL_CATEGORIES
