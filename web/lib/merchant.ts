/**
 * Merchant pattern cleaning — turns a raw bank description into the substring
 * pattern a merchant rule should match on (e.g. "TRADER JOES #451" → "trader
 * joes"). Used by the post-upload triage panel to group uncategorized
 * transactions by merchant, and by the save-as-rule prompt to pre-fill the
 * rule pattern.
 *
 * Pure module: no DB, no framework imports — unit-testable directly, same rule
 * as parser.ts / categorizer.ts.
 */

/**
 * Lowercase a description and strip the per-transaction noise that varies
 * between visits to the same merchant:
 *   - `#1234`-style store numbers ("TRADER JOES #451")
 *   - Capital One `XXXXXXX####` account masks ("Deposit from Account XXXXXXX1234")
 *   - bare trailing digit runs ("MAVERIK 12", "CHECK 1053")
 * Whitespace is collapsed. May return "" (e.g. an all-digit description) —
 * callers must handle an empty pattern.
 */
export function cleanMerchantPattern(description: string): string {
  return (description ?? "")
    .toLowerCase()
    .replace(/x{4,}\d*/g, " ") // Capital One account masks (XXXXXXX1234)
    .replace(/#\s*\d+/g, " ") // store numbers (#451)
    .replace(/(\s+\d+)+\s*$/, " ") // bare trailing digit runs (maverik 12)
    .replace(/\s+/g, " ")
    .trim();
}

/** One merchant's worth of transactions, grouped by cleaned pattern. */
export type MerchantGroup = {
  pattern: string;
  count: number;
  total: number;
  sampleDescription: string;
  ids: string[];
};

/**
 * Group transactions by cleaned merchant pattern — the triage panel's shape.
 * Rows whose description cleans to "" group under their raw lowercased text;
 * rows with nothing at all are dropped. Sorted by count desc, then total desc.
 */
export function groupByMerchant(
  rows: Array<{ id: string; description: string; amount: number }>,
): MerchantGroup[] {
  const groups = new Map<string, MerchantGroup>();
  for (const row of rows) {
    const description = row.description ?? "";
    const pattern = cleanMerchantPattern(description) || description.trim().toLowerCase();
    if (!pattern) continue;
    let group = groups.get(pattern);
    if (!group) {
      group = { pattern, count: 0, total: 0, sampleDescription: description, ids: [] };
      groups.set(pattern, group);
    }
    group.count += 1;
    group.total += row.amount;
    group.ids.push(row.id);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, total: Math.round(g.total * 100) / 100 }))
    .sort((a, b) => b.count - a.count || b.total - a.total);
}
