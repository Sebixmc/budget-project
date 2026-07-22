/**
 * Auto-categorization — a faithful TypeScript port of the legacy `categorizer.py`.
 *
 * Priority order (highest first):
 *   1. Saved merchant rules (substring match) — learned from manual corrections
 *   2. Keyword RULES list — first match wins
 *   3. The bank's own category label (`rawCategory`) via a fallback map
 *   4. "Other"
 *
 * Pure module: no DB, no framework imports — unit-testable directly.
 * Merchant rules beat keyword matching; see CLAUDE.md hard rule #7.
 */

export type MerchantRule = { pattern: string; category: string };

/** [category, keywords] — order matters: the first matching category wins. */
export const RULES: ReadonlyArray<readonly [string, readonly string[]]> = [
  // Income — checked first so payroll/tax deposits aren't misread as transfers
  ["Income", [
    "payroll", "direct dep", "salary", "ach deposit",
    "zelle from", "venmo from",
    "irs treas", "tax ref", "nysttaxrfd", "tax rfd",
    "interest paid", "monthly interest",
    "refund", "check deposit",
    "byu refund", "edipymnts", "edi pymnts",
    "usaa", "insurance refund",
  ]],
  // Transfers — internal moves between own accounts and credit card payments
  ["Transfer", [
    "withdrawal to ",
    "capital one mobile pmt",
    "capital one online pmt",
    "payment thank",
    "autopay",
    "online payment",
    "mobile payment",
    "zelle to",
    "venmo to",
    "funds tran",
  ]],
  ["Rent & Housing", [
    "yardi", "tpm, inc", "tpm inc", "resident",
    "rent", "lease", "landlord", "property mgmt",
  ]],
  ["Utilities", [
    "provo city", "billpay",
    "questargas", "questar gas",
    "google fiber",
    "electric", "dominion", "pepco", "conedison", "electricity",
    "water bill", "gas bill", "sewage",
    "comcast", "xfinity", "verizon", "at&t", "t-mobile", "sprint",
    "internet", "cable ", "phone bill",
  ]],
  ["Groceries", [
    "winco", "winco foods",
    "smiths food", "smith's food",
    "whole foods", "trader joe", "kroger", "giant", "safeway", "publix",
    "aldi", "lidl", "wegmans", "harris teeter", "food lion",
    "shoprite", "stop & shop", "grocery",
    "costco", "sam's club", "bj's",
    "walmart supercenter", "walmart grocery", "wm supercenter",
  ]],
  ["Dining", [
    "taco bell", "chick fil a", "chick-fil-a",
    "five sushi", "sushi brother",
    "cubbys", "cubby",
    "blue line deli",
    "java junkie",
    "hruska",
    "bakery",
    "creamery",
    "library cafe",
    "cougar express",
    "restaurant", "cafe", "coffee", "pizza", "burger", "sushi",
    "grill", "diner",
    "mcdonald", "chipotle", "subway", "starbucks", "dunkin", "panera",
    "domino", "papa john", "wendy's", "popeyes", "shake shack",
    "five guys",
    "doordash", "uber eats", "grubhub", "postmates",
    "ihop", "applebee", "olive garden", "outback", "cheesecake factory",
    "south end market",
  ]],
  ["Gas & Fuel", [
    "maverik",
    "shell", "bp ", "exxon", "chevron", "sunoco", "mobil ",
    "speedway", "wawa gas", "sheetz", "circle k gas",
    "gas station", "fuel",
  ]],
  ["Transportation", [
    "clipper systems",
    "airgarage",
    "park sundance honk", "honk",
    "parking",
    "uber", "lyft", "taxi", "transit", "metro", "bus ",
    "toll", "ezpass",
    "zipcar", "enterprise rent", "hertz", "avis", "budget rent",
  ]],
  ["Education", [
    "brigham young", "byu",
    "myeducator",
    "ww norton", "norton co",
    "textbook", "tuition",
    "faithmatters",
    "mtc ",
  ]],
  ["Subscriptions", [
    "perplexity",
    "spotify",
    "netflix", "hulu", "disney+", "hbo",
    "apple music", "amazon prime",
    "youtube", "peacock", "paramount",
    "apple one", "icloud", "apple com bill",
    "google one",
    "adobe", "microsoft 365", "dropbox", "notion", "chatgpt", "openai",
    "membership", "subscription",
  ]],
  ["Shopping", [
    "butora", "hmhoutdoor", "outdoor",
    "amazon", "target", "walmart", "best buy",
    "macy's", "nordstrom", "tj maxx", "marshalls", "ross ",
    "gap ", "h&m", "zara", "old navy", "forever 21",
    "home depot", "lowe's", "ikea", "wayfair", "etsy", "ebay",
    "apple store", "microsoft store",
    "nintendo",
    "7 eleven", "7-eleven",
  ]],
  ["Entertainment", [
    "fandango",
    "movie", "cinema", "amc ", "regal ", "theater", "concert",
    "ticketmaster", "eventbrite",
    "bowling", "arcade", "dave & buster", "topgolf",
    "museum", "zoo ", "aquarium",
    "sundance",
  ]],
  ["Health & Medical", [
    "walgreens", "cvs", "rite aid", "pharmacy", "rx ", "prescription",
    "doctor", "hospital", "clinic", "dental", "vision", "optometrist",
    "health insurance", "copay", "medical",
  ]],
  ["Fitness", [
    "planet fitness", "equinox", "24 hour fitness", "anytime fitness",
    "la fitness", "crossfit", "peloton", "yoga", "pilates",
  ]],
  ["Travel", [
    "airline", "delta", "united", "american air", "southwest", "jetblue",
    "spirit air", "frontier", "airbnb", "vrbo", "hotel",
    "marriott", "hilton", "hyatt", "expedia", "booking.com", "kayak",
  ]],
  ["Pet", [
    "petco", "petsmart", "veterinary", "vet ", "banfield", "chewy",
    "animal hospital",
  ]],
  ["Home & Garden", [
    "ace hardware", "menards", "garden",
    "plumber", "electrician", "contractor",
  ]],
  ["Savings & Investments", [
    "robinhood", "fidelity", "vanguard", "schwab", "tdameritrade",
    "etrade", "coinbase", "401k",
  ]],
  ["Fees & Charges", [
    "elevated checking fee",
    "non-sufficient funds", "nsf fee", "returned item fee",
    "overdraft fee", "overdraft protection",
    "monthly fee", "annual fee", "service charge",
    "late fee", "foreign transaction",
    "atm fee", "wire transfer fee",
  ]],
];

