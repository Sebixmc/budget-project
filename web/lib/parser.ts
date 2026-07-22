/**
 * Multi-bank CSV parsing — a faithful TypeScript port of the legacy `parser.py`.
 *
 * `detectAndParse(input, bankFormat, merchantRules)` routes to the right
 * sub-parser based on the account's bank format and returns normalized rows.
 * Pure module: only depends on papaparse + the pure categorizer. No DB/framework.
 *
 * Invariants (see CLAUDE.md): amounts are always positive; direction lives in
 * `flow`; internal transfers categorize as "Transfer".
 */

import Papa from "papaparse";
import { categorize, type MerchantRule } from "./categorizer";

export type Flow = "debit" | "credit";

export interface ParsedRow {
  date: string;
  description: string;
  amount: number;
  flow: Flow;
  raw_category: string;
  category: string;
  notes: string;
}

export const BANK_FORMATS = {
  capital_one_credit: "Capital One Credit Card",
  capital_one_bank: "Capital One Checking / Savings",
  uccu_checking: "UCCU Checking",
} as const;

export type BankFormat = keyof typeof BANK_FORMATS;

// Prefixes Capital One bank CSVs prepend before the actual merchant name
const CARD_PREFIXES = [
  "Debit Card Purchase - ",
  "Digital Card Purchase - ",
  "360 Checking Card Adjustment Signature (Credit) ",
  "360 Checking Card Adjustment Signature (Debit) ",
];

