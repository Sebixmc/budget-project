# ADR-002: Multi-bank CSV support via a `bank_format` field on accounts

**Status**: Accepted
**Date**: 2026-05-07
**Deciders**: Sebi

## Context

Different banks export CSVs with completely different columns and conventions: Capital One credit cards use `Transaction Date / Description / Category / Debit / Credit`; Capital One 360 bank accounts use `Transaction Description / Transaction Type / Transaction Amount`; UCCU uses `Post Date / Description / Debit / Credit / Classification` with HTML entities and a "Posted" status filter. The app started Capital-One-only, and the first instinct was to branch parsing on the account **type** (`checking` vs `credit`). But the same account type can come from different banks with different formats, so type is the wrong axis.

## Decision

Each account carries a **`bank_format`** field (e.g. `capital_one_credit`, `capital_one_bank`, `uccu_checking`). `parser.detect_and_parse(file_bytes, bank_format, merchant_rules)` routes to the right per-bank sub-parser based on that field. `BANK_FORMATS` maps format keys to display names for the UI. Adding a new bank is: add a `bank_format` value, add a sub-parser that normalizes to the common row shape (positive `amount` + `flow` + cleaned `description`), and expose it in the Settings dropdown.

## Consequences

- **Positive:** New banks (Ally, another credit union, etc.) can be added without touching the account-type enum or the rest of the app — parsing is the only thing that changes.
- **Positive:** The same account type can have different formats per bank; format and type are independent.
- **Positive:** All sub-parsers converge on one normalized row shape, so `database.insert_transactions` and everything downstream stays bank-agnostic.
- **Negative:** Every new bank still needs a hand-written sub-parser and a real sample export to test against (there's no auto-detection of unknown formats).
- **Migration:** legacy accounts without the column get `bank_format` via `_migrate_bank_format`, defaulting to `capital_one_bank` (credit accounts corrected to `capital_one_credit`).

## Alternatives Considered

- **Branch on account `type` (`checking`/`credit`):** rejected — type doesn't determine CSV format; two banks with the same account type export differently.
- **Auto-detect format from CSV headers:** rejected for now — fragile across bank export variations and unnecessary when the user already knows which bank an account belongs to and sets it once in Settings.