/** Bank category labels (Capital One + UCCU) → our canonical category. */
const FALLBACK_MAP: ReadonlyArray<readonly [string, string]> = [
  // Capital One credit card labels
  ["food & drink", "Dining"],
  ["groceries", "Groceries"],
  ["gas", "Gas & Fuel"],
  ["travel", "Travel"],
  ["entertainment", "Entertainment"],
  ["health", "Health & Medical"],
  ["shopping", "Shopping"],
  ["bills & utilities", "Utilities"],
  ["automotive", "Gas & Fuel"],
  ["education", "Education"],
  ["transfer", "Transfer"],
  ["payment", "Transfer"],
  ["fees", "Fees & Charges"],
  // UCCU classification labels
  ["food & dining", "Dining"],
  ["fast food", "Dining"],
  ["fees & charges", "Fees & Charges"],
  ["banking fee", "Fees & Charges"],
  ["income", "Income"],
];

/**
 * Categorize a transaction description. `rawCategory` is the bank's own label
 * (Capital One category / UCCU classification), used only as a fallback.
 */
export function categorize(
  description: string,
  rawCategory = "",
  merchantRules: MerchantRule[] | null = null,
): string {
  const text = description.toLowerCase();

  // Merchant rules take highest priority — learned from manual corrections
  if (merchantRules) {
    for (const rule of merchantRules) {
      if (text.includes(rule.pattern)) return rule.category;
    }
  }

  for (const [category, keywords] of RULES) {
    for (const kw of keywords) {
      if (text.includes(kw)) return category;
    }
  }

  // Fall back to the bank's own category label
  if (rawCategory) {
    const raw = rawCategory.toLowerCase();
    for (const [key, mapped] of FALLBACK_MAP) {
      if (raw.includes(key)) return mapped;
    }
  }

  return "Other";
}

/** Sorted, de-duplicated category list — used wherever the UI lists categories. */
export const ALL_CATEGORIES: string[] = Array.from(
  new Set<string>([...RULES.map(([cat]) => cat), "Other", "Uncategorized", "Fees & Charges"]),
).sort();