// Transaction type strings that legitimately contain " - " (not user notes)
const KNOWN_TX_TYPES = [
  "debit card purchase",
  "digital card purchase",
  "360 checking card adjustment",
];

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Parse a date in any of the known bank formats to YYYY-MM-DD, else return it trimmed. */
export function parseDate(raw: string): string {
  const s = (raw ?? "").trim();
  const pad = (v: string) => v.padStart(2, "0");
  // YYYY-MM-DD or YYYY/MM/DD
  let m = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  // M/D/YYYY or M-D-YYYY
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${pad(m[1])}-${pad(m[2])}`;
  // M/D/YY -> 20YY (bank exports are recent)
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/);
  if (m) return `20${m[3]}-${pad(m[1])}-${pad(m[2])}`;
  return s;
}

function normalizeAmount(raw: string): number {
  const cleaned = (raw ?? "").replace(/,/g, "").replace(/\$/g, "").trim();
  const n = parseFloat(cleaned);
  return Math.abs(Number.isNaN(n) ? 0 : n);
}

/** Minimal HTML entity unescape for UCCU classification labels (e.g. `&amp;`). */
function htmlUnescape(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Returns [cleanedDescription, userNote]. Capital One lets users add notes to
 * transfers as "user note - Deposit from Account XXXXXXX1234"; this splits them.
 */
export function cleanBankDescription(raw: string): [string, string] {
  let note = "";
  let desc = (raw ?? "").trim();

  if (desc.includes(" - ")) {
    const idx = desc.indexOf(" - ");
    const before = desc.slice(0, idx);
    const after = desc.slice(idx + 3);
    if (!KNOWN_TX_TYPES.some((t) => before.toLowerCase().startsWith(t))) {
      note = before.trim();
      desc = after.trim();
    }
  }

  for (const prefix of CARD_PREFIXES) {
    if (desc.toLowerCase().startsWith(prefix.toLowerCase())) {
      desc = desc.slice(prefix.length);
      break;
    }
  }

  return [desc.trim(), note];
}

/** Capital One masks account numbers as XXXXXXX#### in transfer descriptions. */
function isInternalTransfer(description: string): boolean {
  return description.toLowerCase().includes("xxxxxxx");
}

type Row = Record<string, string>;

/** Lowercase + trim every key, coerce values to trimmed strings. */
function normRow(raw: Record<string, unknown>): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k.trim().toLowerCase()] = (v == null ? "" : String(v)).trim();
  }
  return out;
}

function parseCsv(input: string | Uint8Array): Row[] {
  const text = (typeof input === "string" ? input : new TextDecoder("utf-8").decode(input))
    .replace(/^﻿/, ""); // strip BOM (utf-8-sig)
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  return result.data.map(normRow);
}

export function detectAndParse(
  input: string | Uint8Array,
  bankFormat: BankFormat | string,
  merchantRules: MerchantRule[] | null = null,
): ParsedRow[] {
  const rows = parseCsv(input);
  switch (bankFormat) {
    case "capital_one_credit":
      return parseCredit(rows, merchantRules);
    case "capital_one_bank":
      return parseBank(rows, merchantRules);
    case "uccu_checking":
      return parseUccu(rows, merchantRules);
    default:
      throw new Error(`Unknown bank format: ${bankFormat}`);
  }
}

/** Capital One Savor credit card: Transaction Date, Posted Date, Card No., Description, Category, Debit, Credit */
function parseCredit(rows: Row[], merchantRules: MerchantRule[] | null): ParsedRow[] {
  const out: ParsedRow[] = [];
  for (const row of rows) {
    const dateRaw = row["transaction date"] || row["date"] || "";
    const description = row["description"] || row["merchant name"] || "";
    const debit = row["debit"] || "";
    const credit = row["credit"] || "";
    const rawCat = row["category"] || "";

    if (!dateRaw || !description) continue;

    let amount: number;
    let flow: Flow;
    if (debit) {
      amount = normalizeAmount(debit);
      flow = "debit";
    } else if (credit) {
      amount = normalizeAmount(credit);
      flow = "credit";
    } else {
      continue;
    }

    out.push({
      date: parseDate(dateRaw),
      description,
      amount: round2(amount),
      flow,
      raw_category: rawCat,
      category: categorize(description, rawCat, merchantRules),
      notes: "",
    });
  }
  return out;
}

/** Capital One 360 Checking/Savings: Account Number, Transaction Description, Transaction Date, Transaction Type, Transaction Amount, Balance */
function parseBank(rows: Row[], merchantRules: MerchantRule[] | null): ParsedRow[] {
  const out: ParsedRow[] = [];
  for (const row of rows) {
    const dateRaw =
      row["transaction date"] || row["date"] || row["posted date"] || "";
    const rawDescription =
      row["transaction description"] || row["description"] || row["memo"] || "";
    const amountRaw = row["transaction amount"] || row["amount"] || "";
    const txType = row["transaction type"] || "";

    if (!dateRaw || !rawDescription || !amountRaw) continue;

    const amountVal = parseFloat(amountRaw.replace(/,/g, "").replace(/\$/g, "").trim());
    if (Number.isNaN(amountVal)) continue;

    let flow: Flow;
    const t = txType.toLowerCase();
    if (t === "debit" || t === "withdrawal" || t === "purchase") {
      flow = "debit";
    } else if (t === "credit" || t === "deposit") {
      flow = "credit";
    } else {
      flow = amountVal < 0 ? "debit" : "credit";
    }

    const [description, note] = cleanBankDescription(rawDescription);
    const category = isInternalTransfer(rawDescription)
      ? "Transfer"
      : categorize(description, "", merchantRules);

    out.push({
      date: parseDate(dateRaw),
      description,
      amount: round2(Math.abs(amountVal)),
      flow,
      raw_category: "",
      category,
      notes: note,
    });
  }
  return out;
}

/** UCCU Checking: Account Number, Post Date, Check, Description, Debit, Credit, Status, Balance, Classification */
function parseUccu(rows: Row[], merchantRules: MerchantRule[] | null): ParsedRow[] {
  const out: ParsedRow[] = [];
  for (const row of rows) {
    const dateRaw = row["post date"] || "";
    const description = row["description"] || "";
    const debit = row["debit"] || "";
    const credit = row["credit"] || "";
    const status = row["status"] || "";
    const classification = htmlUnescape(row["classification"] || "");

    if (status.toLowerCase() !== "posted") continue;
    if (!dateRaw || !description) continue;

    let amount: number;
    let flow: Flow;
    if (debit) {
      amount = normalizeAmount(debit);
      flow = "debit";
    } else if (credit) {
      amount = normalizeAmount(credit);
      flow = "credit";
    } else {
      continue;
    }

    const category =
      classification.toLowerCase() === "transfer"
        ? "Transfer"
        : categorize(description, classification, merchantRules);

    out.push({
      date: parseDate(dateRaw),
      description,
      amount: round2(amount),
      flow,
      raw_category: classification,
      category,
      notes: "",
    });
  }
  return out;
}
