/**
 * Sunburst tree builder — pure. Turns transaction rows into the ECharts
 * nested {name, value, children} tree for the Dashboard's spending sunburst:
 * flow (Spending / Income) → category → merchant (grouped by cleaned
 * pattern). No Supabase/Next imports — unit-tested like parser/categorizer.
 *
 * Rows are expected to be Transfer-free already (the query excludes them,
 * hard rule #3), but Transfer is filtered defensively here too.
 */

import { cleanMerchantPattern } from "@/lib/merchant";

export type SunburstRow = {
  description: string;
  amount: number;
  flow: "debit" | "credit";
  category: string;
};

export type SunburstNode = {
  name: string;
  value: number;
  children?: SunburstNode[];
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Group rows by merchant (cleaned pattern; raw description as fallback),
 *  summed and sorted by total desc. */
function merchantLeaves(rows: SunburstRow[]): SunburstNode[] {
  const merchants = new Map<string, number>();
  for (const r of rows) {
    const name = cleanMerchantPattern(r.description) || r.description.trim().toLowerCase();
    if (!name) continue;
    merchants.set(name, (merchants.get(name) ?? 0) + r.amount);
  }
  return [...merchants.entries()]
    .map(([name, value]) => ({ name, value: round2(value) }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Build the three-ring tree: flow → category (sorted by total desc) →
 * merchant. Flows with no rows are omitted; an empty input yields [].
 */
export function buildSunburstTree(rows: SunburstRow[]): SunburstNode[] {
  const usable = rows.filter((r) => r.category !== "Transfer" && r.amount > 0);

  const flows: Array<{ name: string; flow: "debit" | "credit" }> = [
    { name: "Spending", flow: "debit" },
    { name: "Income", flow: "credit" },
  ];

  const tree: SunburstNode[] = [];
  for (const { name, flow } of flows) {
    const flowRows = usable.filter((r) => r.flow === flow);
    if (flowRows.length === 0) continue;

    const byCategory = new Map<string, SunburstRow[]>();
    for (const r of flowRows) {
      const bucket = byCategory.get(r.category) ?? [];
      bucket.push(r);
      byCategory.set(r.category, bucket);
    }

    const children = [...byCategory.entries()]
      .map(([category, catRows]) => {
        const leaves = merchantLeaves(catRows);
        // Parent totals are sums of their (rounded) children so every ring
        // adds up exactly — a stray cent would render as a blank sliver.
        return {
          name: category,
          value: round2(leaves.reduce((s, l) => s + l.value, 0)),
          children: leaves,
        };
      })
      .sort((a, b) => b.value - a.value);

    tree.push({
      name,
      value: round2(children.reduce((s, c) => s + c.value, 0)),
      children,
    });
  }
  return tree;
}
